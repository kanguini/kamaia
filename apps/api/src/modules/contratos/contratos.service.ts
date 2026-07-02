import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  canTransition,
  ContratoEstado,
  ContratoEventoTipo,
  EntityType,
  VersaoDireccao,
} from '@kamaia/shared-types';
import { Prisma } from '@prisma/client';
import { renderMarkdownToHtml } from '../../common/markdown';
import {
  buildContratoPlaceholderContext,
  renderPlaceholders,
} from '../../common/placeholders';
import { AuditService } from '../audit/audit.service';
import { ComplianceService } from '../compliance/compliance.service';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import {
  CreateContratoDto,
  CreateFromTemplateDto,
  ListContratosQuery,
  UpdateContratoDto,
} from './contratos.dto';

@Injectable()
export class ContratosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly compliance: ComplianceService,
    private readonly webhooks: WebhooksService,
  ) {}

  /**
   * Cria contrato. Gera `numeroInterno` sequencial por tenant no formato
   * `CT-{ano}-{seq:5}`. Avalia compliance se já tiver tipo + valor.
   *
   * Suporta os 3 caminhos do fluxo "Novo contrato" (ver dto):
   *  - `partes[]` em-linha (qualquer caminho)
   *  - `estadoInicial` (caminho ① REPOSITORIO/ACTIVO/ASSINADO, ③ DRAFTING)
   *  - `documentoInicialId` (caminho ①: cria ContratoVersao
   *    direccao=ASSINADO_FINAL a apontar para o PDF do contrato
   *    existente)
   *
   * Persiste tudo numa única transaction — se qualquer passo falha,
   * o contrato inteiro fica rolled back. Evita estados pela metade
   * que ficariam visíveis na lista mas inválidos para drafting/IA.
   */
  async create(tenantId: string, actorUserId: string, dto: CreateContratoDto) {
    const {
      partes,
      documentoInicialId,
      estadoInicial,
      ...contratoFields
    } = dto;

    // Se o utilizador anexou um documento inicial, valida que
    // pertence ao tenant antes de abrir a transaction — falhar
    // cedo em vez de no meio da escrita.
    if (documentoInicialId) {
      const doc = await this.prisma.document.findFirst({
        where: { id: documentoInicialId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!doc) {
        throw new NotFoundException('Documento inicial não encontrado neste tenant');
      }
    }

    const estadoFinal = estadoInicial ?? ContratoEstado.INTAKE;

    const contrato = await this.prisma.$transaction(async (tx) => {
      // Race-safe: lock per-tenant + count + INSERT acontecem todos
      // dentro do mesmo xact. Lock liberta-se no commit.
      const numeroInterno = await ContratosService.gerarNumeroNaTransaction(
        tx,
        tenantId,
      );

      // Enforce quota de contratos. updateMany com guard atómico
      // `usado < limite` evita TOCTOU: 2 calls concorrentes ambas
      // verem `usado=49, limite=50`, ambas passarem o check, e ambas
      // criarem o 50º e 51º contrato sem o segundo falhar.
      //
      // Quotas com `contratosLimit < 0` (sentinel "unlimited") são
      // tratadas como sem limite — pulamos o increment guard mas
      // ainda registamos o contador para analytics.
      //
      // Tenants em trial sem UsageQuota ainda não estão a ser
      // gerados — para esses, o updateMany devolve 0 sem partir.
      // Aceitamos isto temporariamente; o seed de novos tenants
      // garante criação da UsageQuota.
      const quotaUpdate = await tx.usageQuota.updateMany({
        where: {
          tenantId,
          OR: [
            { contratosLimit: { lt: 0 } }, // unlimited
            { contratosUsado: { lt: tx.usageQuota.fields.contratosLimit } },
          ],
        },
        data: { contratosUsado: { increment: 1 } },
      });
      if (quotaUpdate.count === 0) {
        // Verifica se é mesmo limite atingido ou se a UsageQuota
        // simplesmente não existe (tenant em onboarding sem seed).
        const q = await tx.usageQuota.findUnique({
          where: { tenantId },
          select: { contratosLimit: true, contratosUsado: true },
        });
        if (q && q.contratosLimit >= 0 && q.contratosUsado >= q.contratosLimit) {
          throw new ForbiddenException(
            `Limite de contratos atingido (${q.contratosUsado}/${q.contratosLimit}). ` +
              `Faz upgrade do plano para criar mais.`,
          );
        }
        // q === null → tenant sem UsageQuota; permitimos avançar
        // (legacy / trial) sem incrementar
      }

      const c = await tx.contrato.create({
        data: {
          tenantId,
          numeroInterno,
          createdBy: actorUserId,
          ...contratoFields,
          estado: estadoFinal,
        },
      });

      // Partes em-linha
      if (partes && partes.length > 0) {
        for (const [i, p] of partes.entries()) {
          await tx.contratoParte.create({
            data: {
              contratoId: c.id,
              tenantId,
              entidadeId: p.entidadeId,
              papel: p.papel,
              representanteNome: p.representanteNome,
              representanteCargo: p.representanteCargo,
              representanteBI: p.representanteBI,
              ordem: p.ordem ?? i,
            },
          });
        }
      }

      // Versão inicial com documento existente (caminho ①)
      if (documentoInicialId) {
        await tx.contratoVersao.create({
          data: {
            contratoId: c.id,
            ordem: 1,
            criadoPor: actorUserId,
            versao: 'v1.0-importado',
            direccao: VersaoDireccao.ASSINADO_FINAL,
            documentId: documentoInicialId,
            comentario:
              'Contrato registado a partir de documento existente (carteira legada).',
            seloTemporal: new Date(),
          },
        });
      }

      // Evento CRIADO na timeline
      await tx.contratoEvento.create({
        data: {
          contratoId: c.id,
          tipo: ContratoEventoTipo.CRIADO,
          resumo:
            `Contrato ${numeroInterno} criado` +
            (estadoInicial && estadoInicial !== ContratoEstado.INTAKE
              ? ` em estado ${estadoInicial}`
              : '') +
            (documentoInicialId ? ' (com documento anexado)' : '') +
            (partes && partes.length > 0
              ? ` com ${partes.length} parte(s)`
              : ''),
          actorUserId,
          actorTipo: 'USER',
        },
      });

      // L.2: outbox dentro da tx — rollback se algo falhar a seguir
      await this.webhooks.enqueueEvent(
        tenantId,
        'contrato.criado',
        {
          contratoId: c.id,
          numeroInterno: c.numeroInterno,
          titulo: c.titulo,
          tipoId: c.tipoId,
          estado: c.estado,
          partesCount: partes?.length ?? 0,
          hasDocumentoInicial: !!documentoInicialId,
        },
        tx,
      );

      return c;
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.CREATE,
      entityType: EntityType.CONTRATO,
      entityId: contrato.id,
      afterData: contrato as object,
    });

    // HERANÇA (paridade): um contrato que ENTRA já num estado gerido
    // (registo de existente / importação: REPOSITORIO/ACTIVO/ASSINADO)
    // nunca passa por transitar(...ASSINADO), por isso a avaliação de
    // compliance tem de ser disparada aqui. Sem isto, um contrato
    // herdado — a porta principal de entrada — nunca recebe detecção de
    // Imposto de Selo / registos / BNA. Contratos criados em INTAKE/
    // DRAFTING recebem-na mais tarde, na transição para ASSINADO.
    if (
      estadoFinal === ContratoEstado.REPOSITORIO ||
      estadoFinal === ContratoEstado.ACTIVO ||
      estadoFinal === ContratoEstado.ASSINADO
    ) {
      await this.compliance.avaliarContrato(contrato.id, tenantId, actorUserId);
    }

    return contrato;
  }

  /**
   * Cria contrato a partir de um Template — caminho ③ do fluxo
   * "Novo contrato".
   *
   * Fluxo:
   *  1. Cria o contrato via `create()` (incluindo partes inline,
   *     estado inicial DRAFTING)
   *  2. Re-carrega contrato com tipo + partes + entidades resolvidos
   *     para o contexto dos placeholders
   *  3. Resolve placeholders no `template.conteudo`
   *  4. Cria primeira `ContratoVersao` com `corpoMarkdown` renderizado
   *     + `corpoHtml` (via renderer canónico)
   *  5. Tudo audit-logged + evento na timeline
   *
   * Não usamos transaction única (create() já tem a sua + chamadas
   * cross-module a webhooks/audit). Se o passo 3-4 falha, contrato
   * fica criado mas sem primeira versão — o utilizador vai para o
   * Editor vazio. Aceitável porque o fluxo é "criar+pré-popular";
   * compensar a perfeição com complexidade transactional não vale.
   */
  async createFromTemplate(
    tenantId: string,
    actorUserId: string,
    dto: CreateFromTemplateDto,
  ) {
    const { templateId, preencherPlaceholders, notaDrafting, ...contratoFields } = dto;

    // Valida template + tipo coerente (template é por tipoContrato)
    const template = await this.prisma.template.findFirst({
      where: { id: templateId, tenantId, isActive: true },
      select: {
        id: true,
        nome: true,
        versao: true,
        tipoId: true,
        conteudo: true,
      },
    });
    if (!template) {
      throw new NotFoundException('Template não encontrado neste tenant');
    }
    if (template.tipoId !== contratoFields.tipoId) {
      throw new BadRequestException(
        'Template e tipo de contrato escolhido não correspondem — escolhe um template para este tipo.',
      );
    }

    // Default razoável: contratos a partir de template começam em
    // DRAFTING (estão prontos a editar) salvo override do caller.
    const contrato = await this.create(tenantId, actorUserId, {
      ...contratoFields,
      estadoInicial: contratoFields.estadoInicial ?? ContratoEstado.DRAFTING,
    });

    // Resolve template → markdown final
    let markdown: string;
    if (preencherPlaceholders === false) {
      markdown = template.conteudo;
    } else {
      const full = await this.prisma.contrato.findUnique({
        where: { id: contrato.id },
        include: {
          tipo: { select: { codigo: true, nome: true, categoria: true } },
          partes: {
            orderBy: { ordem: 'asc' },
            include: {
              entidade: { select: { nome: true, nif: true, tipo: true } },
            },
          },
        },
      });
      if (!full || !full.tipo) {
        // Defensive: já criamos com tipoId obrigatório
        markdown = template.conteudo;
      } else {
        const ctx = buildContratoPlaceholderContext({
          titulo: full.titulo,
          descricao: full.descricao,
          valor: full.valor,
          moeda: full.moeda,
          leiAplicavel: full.leiAplicavel,
          foro: full.foro,
          dataAssinatura: full.dataAssinatura,
          dataInicioVigencia: full.dataInicioVigencia,
          dataTermo: full.dataTermo,
          renovacaoAutomatica: full.renovacaoAutomatica,
          janelaDenunciaDias: full.janelaDenunciaDias,
          tipo: full.tipo,
          partes: full.partes,
        });
        markdown = renderPlaceholders(template.conteudo, ctx);
      }
    }

    if (notaDrafting && notaDrafting.trim()) {
      markdown =
        markdown +
        `\n\n<!-- Nota de drafting (não imprime no PDF):\n${notaDrafting.trim()}\n-->`;
    }

    await this.prisma.contratoVersao.create({
      data: {
        contratoId: contrato.id,
        ordem: 1,
        criadoPor: actorUserId,
        versao: 'v1.0-template',
        direccao: 'INTERNA',
        comentario: `Gerado a partir do template "${template.nome}" v${template.versao}`,
        corpoMarkdown: markdown,
        corpoHtml: renderMarkdownToHtml(markdown),
        geradoPorIA: false,
      },
    });

    await this.prisma.contratoEvento.create({
      data: {
        contratoId: contrato.id,
        tipo: ContratoEventoTipo.VERSAO_CRIADA,
        resumo: `Versão inicial gerada a partir do template "${template.nome}"`,
        payload: { templateId: template.id, templateVersao: template.versao } as object,
        actorUserId,
        actorTipo: 'USER',
      },
    });

    return contrato;
  }

  async list(tenantId: string, q: ListContratosQuery) {
    // L.5: full-text search via tsvector + GIN. Quando q.q está
    // presente, usamos websearch_to_tsquery (sintaxe user-friendly:
    // suporta "frase exacta", -negação, OR) sobre o searchVector
    // pré-computado. O ILIKE %x% antigo era O(n) sequential scan e
    // não usava o índice GIN existente — degradação séria em 50k+
    // contratos/tenant.
    //
    // Quando q.q está set, fazemos pre-query SQL para obter IDs com
    // match, depois passamos os IDs para o findMany principal. Mantém
    // includes e contadores sem duplicar a lógica de filtros.
    let ftsIds: string[] | undefined;
    if (q.q && q.q.trim()) {
      const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM contratos
        WHERE tenant_id = ${tenantId}::uuid
          AND deleted_at IS NULL
          AND (
            search_vector @@ websearch_to_tsquery('portuguese', ${q.q})
            OR numero_interno ILIKE ${`%${q.q}%`}
          )
        ORDER BY ts_rank(search_vector, websearch_to_tsquery('portuguese', ${q.q})) DESC
        LIMIT 500
      `;
      ftsIds = rows.map((r) => r.id);
      if (ftsIds.length === 0) {
        return { data: [], nextCursor: null, total: 0 };
      }
    }

    const where: Prisma.ContratoWhereInput = {
      tenantId,
      deletedAt: null,
      ...(ftsIds && { id: { in: ftsIds } }),
      ...(q.estado && { estado: q.estado }),
      ...(q.origem && { origem: q.origem }),
      ...(q.tipoId && { tipoId: q.tipoId }),
      ...(q.carteiraId && { carteiraId: q.carteiraId }),
      ...(q.responsavelId && { responsavelId: q.responsavelId }),
      ...(q.contraparteId && {
        partes: { some: { entidadeId: q.contraparteId } },
      }),
    };

    if (q.expiraEm !== undefined) {
      // dataTermo é @db.Date (meia-noite UTC). Comparar o limite inferior
      // com `new Date()` (hora actual) excluía contratos que vencem HOJE
      // — perdia-se o último dia de aviso. Normaliza para meia-noite UTC.
      const hoje = new Date();
      hoje.setUTCHours(0, 0, 0, 0);
      const limite = new Date(hoje);
      limite.setUTCDate(limite.getUTCDate() + q.expiraEm);
      where.dataTermo = { lte: limite, gte: hoje };
    }

    const rows = await this.prisma.contrato.findMany({
      where,
      take: q.limit + 1,
      ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
      // Tuple [campoEscolhido, id] garante ordering determinístico
      // — sem isto, cursor pagination perde rows quando o campo
      // primário tem duplicados (e.g. createdAt em batch inserts).
      orderBy: [{ [q.orderBy]: q.orderDir }, { id: q.orderDir }],
      include: {
        tipo: { select: { codigo: true, nome: true, categoria: true } },
        carteira: { select: { id: true, nome: true } },
        // Primeira parte (por ordem) para a coluna "Contraparte" da
        // lista — select mínimo para não inchar o payload a 50k rows.
        partes: {
          select: { entidade: { select: { id: true, nome: true } } },
          orderBy: { ordem: 'asc' as const },
          take: 1,
        },
        _count: {
          select: {
            versoes: true,
            partes: true,
            actosRegulatorios: true,
            negociacaoPontos: true,
          },
        },
      },
    });
    const hasMore = rows.length > q.limit;
    const data = rows.slice(0, q.limit);
    return {
      data,
      nextCursor: hasMore ? data[data.length - 1].id : null,
      total: data.length,
    };
  }

  async get(tenantId: string, id: string) {
    const c = await this.prisma.contrato.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        tipo: true,
        carteira: true,
        partes: { include: { entidade: true } },
        // PERF (H2): `versoes` NÃO é consumido pelo payload do detalhe —
        // as tabs Editor/Versões buscam /contratos/:id/versoes à parte.
        // Incluí-lo aqui enviava todos os corpoMarkdown/corpoHtml (@db.Text)
        // a cada abertura do contrato. Removido.
        datasChave: { orderBy: { data: 'asc' } },
        obrigacoes: { include: { instancias: { orderBy: { dataPrevista: 'desc' }, take: 5 } } },
        actosRegulatorios: { orderBy: { prazoLimite: 'asc' } },
        negociacaoPontos: { orderBy: { createdAt: 'desc' } },
        terminacao: true,
        parent: { select: { id: true, numeroInterno: true, titulo: true } },
        adendas: { select: { id: true, numeroInterno: true, titulo: true, estado: true } },
      },
    });
    if (!c) throw new NotFoundException('Contrato not found');
    return c;
  }

  async update(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: UpdateContratoDto,
  ) {
    const before = await this.prisma.contrato.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!before) throw new NotFoundException('Contrato not found');

    // `UpdateContratoDto = CreateContratoDto.partial()` — strip os
    // campos que só fazem sentido na criação (partes inline, doc
    // inicial, estado inicial). Mutações destes recursos têm
    // endpoints próprios (/partes, /versoes, /transicao).
    const {
      partes: _partes,
      documentoInicialId: _docId,
      estadoInicial: _estado,
      ...updatableFields
    } = dto;
    void _partes; void _docId; void _estado;

    // AUDIT.11: defense in depth — usar updateMany com filtro
    // composto evita race em que o contrato é soft-deleted entre
    // findFirst e update. Atómico.
    const r = await this.prisma.contrato.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: updatableFields,
    });
    if (r.count === 0) {
      throw new NotFoundException('Contrato not found (race or deleted)');
    }
    const after = await this.prisma.contrato.findUniqueOrThrow({ where: { id } });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.UPDATE,
      entityType: EntityType.CONTRATO,
      entityId: id,
      beforeData: before as object,
      afterData: after as object,
    });

    // Re-avalia compliance se mudaram campos relevantes
    const camposCompliance = ['tipoId', 'valor', 'moeda', 'leiAplicavel', 'dataAssinatura'];
    if (camposCompliance.some((c) => c in dto)) {
      await this.compliance.avaliarContrato(id, tenantId, actorUserId);
    }

    return after;
  }

  /**
   * Transita estado validando o grafo da state machine. Cada transição:
   * - cria `ContratoEvento` na timeline
   * - escreve audit log
   * - dispara compliance engine em transições críticas (ASSINADO)
   */
  async transitar(
    tenantId: string,
    actorUserId: string,
    id: string,
    para: ContratoEstado,
    motivo?: string,
  ) {
    const contrato = await this.prisma.contrato.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!contrato) throw new NotFoundException('Contrato not found');

    if (!canTransition(contrato.estado as ContratoEstado, para)) {
      throw new BadRequestException(
        `Transição inválida: ${contrato.estado} → ${para}`,
      );
    }

    // AUDIT.11: updateMany com filtro composto tenantId+deletedAt.
    // M1: inclui `estado` actual no where (concorrência otimista) — se
    // outra transição alterou o estado entretanto, count===0 e abortamos
    // em vez de sobrepor com um evento contraditório.
    // Tx única (padrão do terminacao.service): estado + evento nunca
    // divergem — um crash entre os dois deixava o contrato a mudar de
    // estado sem rasto na timeline ("SEMPRE ContratoEvento").
    const updated = await this.prisma.$transaction(async (tx) => {
      const r = await tx.contrato.updateMany({
        where: { id, tenantId, deletedAt: null, estado: contrato.estado },
        data: { estado: para },
      });
      if (r.count === 0) {
        throw new ConflictException(
          'O estado do contrato mudou entretanto. Recarrega e tenta de novo.',
        );
      }
      await tx.contratoEvento.create({
        data: {
          contratoId: id,
          tipo: ContratoEventoTipo.ESTADO_ALTERADO,
          resumo: `${contrato.estado} → ${para}${motivo ? `: ${motivo}` : ''}`,
          payload: { de: contrato.estado, para, motivo } as object,
          actorUserId,
          actorTipo: 'USER',
        },
      });
      return tx.contrato.findUniqueOrThrow({ where: { id } });
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.STATE_TRANSITION,
      entityType: EntityType.CONTRATO,
      entityId: id,
      beforeData: { estado: contrato.estado },
      afterData: { estado: para, motivo },
    });

    // Dispara compliance em estados críticos
    if (para === ContratoEstado.ASSINADO || para === ContratoEstado.REPOSITORIO) {
      await this.compliance.avaliarContrato(id, tenantId, actorUserId);
    }

    // Webhook genérico para qualquer transição
    await this.webhooks.enqueueEvent(tenantId, 'contrato.estado_alterado', {
      contratoId: id,
      numeroInterno: contrato.numeroInterno,
      de: contrato.estado,
      para,
      motivo,
    });

    // Webhooks específicos para estados-chave
    if (para === ContratoEstado.ASSINADO) {
      await this.webhooks.enqueueEvent(tenantId, 'contrato.assinado', {
        contratoId: id,
        numeroInterno: contrato.numeroInterno,
      });
    }
    if (para === ContratoEstado.TERMINADO) {
      await this.webhooks.enqueueEvent(tenantId, 'contrato.terminado', {
        contratoId: id,
        numeroInterno: contrato.numeroInterno,
      });
    }

    return updated;
  }

  async softDelete(tenantId: string, actorUserId: string, id: string) {
    const c = await this.prisma.contrato.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!c) throw new NotFoundException('Contrato not found');
    // Tx única: soft-delete + evento + estorno de quota são atómicos.
    await this.prisma.$transaction(async (tx) => {
      // Guard de concorrência: se outro pedido apagou entretanto,
      // count===0 e não decrementamos a quota duas vezes.
      const r = await tx.contrato.updateMany({
        where: { id, tenantId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (r.count === 0) {
        throw new ConflictException('O contrato já foi removido.');
      }
      // M2: deixa rasto na timeline — um ACTIVO/ASSINADO não deve
      // desaparecer das listas sem registo no histórico do contrato.
      await tx.contratoEvento.create({
        data: {
          contratoId: id,
          tipo: ContratoEventoTipo.ARQUIVADO,
          resumo: `Contrato removido (estado à remoção: ${c.estado})`,
          payload: { estado: c.estado } as object,
          actorUserId,
          actorTipo: 'USER',
        },
      });
      // Estorno da quota (o create incrementa; sem isto, criar+apagar
      // em ciclo bloqueava o tenant no limite com meia dúzia de
      // contratos vivos). Filtro >0 evita ficar negativo.
      await tx.usageQuota.updateMany({
        where: { tenantId, contratosUsado: { gt: 0 } },
        data: { contratosUsado: { decrement: 1 } },
      });
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.DELETE,
      entityType: EntityType.CONTRATO,
      entityId: id,
      beforeData: { estado: c.estado },
    });
    return { ok: true };
  }

  // ─── Dashboards / agregados ──────────────────────────────────────

  /**
   * Dashboard executivo — alinhado com o redesign "Executive Overview".
   *
   * Devolve:
   *  - counters core: total, activos, expiraEm{30,90}, denunciaEm60, actos
   *  - porEstado: distribuição
   *  - tendência: count vs trimestre anterior (deltaPercent)
   *  - serie6m: contratos criados por mês nos últimos 6 meses (chart)
   *  - riscoExpiracaoCentavos: soma do valor dos contratos a expirar em 30d
   *  - recentes: últimos 5 contratos por updatedAt (tabela "Recent Activity")
   *
   * Tudo numa única passagem ao DB via Promise.all para minimizar
   * round-trips no painel inicial.
   */
  async dashboard(tenantId: string) {
    const agora = new Date();
    const em30 = new Date(); em30.setDate(em30.getDate() + 30);
    const em90 = new Date(); em90.setDate(em90.getDate() + 90);

    // Janela do trimestre anterior — usada para delta %
    const inicioTrimestreActual = new Date();
    inicioTrimestreActual.setMonth(inicioTrimestreActual.getMonth() - 3);
    const inicioTrimestreAnterior = new Date(inicioTrimestreActual);
    inicioTrimestreAnterior.setMonth(inicioTrimestreAnterior.getMonth() - 3);

    // Janela 6m para o chart
    const inicio6m = new Date();
    inicio6m.setMonth(inicio6m.getMonth() - 6);
    inicio6m.setDate(1);
    inicio6m.setHours(0, 0, 0, 0);

    const [
      porEstado,
      expiraEm30,
      expiraEm30Valor,
      expiraEm90,
      denunciaEm60,
      actosPendentes,
      total,
      activos,
      criadosTrimestreActual,
      criadosTrimestreAnterior,
      serie6mRaw,
      recentes,
    ] = await Promise.all([
      this.prisma.contrato.groupBy({
        by: ['estado'],
        where: { tenantId, deletedAt: null },
        _count: true,
      }),
      this.prisma.contrato.count({
        where: {
          tenantId,
          deletedAt: null,
          dataTermo: { gte: agora, lte: em30 },
        },
      }),
      this.prisma.contrato.aggregate({
        where: {
          tenantId,
          deletedAt: null,
          dataTermo: { gte: agora, lte: em30 },
        },
        _sum: { valor: true },
      }),
      this.prisma.contrato.count({
        where: {
          tenantId,
          deletedAt: null,
          dataTermo: { gte: agora, lte: em90 },
        },
      }),
      this.prisma.contratoDataChave.count({
        where: {
          contrato: { tenantId, deletedAt: null },
          tipo: { in: ['JANELA_DENUNCIA_INICIO', 'JANELA_DENUNCIA_FIM'] },
          data: { gte: agora, lte: new Date(agora.getTime() + 60 * 86_400_000) },
          cumprida: false,
        },
      }),
      this.prisma.contratoActoRegulatorio.count({
        where: {
          contrato: { tenantId, deletedAt: null },
          estado: { in: ['PENDENTE', 'EM_CURSO'] },
        },
      }),
      this.prisma.contrato.count({
        where: { tenantId, deletedAt: null },
      }),
      this.prisma.contrato.count({
        where: {
          tenantId,
          deletedAt: null,
          estado: 'ACTIVO',
        },
      }),
      this.prisma.contrato.count({
        where: {
          tenantId,
          deletedAt: null,
          createdAt: { gte: inicioTrimestreActual },
        },
      }),
      this.prisma.contrato.count({
        where: {
          tenantId,
          deletedAt: null,
          createdAt: { gte: inicioTrimestreAnterior, lt: inicioTrimestreActual },
        },
      }),
      // Série 6m via raw SQL — group by month, locale Portugal.
      this.prisma.$queryRaw<Array<{ mes: Date; count: bigint }>>`
        SELECT date_trunc('month', created_at) AS mes,
               COUNT(*)::bigint AS count
          FROM contratos
         WHERE tenant_id = ${tenantId}::uuid
           AND deleted_at IS NULL
           AND created_at >= ${inicio6m}
         GROUP BY 1
         ORDER BY 1
      `,
      this.prisma.contrato.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          numeroInterno: true,
          titulo: true,
          estado: true,
          updatedAt: true,
          responsavelId: true,
        },
      }),
    ]);

    // Delta % vs trimestre anterior
    const deltaPercent =
      criadosTrimestreAnterior === 0
        ? criadosTrimestreActual > 0
          ? 100
          : 0
        : Math.round(
            ((criadosTrimestreActual - criadosTrimestreAnterior) /
              criadosTrimestreAnterior) *
              100 *
              10,
          ) / 10;

    // Resolve nomes dos responsáveis em batch
    const userIds = recentes
      .map((c) => c.responsavelId)
      .filter((v): v is string => !!v);
    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, firstName: true, lastName: true, email: true },
          })
        : [];
    const userMap = new Map(
      users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim() || u.email]),
    );

    // Série 6m: garantir que todos os 6 buckets existem mesmo sem dados.
    const meses: { mes: string; mesIso: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      d.setMonth(d.getMonth() - i);
      const iso = d.toISOString().slice(0, 7); // YYYY-MM
      const hit = serie6mRaw.find(
        (r) => r.mes.toISOString().slice(0, 7) === iso,
      );
      meses.push({
        mes: d.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', ''),
        mesIso: iso,
        count: hit ? Number(hit.count) : 0,
      });
    }

    return {
      total,
      activos,
      porEstado: Object.fromEntries(porEstado.map((p) => [p.estado, p._count])),
      expiraEm30,
      expiraEm30RiscoCentavos:
        expiraEm30Valor._sum.valor !== null
          ? expiraEm30Valor._sum.valor.toString()
          : '0',
      expiraEm90,
      denunciaEm60,
      actosPendentes,
      tendencia: {
        criadosTrimestre: criadosTrimestreActual,
        criadosTrimestreAnterior,
        deltaPercent,
      },
      serie6m: meses,
      recentes: recentes.map((c) => ({
        id: c.id,
        numeroInterno: c.numeroInterno,
        titulo: c.titulo,
        estado: c.estado,
        updatedAt: c.updatedAt.toISOString(),
        responsavelNome: c.responsavelId
          ? userMap.get(c.responsavelId) ?? null
          : null,
      })),
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  /**
   * Gera `CT-{ano}-{seq:5}` único por tenant. Robusto contra:
   *  - Race condition (dois inserts simultâneos): TEM de ser chamado
   *    DENTRO da mesma transaction que faz o INSERT, e a transaction
   *    tem de adquirir um advisory lock per-tenant via
   *    `pg_advisory_xact_lock(hashtext(tenant_id))`. O lock é libertado
   *    automaticamente no commit/rollback.
   *  - Seed pré-existente com numeração custom (ex: `CT-2026-D0001`)
   *    — apenas conta entradas que casem com o formato canónico.
   *
   * NOTA: o método antigo (sem lock, com findUnique pre-flight) era
   * racy — entre o findUnique e o INSERT do caller, outra request
   * podia inserir o mesmo candidato e disparar UNIQUE constraint
   * violation. Este método usa `tx` para garantir que count + INSERT
   * são atómicos sob lock por tenant.
   */
  static async gerarNumeroNaTransaction(
    tx: Prisma.TransactionClient,
    tenantId: string,
  ): Promise<string> {
    const ano = new Date().getFullYear();
    const prefixo = `CT-${ano}-`;

    // Advisory lock — serializa gerarNumero+INSERT por tenant.
    // hashtext() devolve int4; ok para volumes esperados (não há
    // colisão fora de cenários cosmicamente improváveis em mesmo ano).
    // Lock é xact-scoped: liberta no fim da transaction.
    //
    // Usar $executeRaw e NÃO $queryRaw — pg_advisory_xact_lock
    // devolve void e o Prisma $queryRaw rebenta a tentar
    // deserializar "Failed to deserialize column of type 'void'".
    // $executeRaw foi feito para statements sem resultset.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`;

    // Contagem dentro do lock — leitura consistente.
    // PERF: LIKE com prefixo constante + 5 wildcards de 1 char é
    // SARGÁVEL (usa o índice único (tenant_id, numero_interno)). O
    // `prefixo + '_____'` casa exactamente `CT-AAAA-NNNNN` (13 chars) e
    // exclui adendas (`...-A01`, mais longas) pelo comprimento. Substitui
    // o antigo regex `~` que forçava avaliação por-linha em todo o tenant
    // (50k) dentro do lock de escrita.
    const matched = await tx.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM contratos
      WHERE tenant_id = ${tenantId}::uuid
        AND numero_interno LIKE ${`${prefixo}_____`}
    `;
    let seq = Number(matched[0]?.count ?? 0n) + 1;

    // Verifica unicidade até 10 tentativas. Em condições normais a
    // primeira tentativa é sempre OK pelo lock; este loop só protege
    // contra inconsistências históricas no padrão.
    for (let i = 0; i < 10; i++) {
      const candidato = `${prefixo}${seq.toString().padStart(5, '0')}`;
      const existe = await tx.contrato.findUnique({
        where: { tenantId_numeroInterno: { tenantId, numeroInterno: candidato } },
        select: { id: true },
      });
      if (!existe) return candidato;
      seq += 1;
    }
    // Fallback teórico — não deve acontecer com lock activo.
    return `${prefixo}${Date.now().toString(36).toUpperCase().slice(-5)}`;
  }
}
