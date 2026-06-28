import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  AuditAction,
  ContratoEstado,
  ContratoOrigem,
  EntidadeTipo,
  EntityType,
  LinhaEstado,
  LoteEstado,
  MOEDAS_SUPORTADAS,
  PartePapel,
} from '@kamaia/shared-types';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ContratosService } from '../contratos/contratos.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddLinhaDto,
  CreateLoteDto,
  ListLotesQuery,
} from './importacao.dto';
import { ImportQueueService } from './import-queue.service';

/** Forma do `metadataInput` de cada linha de importação (vinda do CSV). */
interface LinhaMeta {
  titulo?: string;
  descricao?: string;
  valor?: string | number; // em kwanzas/unidade (convertido p/ centavos)
  moeda?: string;
  dataAssinatura?: string; // ISO YYYY-MM-DD
  dataTermo?: string;
  contraparte?: string; // nome da entidade
}

/** "12 500 000" / "12500000,50" → centavos (BigInt). undefined se vazio/inválido. */
function parseValorCentavos(v?: string | number): bigint | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const limpo = String(v).replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const n = Number(limpo);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return BigInt(Math.round(n * 100));
}

function parseData(s?: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

type MoedaSuportada = (typeof MOEDAS_SUPORTADAS)[number];
function normalizarMoeda(m?: string): MoedaSuportada | undefined {
  if (!m) return undefined;
  const up = m.trim().toUpperCase();
  return (MOEDAS_SUPORTADAS as readonly string[]).includes(up)
    ? (up as MoedaSuportada)
    : undefined;
}

@Injectable()
export class ImportacaoService implements OnModuleInit {
  private readonly logger = new Logger(ImportacaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly contratos: ContratosService,
    private readonly queue: ImportQueueService,
  ) {}

  onModuleInit(): void {
    // Regista o processamento de um lote na fila (BullMQ se houver Redis,
    // senão inline). Mantém uma única implementação — processarSincrono.
    this.queue.registerProcessor(({ loteId, tenantId, actorUserId }) =>
      this.processarSincrono(tenantId, actorUserId, loteId),
    );
  }

  async createLote(
    tenantId: string,
    actorUserId: string,
    dto: CreateLoteDto,
  ) {
    const lote = await this.prisma.importacaoLote.create({
      data: {
        tenantId,
        nome: dto.nome,
        iniciadoPor: actorUserId,
        estado: LoteEstado.EM_FILA,
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.CREATE,
      entityType: EntityType.IMPORTACAO_LOTE,
      entityId: lote.id,
      afterData: { id: lote.id, nome: lote.nome },
    });
    return lote;
  }

  async addLinha(
    tenantId: string,
    loteId: string,
    dto: AddLinhaDto,
  ) {
    const lote = await this.getLoteRaw(tenantId, loteId);
    const linha = await this.prisma.importacaoLinha.create({
      data: {
        loteId: lote.id,
        documentId: dto.documentId,
        metadataInput: dto.metadataInput as object | undefined,
        estado: LinhaEstado.PENDENTE,
      },
    });
    await this.prisma.importacaoLote.update({
      where: { id: lote.id },
      data: { totalLinhas: { increment: 1 } },
    });
    return linha;
  }

  async start(tenantId: string, actorUserId: string, loteId: string) {
    const lote = await this.getLoteRaw(tenantId, loteId);
    if (lote.estado !== LoteEstado.EM_FILA) {
      return { ok: false, estado: lote.estado };
    }
    await this.prisma.importacaoLote.update({
      where: { id: lote.id },
      data: { estado: LoteEstado.PROCESSANDO },
    });

    // Enfileira o lote. Com Redis, o Worker BullMQ processa em segundo
    // plano e o pedido devolve já (modo='queued'); o cliente faz polling
    // de GET /importacao/lotes/:id. Sem Redis, processa inline e só
    // devolve no fim (modo='inline') — o estado final já reflecte o
    // resultado. Em ambos os casos a lógica é processarSincrono.
    const modo = await this.queue.enqueue({ loteId, tenantId, actorUserId });

    return { ok: true, modo };
  }

  /**
   * Resolve a contraparte por nome: reutiliza a entidade existente
   * (match exacto, case-insensitive) ou cria uma PESSOA_COLECTIVA
   * mínima. Devolve-a já como parte CONTRAPARTE para o create().
   */
  private async resolverPartes(
    tenantId: string,
    contraparte?: string,
  ): Promise<Array<{ entidadeId: string; papel: PartePapel; ordem: number }>> {
    const nome = contraparte?.trim();
    if (!nome) return [];
    let entidade = await this.prisma.entidade.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        nome: { equals: nome, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (!entidade) {
      entidade = await this.prisma.entidade.create({
        data: { tenantId, tipo: EntidadeTipo.PESSOA_COLECTIVA, nome },
        select: { id: true },
      });
    }
    return [{ entidadeId: entidade.id, papel: PartePapel.CONTRAPARTE, ordem: 0 }];
  }

  private async processarSincrono(
    tenantId: string,
    actorUserId: string,
    loteId: string,
  ) {
    const linhas = await this.prisma.importacaoLinha.findMany({
      where: { loteId },
    });

    // Tipo de contrato genérico — primeiro disponível ao tenant (ou global).
    const tipo = await this.prisma.tipoContrato.findFirst({
      where: {
        OR: [{ tenantId }, { tenantId: null }],
        isActive: true,
      },
      orderBy: { tenantId: 'asc' },  // tenant-specific antes do global
    });

    let processadas = 0;
    let falhas = 0;

    // FIX auditoria: cada linha tem a sua tx; numeroInterno gerado
    // dentro da tx com advisory lock (igual ao ContratosService.create)
    // — evita duplicates de UNIQUE constraint em alto throughput
    for (const linha of linhas) {
      try {
        if (!tipo) {
          throw new Error('Nenhum TipoContrato disponível para o tenant');
        }
        const meta = (linha.metadataInput ?? {}) as LinhaMeta;
        // Contraparte por nome → resolve/cria a entidade e entra como parte.
        const partes = await this.resolverPartes(tenantId, meta.contraparte);
        const valorCentavos = parseValorCentavos(meta.valor);
        const dataAssinatura = parseData(meta.dataAssinatura);
        const dataTermo = parseData(meta.dataTermo);
        // PARIDADE: reutiliza ContratosService.create() em vez de um
        // INSERT cru — o contrato importado recebe a MESMA génese de um
        // criado: ContratoEvento(CRIADO), audit_log, webhook, dedução de
        // quota, validação do documento e avaliação de compliance (que
        // create() dispara para o estado REPOSITORIO). Antes, o bulk
        // produzia um contrato de segunda classe (timeline vazia, sem
        // audit, quota ignorada, compliance nunca corria).
        const contrato = await this.contratos.create(tenantId, actorUserId, {
          titulo: meta.titulo?.trim() || 'Contrato importado (a classificar)',
          ...(meta.descricao?.trim() ? { descricao: meta.descricao.trim() } : {}),
          tipoId: tipo.id,
          origem: ContratoOrigem.IMPORTADO_REPOSITORIO,
          estadoInicial: ContratoEstado.REPOSITORIO,
          renovacaoAutomatica: false,
          prazoIndeterminado: false,
          ...(valorCentavos !== undefined ? { valor: valorCentavos } : {}),
          ...((m) => (m ? { moeda: m } : {}))(normalizarMoeda(meta.moeda)),
          ...(dataAssinatura ? { dataAssinatura } : {}),
          ...(dataTermo ? { dataTermo } : {}),
          ...(partes.length ? { partes } : {}),
          ...(linha.documentId ? { documentoInicialId: linha.documentId } : {}),
        });
        await this.prisma.importacaoLinha.update({
          where: { id: linha.id },
          data: {
            estado: LinhaEstado.CRIADO,
            contratoId: contrato.id,
          },
        });
        processadas += 1;
      } catch (e) {
        this.logger.warn(
          `Linha ${linha.id} falhou: ${e instanceof Error ? e.message : e}`,
        );
        await this.prisma.importacaoLinha.update({
          where: { id: linha.id },
          data: {
            estado: LinhaEstado.FALHOU,
            erros: { mensagem: e instanceof Error ? e.message : String(e) },
          },
        });
        falhas += 1;
      }
    }

    const estadoFinal =
      falhas === 0
        ? LoteEstado.CONCLUIDO
        : processadas === 0
        ? LoteEstado.FALHOU
        : LoteEstado.CONCLUIDO_COM_ERROS;

    await this.prisma.importacaoLote.update({
      where: { id: loteId },
      data: {
        estado: estadoFinal,
        processadas,
        falhas,
        concluidoEm: new Date(),
      },
    });
  }

  async list(tenantId: string, q: ListLotesQuery) {
    const where: Prisma.ImportacaoLoteWhereInput = {
      tenantId,
      ...(q.estado && { estado: q.estado }),
    };
    const rows = await this.prisma.importacaoLote.findMany({
      where,
      take: q.limit + 1,
      ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
      orderBy: { iniciadoEm: 'desc' },
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
    const lote = await this.prisma.importacaoLote.findFirst({
      where: { id, tenantId },
      include: {
        linhas: {
          select: { id: true, estado: true, contratoId: true, erros: true },
        },
      },
    });
    if (!lote) throw new NotFoundException('Lote not found');
    const sumario = lote.linhas.reduce<Record<string, number>>((acc, l) => {
      acc[l.estado] = (acc[l.estado] ?? 0) + 1;
      return acc;
    }, {});
    return { ...lote, sumario };
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private async getLoteRaw(tenantId: string, id: string) {
    const lote = await this.prisma.importacaoLote.findFirst({
      where: { id, tenantId },
    });
    if (!lote) throw new NotFoundException('Lote not found');
    return lote;
  }

  // gerarNumero() removido em audit fix — agora delegamos a
  // ContratosService.gerarNumeroNaTransaction (race-safe, advisory lock)
}
