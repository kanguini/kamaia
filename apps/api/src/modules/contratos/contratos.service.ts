import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  canTransition,
  ContratoEstado,
  ContratoEventoTipo,
  EntityType,
} from '@kamaia/shared-types';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ComplianceService } from '../compliance/compliance.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateContratoDto,
  ListContratosQuery,
  UpdateContratoDto,
} from './contratos.dto';

@Injectable()
export class ContratosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly compliance: ComplianceService,
  ) {}

  /**
   * Cria contrato. Gera `numeroInterno` sequencial por tenant no formato
   * `CT-{ano}-{seq:5}`. Avalia compliance se já tiver tipo + valor.
   */
  async create(tenantId: string, actorUserId: string, dto: CreateContratoDto) {
    const numeroInterno = await this.gerarNumero(tenantId);

    const contrato = await this.prisma.contrato.create({
      data: {
        tenantId,
        numeroInterno,
        createdBy: actorUserId,
        ...dto,
        estado: ContratoEstado.INTAKE,
      },
    });

    await this.prisma.contratoEvento.create({
      data: {
        contratoId: contrato.id,
        tipo: ContratoEventoTipo.CRIADO,
        resumo: `Contrato ${numeroInterno} criado`,
        actorUserId,
        actorTipo: 'USER',
      },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.CREATE,
      entityType: EntityType.CONTRATO,
      entityId: contrato.id,
      afterData: contrato as object,
    });

    return contrato;
  }

  async list(tenantId: string, q: ListContratosQuery) {
    const where: Prisma.ContratoWhereInput = {
      tenantId,
      deletedAt: null,
      ...(q.estado && { estado: q.estado }),
      ...(q.tipoId && { tipoId: q.tipoId }),
      ...(q.carteiraId && { carteiraId: q.carteiraId }),
      ...(q.responsavelId && { responsavelId: q.responsavelId }),
      ...(q.contraparteId && {
        partes: { some: { entidadeId: q.contraparteId } },
      }),
      ...(q.q && {
        OR: [
          { titulo: { contains: q.q, mode: 'insensitive' } },
          { numeroInterno: { contains: q.q, mode: 'insensitive' } },
          { descricao: { contains: q.q, mode: 'insensitive' } },
        ],
      }),
    };

    if (q.expiraEm !== undefined) {
      const limite = new Date();
      limite.setDate(limite.getDate() + q.expiraEm);
      where.dataTermo = { lte: limite, gte: new Date() };
    }

    const rows = await this.prisma.contrato.findMany({
      where,
      take: q.limit + 1,
      ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
      orderBy: { [q.orderBy]: q.orderDir },
      include: {
        tipo: { select: { codigo: true, nome: true, categoria: true } },
        carteira: { select: { id: true, nome: true } },
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
        versoes: { orderBy: { ordem: 'desc' } },
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

    const after = await this.prisma.contrato.update({
      where: { id },
      data: dto,
    });

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

    const updated = await this.prisma.contrato.update({
      where: { id },
      data: { estado: para },
    });

    await this.prisma.contratoEvento.create({
      data: {
        contratoId: id,
        tipo: ContratoEventoTipo.ESTADO_ALTERADO,
        resumo: `${contrato.estado} → ${para}${motivo ? `: ${motivo}` : ''}`,
        payload: { de: contrato.estado, para, motivo } as object,
        actorUserId,
        actorTipo: 'USER',
      },
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

    return updated;
  }

  async softDelete(tenantId: string, actorUserId: string, id: string) {
    const c = await this.prisma.contrato.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!c) throw new NotFoundException('Contrato not found');
    await this.prisma.contrato.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.DELETE,
      entityType: EntityType.CONTRATO,
      entityId: id,
    });
    return { ok: true };
  }

  // ─── Dashboards / agregados ──────────────────────────────────────

  async dashboard(tenantId: string) {
    const agora = new Date();
    const em30 = new Date(); em30.setDate(em30.getDate() + 30);
    const em90 = new Date(); em90.setDate(em90.getDate() + 90);

    const [porEstado, expiraEm30, expiraEm90, denunciaEm60, actosPendentes, total] =
      await Promise.all([
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
      ]);

    return {
      total,
      porEstado: Object.fromEntries(porEstado.map((p) => [p.estado, p._count])),
      expiraEm30,
      expiraEm90,
      denunciaEm60,
      actosPendentes,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  private async gerarNumero(tenantId: string): Promise<string> {
    const ano = new Date().getFullYear();
    const prefixo = `CT-${ano}-`;
    const ultimo = await this.prisma.contrato.findFirst({
      where: {
        tenantId,
        numeroInterno: { startsWith: prefixo },
      },
      orderBy: { numeroInterno: 'desc' },
      select: { numeroInterno: true },
    });
    let seq = 1;
    if (ultimo) {
      const m = /(\d+)$/.exec(ultimo.numeroInterno);
      if (m) seq = parseInt(m[1], 10) + 1;
    }
    return `${prefixo}${seq.toString().padStart(5, '0')}`;
  }
}
