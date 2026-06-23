import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, EntityType } from '@kamaia/shared-types';
import { AIMessageRole, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RagService } from '../rag/rag.service';
import { ClaudeMessage, ClaudeProvider } from './claude.provider';
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
  ) {}

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
      where: { id, tenantId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }

  async sendMessage(
    tenantId: string,
    userId: string,
    conversationId: string,
    dto: SendMessageDto,
  ) {
    // AUDIT fix (IA): respeitar quota iaMessagesLimit do tenant
    // antes de chamar Claude. Mensagens custam dinheiro; sem este
    // check, um tenant podia gerar custo ilimitado.
    const quota = await this.prisma.usageQuota.findUnique({
      where: { tenantId },
      select: { iaMessagesLimit: true, iaMessagesUsado: true },
    });
    if (quota && quota.iaMessagesUsado >= quota.iaMessagesLimit) {
      throw new ForbiddenException(
        `Quota IA esgotada (${quota.iaMessagesUsado}/${quota.iaMessagesLimit}). Renova o plano ou aguarda o próximo ciclo.`,
      );
    }

    const conv = await this.prisma.aIConversation.findFirst({
      where: { id: conversationId, tenantId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

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

    // AUDIT fix: incrementa contador de quota (fire-and-forget — não
    // bloqueia retorno se updateMany falhar; cap próximo ciclo)
    this.prisma.usageQuota
      .updateMany({
        where: { tenantId },
        data: { iaMessagesUsado: { increment: 1 } },
      })
      .catch(() => {
        /* silent */
      });

    return { user: userMsg, assistant: assistantMsg };
  }
}
