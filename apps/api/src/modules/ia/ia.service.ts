import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, EntityType } from '@kamaia/shared-types';
import { AIMessageRole, Prisma, Role } from '@prisma/client';
import pdfParse from 'pdf-parse';
import { AuditService } from '../audit/audit.service';
import { DocumentsService } from '../documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { RagService } from '../rag/rag.service';
import {
  AnthropicStructuredMessage,
  ClaudeMessage,
  ClaudeProvider,
  ExtractedContractFields,
} from './claude.provider';
import { AgentService } from './agent/agent.service';
import type { PageContext } from './agent/tool.types';
import {
  CreateConversationDto,
  ListConversationsQuery,
  SendMessageDto,
} from './ia.dto';

const HISTORY_TURNS = 10;
const RAG_TOPK = 6;

const STUB_PREAMBLE =
  '⚠ Modo placeholder (defina ANTHROPIC_API_KEY para activar Claude).\n\n';
const DISCLAIMER_FINAL =
  '\n\n⚠ Esta resposta não substitui aconselhamento jurídico profissional.';

interface CitacaoChunk {
  document: { codigo: string; titulo: string };
  artigo: string | null;
  trecho: string;
}

@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly claude: ClaudeProvider,
    private readonly rag: RagService,
    private readonly agent: AgentService,
    private readonly documents: DocumentsService,
  ) {}

  /**
   * Onda IA-1: reserva atómica de quota ANTES de chamar a Claude.
   *
   * Um único UPDATE atómico que incrementa `iaMessagesUsado` apenas se
   * houver quota (`usado < limite`) ou o plano for ilimitado
   * (`limite < 0`). `updateMany` devolve `count` — se `0`, ou a quota
   * está esgotada OU não existe linha de quota para o tenant
   * (fail-CLOSED: sem provisão de quota = sem IA, em vez do antigo
   * fail-open que dava IA grátis ilimitada).
   *
   * Reservar à entrada (não no fim, e não `void`) fecha a corrida
   * TOCTOU: N pedidos concorrentes não podem todos passar o limite,
   * porque cada um consome uma unidade atomicamente antes de gastar
   * tokens. Devolve `true` se reservou, `false` caso contrário.
   */
  private async reserveIaQuota(tenantId: string): Promise<boolean> {
    try {
      const { count } = await this.prisma.usageQuota.updateMany({
        where: {
          tenantId,
          OR: [
            { iaMessagesLimit: { lt: 0 } },
            { iaMessagesUsado: { lt: this.prisma.usageQuota.fields.iaMessagesLimit } },
          ],
        },
        data: { iaMessagesUsado: { increment: 1 } },
      });
      return count > 0;
    } catch (e) {
      // Fail-closed: se não conseguimos verificar a quota, não gastamos
      // dinheiro de API às cegas.
      this.logger.warn(
        `Falha ao reservar quota IA (tenant ${tenantId}): ${(e as Error).message}`,
      );
      return false;
    }
  }

  /**
   * Estorna uma reserva de quota (best-effort) quando a resposta não é
   * entregue (erro/abort). Espelha EXACTAMENTE `reserveIaQuota` —
   * incluindo planos ilimitados (limite < 0), que também são contados
   * na reserva; o único guard é `iaMessagesUsado > 0` para nunca ir
   * abaixo de zero.
   */
  private async refundIaQuota(tenantId: string): Promise<void> {
    try {
      await this.prisma.usageQuota.updateMany({
        where: { tenantId, iaMessagesUsado: { gt: 0 } },
        data: { iaMessagesUsado: { decrement: 1 } },
      });
    } catch {
      /* best-effort */
    }
  }

  /**
   * HERANÇA + IA-na-gestão: lê um documento de contrato JÁ EXISTENTE e
   * extrai os campos para pré-preencher o formulário de registo — para
   * que herdar um contrato seja tão fácil como criar.
   *
   * MVP: PDF com texto (pdf-parse → Claude). PDFs digitalizados (sem
   * texto), Word e imagens degradam para `{ suportado:false }` (OCR fica
   * para uma iteração futura). Best-effort: nunca lança por falha da IA
   * — devolve sugestões ou nada. Consome 1 unidade de quota IA.
   */
  /**
   * Extrai texto cru de um documento conforme o tipo:
   *  - PDF com texto → pdf-parse
   *  - Word .docx → mammoth
   *  - Imagens (PNG/JPEG) → OCR tesseract.js (língua portuguesa)
   * Best-effort: devolve '' em qualquer falha (dep em falta, ficheiro
   * corrupto, OCR sem dados de língua) — o chamador degrada para
   * preenchimento manual. PDFs digitalizados (imagem dentro de PDF)
   * devolvem pouco texto e caem na mesma degradação.
   */
  private async extrairTexto(
    buffer: Buffer,
    mimeType: string,
    documentId: string,
  ): Promise<string> {
    try {
      if (mimeType === 'application/pdf') {
        const parsed = await pdfParse(buffer);
        return (parsed.text ?? '').trim();
      }
      if (
        mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        const mammoth = await import('mammoth');
        const { value } = await mammoth.extractRawText({ buffer });
        return (value ?? '').trim();
      }
      if (
        mimeType === 'image/png' ||
        mimeType === 'image/jpeg' ||
        mimeType === 'image/jpg'
      ) {
        const { recognize } = await import('tesseract.js');
        const { data } = await recognize(buffer, 'por');
        return (data.text ?? '').trim();
      }
    } catch (e) {
      this.logger.warn(
        `extrairTexto (${mimeType}) falhou doc ${documentId}: ${e instanceof Error ? e.message : e}`,
      );
    }
    return '';
  }

  async extrairContrato(
    tenantId: string,
    actorUserId: string,
    documentId: string,
  ): Promise<{ suportado: boolean; motivo?: string; campos?: ExtractedContractFields }> {
    const { buffer, mimeType } = await this.documents.getBytes(tenantId, documentId);

    const texto = await this.extrairTexto(buffer, mimeType, documentId);
    if (texto.length < 80) {
      return {
        suportado: false,
        motivo:
          'Não foi possível ler texto suficiente do documento (digitalização de baixa qualidade ou formato não suportado). Preenche os campos manualmente.',
      };
    }

    // Quota: a extracção é uma chamada à IA.
    if (!(await this.reserveIaQuota(tenantId))) {
      throw new ForbiddenException(
        'Esgotaste as mensagens de IA do teu plano. Faz upgrade para extrair mais contratos.',
      );
    }

    let campos: ExtractedContractFields | null = null;
    try {
      // Tecto de texto enviado à IA (contratos longos) — primeiras
      // ~30k chars chegam para os metadados-chave.
      campos = await this.claude.extractContractFields(texto.slice(0, 30000));
    } catch (e) {
      await this.refundIaQuota(tenantId);
      this.logger.error(
        `extractContractFields erro doc ${documentId}: ${e instanceof Error ? e.message : e}`,
      );
      return { suportado: true, motivo: 'A extracção falhou. Tenta de novo ou preenche manualmente.' };
    }

    if (!campos) {
      // Sem chave (stub) ou sem resultado — estorna a quota reservada.
      await this.refundIaQuota(tenantId);
      return {
        suportado: false,
        motivo: 'Extracção indisponível de momento. Preenche os campos manualmente.',
      };
    }

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.READ,
      entityType: EntityType.DOCUMENT,
      entityId: documentId,
      afterData: { acao: 'EXTRACAO_IA', confianca: campos.confianca },
    });

    return { suportado: true, campos };
  }

  async createConversation(
    tenantId: string,
    userId: string,
    dto: CreateConversationDto,
  ) {
    const conv = await this.prisma.aIConversation.create({
      data: {
        tenantId,
        userId,
        titulo: dto.titulo,
        contexto: dto.contexto as object | undefined,
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId: userId,
      action: AuditAction.CREATE,
      entityType: EntityType.AI_CONVERSATION,
      entityId: conv.id,
    });
    return conv;
  }

  async list(tenantId: string, userId: string, q: ListConversationsQuery) {
    const where: Prisma.AIConversationWhereInput = {
      tenantId,
      userId,
      deletedAt: null,
      ...(q.q && { titulo: { contains: q.q, mode: 'insensitive' } }),
    };
    const limit = q.limit ?? 50;
    const rows = await this.prisma.aIConversation.findMany({
      where,
      take: limit + 1,
      ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
      orderBy: { updatedAt: 'desc' },
    });
    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    return {
      data,
      nextCursor: hasMore ? data[data.length - 1].id : null,
      total: data.length,
    };
  }

  async get(tenantId: string, userId: string, id: string) {
    const conv = await this.prisma.aIConversation.findFirst({
      where: { id, tenantId, userId, deletedAt: null },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }

  /**
   * Mensagens de uma conversa, no formato que o frontend espera
   * (`{ data: [...] }` com `content`). Scoped a {id, tenantId, userId}
   * para evitar IDOR.
   */
  async listMessages(tenantId: string, userId: string, id: string) {
    const conv = await this.prisma.aIConversation.findFirst({
      where: { id, tenantId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    const messages = await this.prisma.aIMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    });
    return {
      data: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.conteudo,
        citacoes: m.citacoes,
        createdAt: m.createdAt,
      })),
    };
  }

  /**
   * Soft delete de uma conversa (nunca DELETE físico — regra do
   * projecto). Scoped a {id, tenantId, userId} para evitar IDOR. As
   * mensagens permanecem na BD mas ficam inacessíveis (filtradas pela
   * conversa).
   */
  async deleteConversation(tenantId: string, userId: string, id: string) {
    const { count } = await this.prisma.aIConversation.updateMany({
      where: { id, tenantId, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (count === 0) throw new NotFoundException('Conversation not found');

    await this.audit.log({
      tenantId,
      actorUserId: userId,
      action: AuditAction.DELETE,
      entityType: EntityType.AI_CONVERSATION,
      entityId: id,
    });
    return { ok: true };
  }

  async sendMessage(
    tenantId: string,
    userId: string,
    conversationId: string,
    dto: SendMessageDto,
  ) {
    const conv = await this.prisma.aIConversation.findFirst({
      where: { id: conversationId, tenantId, userId, deletedAt: null },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    // Reserva atómica de quota ANTES de chamar Claude (fail-closed).
    if (!(await this.reserveIaQuota(tenantId))) {
      throw new ForbiddenException(
        'Esgotaste as mensagens de IA do teu plano. Renova o plano ou fala com o suporte.',
      );
    }

    const userMsg = await this.prisma.aIMessage.create({
      data: {
        conversationId,
        role: AIMessageRole.USER,
        conteudo: dto.conteudo,
      },
    });

    const historico: ClaudeMessage[] = conv.messages
      .filter(
        (m) =>
          m.role === AIMessageRole.USER || m.role === AIMessageRole.ASSISTANT,
      )
      .slice(-HISTORY_TURNS * 2)
      .map((m) => ({
        role: m.role === AIMessageRole.USER ? 'user' : 'assistant',
        content: m.conteudo,
      }));
    historico.push({ role: 'user', content: dto.conteudo });

    let respostaConteudo: string;
    let modelo: string;
    let tokensIn = 0;
    let tokensOut = 0;
    let citacoes: Array<{
      documentCodigo: string;
      titulo: string;
      artigo: string | null;
      trecho: string;
    }> = [];

    if (this.claude.isAvailable()) {
      let contextoRAG = '';
      try {
        const search = await this.rag.search({
          q: dto.conteudo,
          topK: RAG_TOPK,
        });
        if (search.data.length > 0) {
          const chunks = search.data as unknown as CitacaoChunk[];
          citacoes = chunks.map((c) => ({
            documentCodigo: c.document.codigo,
            titulo: c.document.titulo,
            artigo: c.artigo,
            trecho: c.trecho,
          }));
          contextoRAG = citacoes
            .map(
              (c, i) =>
                `[${i + 1}] ${c.documentCodigo}${c.artigo ? ` art. ${c.artigo}` : ''} — ${c.titulo}\n${c.trecho.slice(0, 600)}`,
            )
            .join('\n\n');
        }
      } catch (e) {
        this.logger.warn(
          `RAG search falhou (continua sem contexto): ${
            e instanceof Error ? e.message : e
          }`,
        );
      }

      try {
        const resp = await this.claude.complete(historico, contextoRAG);
        if (!resp) throw new Error('Claude provider returned null');
        respostaConteudo = resp.text + DISCLAIMER_FINAL;
        modelo = resp.modelo;
        tokensIn = resp.tokensInput;
        tokensOut = resp.tokensOutput;
      } catch (e) {
        this.logger.error(
          `Claude call falhou: ${e instanceof Error ? e.message : e}`,
        );
        // Não houve resposta real — estorna a unidade de quota reservada.
        await this.refundIaQuota(tenantId);
        respostaConteudo =
          STUB_PREAMBLE +
          `Não foi possível obter resposta da IA neste momento. ` +
          `Tenta de novo em instantes.` +
          DISCLAIMER_FINAL;
        modelo = 'fallback-after-error';
      }
    } else {
      respostaConteudo =
        STUB_PREAMBLE +
        `Recebi a tua pergunta: "${dto.conteudo.slice(0, 200)}".\n\n` +
        `Para activar respostas reais com citações à legislação angolana, define ` +
        `\`ANTHROPIC_API_KEY\` no ambiente da API. A integração usa o catálogo de ` +
        `legislação semeado (Constituição, CC, CCom, LSC, CIS, Lei Cambial, LGT, ` +
        `Lei 22/11, Lei 3/14).` +
        DISCLAIMER_FINAL;
      modelo = 'stub-no-api-key';
    }

    const assistantMsg = await this.prisma.aIMessage.create({
      data: {
        conversationId,
        role: AIMessageRole.ASSISTANT,
        conteudo: respostaConteudo,
        modelo,
        tokensInput: tokensIn,
        tokensOutput: tokensOut,
        citacoes:
          citacoes.length > 0 ? (citacoes as unknown as object) : undefined,
      },
    });

    await this.prisma.aIConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    await this.audit.log({
      tenantId,
      actorUserId: userId,
      action: AuditAction.IA_QUERY,
      entityType: EntityType.AI_CONVERSATION,
      entityId: conversationId,
    });

    // Quota já foi reservada atomicamente à entrada (reserveIaQuota).
    return { user: userMsg, assistant: assistantMsg };
  }

  /**
   * Stream variant — devolve async generator com chunks de texto +
   * eventos auxiliares. UX: utilizador vê resposta a aparecer letra-
   * a-letra em vez de aguardar 5-10s pela resposta completa.
   *
   * Eventos:
   *  - {kind: 'user-msg', message} no início (id da mensagem inserida)
   *  - {kind: 'citations', citacoes} se RAG search devolver chunks
   *  - {kind: 'text', delta} para cada chunk de texto
   *  - {kind: 'done', assistantMessageId, tokensInput, tokensOutput}
   *  - {kind: 'error', message} em falhas
   */
  async *sendMessageStream(
    tenantId: string,
    userId: string,
    conversationId: string,
    dto: SendMessageDto,
    signal?: AbortSignal,
  ): AsyncGenerator<
    | { kind: 'user-msg'; messageId: string }
    | { kind: 'citations'; citacoes: Array<{ documentCodigo: string; titulo: string; artigo: string | null; trecho: string }> }
    | { kind: 'text'; delta: string }
    | { kind: 'done'; assistantMessageId: string; modelo: string; tokensInput: number; tokensOutput: number }
    | { kind: 'error'; message: string }
  > {
    // Quota check
    const conv = await this.prisma.aIConversation.findFirst({
      where: { id: conversationId, tenantId, userId, deletedAt: null },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conv) {
      yield { kind: 'error', message: 'Conversation not found' };
      return;
    }

    // Reserva atómica de quota ANTES de chamar Claude (fail-closed).
    if (!(await this.reserveIaQuota(tenantId))) {
      yield {
        kind: 'error',
        message: 'Esgotaste as mensagens de IA do teu plano. Renova o plano ou fala com o suporte.',
      };
      return;
    }

    const userMsg = await this.prisma.aIMessage.create({
      data: {
        conversationId,
        role: AIMessageRole.USER,
        conteudo: dto.conteudo,
      },
    });
    yield { kind: 'user-msg', messageId: userMsg.id };

    const historico: ClaudeMessage[] = conv.messages
      .filter(
        (m) =>
          m.role === AIMessageRole.USER || m.role === AIMessageRole.ASSISTANT,
      )
      .slice(-HISTORY_TURNS * 2)
      .map((m) => ({
        role: m.role === AIMessageRole.USER ? 'user' : 'assistant',
        content: m.conteudo,
      }));
    historico.push({ role: 'user', content: dto.conteudo });

    // RAG search
    let citacoes: Array<{
      documentCodigo: string;
      titulo: string;
      artigo: string | null;
      trecho: string;
    }> = [];
    let contextoRAG = '';
    if (this.claude.isAvailable()) {
      try {
        const search = await this.rag.search({ q: dto.conteudo, topK: RAG_TOPK });
        if (search.data.length > 0) {
          const chunks = search.data as unknown as CitacaoChunk[];
          citacoes = chunks.map((c) => ({
            documentCodigo: c.document.codigo,
            titulo: c.document.titulo,
            artigo: c.artigo,
            trecho: c.trecho,
          }));
          contextoRAG = citacoes
            .map(
              (c, i) =>
                `[${i + 1}] ${c.documentCodigo}${c.artigo ? ` art. ${c.artigo}` : ''} — ${c.titulo}\n${c.trecho.slice(0, 600)}`,
            )
            .join('\n\n');
        }
      } catch (e) {
        this.logger.warn(
          `RAG falhou (continua sem contexto): ${e instanceof Error ? e.message : e}`,
        );
      }
    }

    if (citacoes.length > 0) {
      yield { kind: 'citations', citacoes };
    }

    // Stream Claude
    let respostaText = '';
    let modelo = 'stub-no-api-key';
    let tokensIn = 0;
    let tokensOut = 0;

    if (this.claude.isAvailable()) {
      for await (const ev of this.claude.completeStream(
        historico,
        contextoRAG,
        undefined,
        undefined,
        signal,
      )) {
        if (ev.kind === 'text') {
          respostaText += ev.delta;
          yield { kind: 'text', delta: ev.delta };
        } else if (ev.kind === 'done') {
          modelo = ev.modelo;
          tokensIn = ev.tokensInput;
          tokensOut = ev.tokensOutput;
        } else if (ev.kind === 'error') {
          // Sem resposta entregue — estorna a quota reservada.
          await this.refundIaQuota(tenantId);
          yield { kind: 'error', message: ev.message };
          return;
        }
      }
      // Cliente desconectou a meio — não persistir resposta parcial nem
      // cobrar a mensagem.
      if (signal?.aborted) {
        await this.refundIaQuota(tenantId);
        return;
      }
      respostaText = respostaText + DISCLAIMER_FINAL;
    } else {
      // Stub: emite chunks fake para teste do fluxo SSE
      const stub =
        STUB_PREAMBLE +
        `Recebi a tua pergunta: "${dto.conteudo.slice(0, 200)}". ` +
        `Configure ANTHROPIC_API_KEY para respostas reais.` +
        DISCLAIMER_FINAL;
      respostaText = stub;
      // Yield em chunks de ~20 chars para simular streaming
      for (let i = 0; i < stub.length; i += 20) {
        yield { kind: 'text', delta: stub.slice(i, i + 20) };
        await new Promise((r) => setTimeout(r, 30));
      }
    }

    const assistantMsg = await this.prisma.aIMessage.create({
      data: {
        conversationId,
        role: AIMessageRole.ASSISTANT,
        conteudo: respostaText,
        modelo,
        tokensInput: tokensIn,
        tokensOutput: tokensOut,
        citacoes:
          citacoes.length > 0 ? (citacoes as unknown as object) : undefined,
      },
    });

    await this.prisma.aIConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    await this.audit.log({
      tenantId,
      actorUserId: userId,
      action: AuditAction.IA_QUERY,
      entityType: EntityType.AI_CONVERSATION,
      entityId: conversationId,
    });

    // Quota já reservada atomicamente à entrada (reserveIaQuota).
    yield {
      kind: 'done',
      assistantMessageId: assistantMsg.id,
      modelo,
      tokensInput: tokensIn,
      tokensOutput: tokensOut,
    };
  }

  /**
   * Agente — variante com tool use. Diferenças vs sendMessageStream:
   *  - Usa AgentService (loop multi-turn com tools)
   *  - Não invoca RAG inline (Claude pode decidir via tools no futuro)
   *  - Persiste apenas o texto final como assistant message
   *  - Tool calls / results vão no SSE para o frontend renderizar mas
   *    NÃO são persistidos (Sprint 1.2 — pode vir depois)
   *
   * Caller (controller) é responsável por garantir que o utilizador
   * autenticado tem role válida (validado pelos guards).
   */
  async *sendMessageAgentStream(
    tenantId: string,
    userId: string,
    role: Role,
    conversationId: string,
    dto: SendMessageDto,
    pageContext?: PageContext,
    allowMutations?: boolean,
    signal?: AbortSignal,
  ): AsyncGenerator<
    | { kind: 'user-msg'; messageId: string }
    | { kind: 'text'; delta: string }
    | { kind: 'tool_use_start'; id: string; name: string }
    | { kind: 'tool_executing'; id: string; name: string }
    | {
        kind: 'tool_result';
        id: string;
        name: string;
        result: unknown;
        isError: boolean;
        renderHint?: string;
        uiPayload?: unknown;
      }
    | {
        kind: 'done';
        assistantMessageId: string;
        modelo: string;
        tokensInput: number;
        tokensOutput: number;
        turns: number;
      }
    | { kind: 'error'; message: string }
  > {
    const conv = await this.prisma.aIConversation.findFirst({
      where: { id: conversationId, tenantId, userId, deletedAt: null },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conv) {
      yield { kind: 'error', message: 'Conversation not found' };
      return;
    }

    // Reserva atómica de quota ANTES de chamar Claude (fail-closed).
    if (!(await this.reserveIaQuota(tenantId))) {
      yield {
        kind: 'error',
        message: 'Esgotaste as mensagens de IA do teu plano. Renova o plano ou fala com o suporte.',
      };
      return;
    }

    // Persiste user message imediatamente
    const userMsg = await this.prisma.aIMessage.create({
      data: {
        conversationId,
        role: AIMessageRole.USER,
        conteudo: dto.conteudo,
      },
    });
    yield { kind: 'user-msg', messageId: userMsg.id };

    // Constrói history em formato estruturado
    const historico: AnthropicStructuredMessage[] = conv.messages
      .filter(
        (m) =>
          m.role === AIMessageRole.USER || m.role === AIMessageRole.ASSISTANT,
      )
      .slice(-HISTORY_TURNS * 2)
      .map((m) => ({
        role: m.role === AIMessageRole.USER ? ('user' as const) : ('assistant' as const),
        content: m.conteudo,
      }));
    historico.push({ role: 'user', content: dto.conteudo });

    // Stub mode quando não há key
    if (!this.claude.isAvailable()) {
      const stub =
        STUB_PREAMBLE +
        `Modo agente requer ANTHROPIC_API_KEY configurada.` +
        DISCLAIMER_FINAL;
      for (let i = 0; i < stub.length; i += 20) {
        yield { kind: 'text', delta: stub.slice(i, i + 20) };
        await new Promise((r) => setTimeout(r, 30));
      }
      const assistantMsg = await this.prisma.aIMessage.create({
        data: {
          conversationId,
          role: AIMessageRole.ASSISTANT,
          conteudo: stub,
        },
      });
      yield {
        kind: 'done',
        assistantMessageId: assistantMsg.id,
        modelo: 'stub',
        tokensInput: 0,
        tokensOutput: 0,
        turns: 0,
      };
      return;
    }

    // Executa agent loop
    let respostaText = '';
    let modelo = '';
    let tokensIn = 0;
    let tokensOut = 0;
    let turns = 0;
    let erroredOut = false;

    for await (const ev of this.agent.run({
      messages: historico,
      signal,
      ctx: {
        tenantId,
        userId,
        role,
        pageContext,
        conversationId,
        messageId: userMsg.id,
        allowMutations,
      },
    })) {
      if (ev.kind === 'text') {
        respostaText += ev.delta;
        yield { kind: 'text', delta: ev.delta };
      } else if (ev.kind === 'tool_use_start') {
        yield { kind: 'tool_use_start', id: ev.id, name: ev.name };
      } else if (ev.kind === 'tool_executing') {
        yield { kind: 'tool_executing', id: ev.id, name: ev.name };
      } else if (ev.kind === 'tool_result') {
        yield {
          kind: 'tool_result',
          id: ev.id,
          name: ev.name,
          result: ev.result,
          isError: ev.isError,
          renderHint: ev.renderHint,
          uiPayload: ev.uiPayload,
        };
      } else if (ev.kind === 'done') {
        modelo = ev.modelo;
        tokensIn = ev.tokensInput;
        tokensOut = ev.tokensOutput;
        turns = ev.turns;
      } else if (ev.kind === 'error') {
        yield { kind: 'error', message: ev.message };
        erroredOut = true;
        break;
      }
    }

    if (erroredOut) {
      // Falha do agente — estorna a unidade de quota reservada (o
      // utilizador não deve pagar por uma resposta que nunca veio).
      await this.refundIaQuota(tenantId);
      return;
    }
    // Cliente desconectou a meio — não persistir mensagem enganadora
    // nem cobrar a mensagem.
    if (signal?.aborted) {
      await this.refundIaQuota(tenantId);
      return;
    }

    // Persiste assistant message (apenas texto final; tool calls
    // só ficam no SSE — sem persistência em Sprint 1.2)
    const temTexto = respostaText.trim().length > 0;
    const finalContent = temTexto
      ? respostaText + DISCLAIMER_FINAL
      : '⚠ O Dr. Kamaia executou ferramentas mas não devolveu texto final.';

    // Disclaimer jurídico também no caminho do agente (era só no Q&A).
    // Emite-o como último chunk visível antes do `done`.
    if (temTexto) {
      yield { kind: 'text', delta: DISCLAIMER_FINAL };
    }

    const assistantMsg = await this.prisma.aIMessage.create({
      data: {
        conversationId,
        role: AIMessageRole.ASSISTANT,
        conteudo: finalContent,
        modelo,
        tokensInput: tokensIn,
        tokensOutput: tokensOut,
      },
    });

    await this.prisma.aIConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    await this.audit.log({
      tenantId,
      actorUserId: userId,
      action: AuditAction.IA_QUERY,
      entityType: EntityType.AI_CONVERSATION,
      entityId: conversationId,
      afterData: { agent: true, turns, tokensInput: tokensIn, tokensOutput: tokensOut },
    });

    // Quota já reservada atomicamente à entrada (reserveIaQuota).
    yield {
      kind: 'done',
      assistantMessageId: assistantMsg.id,
      modelo,
      tokensInput: tokensIn,
      tokensOutput: tokensOut,
      turns,
    };
  }
}
