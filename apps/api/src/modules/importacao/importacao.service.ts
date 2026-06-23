import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  ContratoEstado,
  ContratoOrigem,
  EntityType,
  LinhaEstado,
  LoteEstado,
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

@Injectable()
export class ImportacaoService {
  private readonly logger = new Logger(ImportacaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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

    // ────────────────────────────────────────────────────────────────
    // STUB de worker síncrono. Em produção este enfileiramento será
    // substituído por um job BullMQ:
    //
    //   await this.queue.add('importacao-lote', { loteId }, { jobId: loteId });
    //
    // O worker fará OCR (Tesseract/Textract) por linha, extracção IA
    // (Claude) dos campos do contrato, validação humana opcional e por
    // fim a criação do `Contrato` em estado REPOSITORIO → ACTIVO.
    // ────────────────────────────────────────────────────────────────
    await this.processarSincrono(tenantId, actorUserId, loteId);

    return { ok: true };
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
        await this.prisma.$transaction(async (tx) => {
          const numeroInterno = await ContratosService.gerarNumeroNaTransaction(
            tx,
            tenantId,
          );
          const titulo =
            (linha.metadataInput as { titulo?: string } | null)?.titulo ??
            `Importado ${numeroInterno}`;
          const contrato = await tx.contrato.create({
            data: {
              tenantId,
              numeroInterno,
              titulo,
              tipoId: tipo.id,
              estado: ContratoEstado.REPOSITORIO,
              origem: ContratoOrigem.IMPORTADO_REPOSITORIO,
              createdBy: actorUserId,
            },
          });
          await tx.importacaoLinha.update({
            where: { id: linha.id },
            data: {
              estado: LinhaEstado.CRIADO,
              contratoId: contrato.id,
            },
          });
          // Linka documentId se fornecido na metadata
          if (linha.documentId) {
            await tx.contratoVersao.create({
              data: {
                contratoId: contrato.id,
                ordem: 1,
                criadoPor: actorUserId,
                versao: 'v1.0-importado',
                direccao: 'ASSINADO_FINAL',
                documentId: linha.documentId,
                comentario: 'Importação em lote — documento original anexado',
                seloTemporal: new Date(),
              },
            });
          }
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
