import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AuditAction, EntityType, TarefaEstado } from '@kamaia/shared-types';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateTarefaDto,
  ListTarefasQuery,
  UpdateTarefaDto,
} from './tarefas.dto';

const INCLUDE = {
  responsavel: {
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  },
  contrato: { select: { id: true, numeroInterno: true, titulo: true } },
} satisfies Prisma.TarefaInclude;

@Injectable()
export class TarefasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(tenantId: string, actorUserId: string, dto: CreateTarefaDto) {
    if (dto.contratoId) await this.assertContrato(tenantId, dto.contratoId);
    if (dto.entidadeId) await this.assertEntidade(tenantId, dto.entidadeId);
    if (dto.responsavelId) await this.assertMembro(tenantId, dto.responsavelId);

    const tarefa = await this.prisma.tarefa.create({
      data: {
        tenantId,
        titulo: dto.titulo,
        descricao: dto.descricao,
        prioridade: dto.prioridade,
        dataVencimento: dto.dataVencimento,
        responsavelId: dto.responsavelId,
        contratoId: dto.contratoId,
        entidadeId: dto.entidadeId,
        createdBy: actorUserId,
      },
      include: INCLUDE,
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.CREATE,
      entityType: EntityType.TAREFA,
      entityId: tarefa.id,
      afterData: { titulo: tarefa.titulo, responsavelId: tarefa.responsavelId },
    });

    return tarefa;
  }

  async list(tenantId: string, q: ListTarefasQuery) {
    const where: Prisma.TarefaWhereInput = {
      tenantId,
      deletedAt: null,
      ...(q.estado && { estado: q.estado }),
      ...(q.prioridade && { prioridade: q.prioridade }),
      ...(q.responsavelId && { responsavelId: q.responsavelId }),
      ...(q.contratoId && { contratoId: q.contratoId }),
    };

    // Por defeito esconde as fechadas (a não ser que se filtre por um
    // estado específico ou se peça explicitamente incluí-las).
    if (!q.incluirFechadas && !q.estado) {
      where.estado = {
        notIn: [TarefaEstado.CONCLUIDA, TarefaEstado.CANCELADA],
      };
    }

    if (q.vencidas) {
      where.dataVencimento = { lt: new Date() };
      where.estado = {
        notIn: [TarefaEstado.CONCLUIDA, TarefaEstado.CANCELADA],
      };
    }

    const rows = await this.prisma.tarefa.findMany({
      where,
      take: q.limit + 1,
      ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
      orderBy: [{ [q.orderBy]: q.orderDir }, { id: q.orderDir }],
      include: INCLUDE,
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
    const tarefa = await this.prisma.tarefa.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: INCLUDE,
    });
    if (!tarefa) throw new NotFoundException('Tarefa não encontrada');
    return tarefa;
  }

  async update(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: UpdateTarefaDto,
  ) {
    const atual = await this.getRaw(tenantId, id);

    if (dto.contratoId) await this.assertContrato(tenantId, dto.contratoId);
    if (dto.entidadeId) await this.assertEntidade(tenantId, dto.entidadeId);
    if (dto.responsavelId) await this.assertMembro(tenantId, dto.responsavelId);

    // Conclusão: carimba quem/quando. Reabertura: limpa esses campos.
    const data: Prisma.TarefaUpdateInput = {
      ...(dto.titulo !== undefined && { titulo: dto.titulo }),
      ...(dto.descricao !== undefined && { descricao: dto.descricao }),
      ...(dto.prioridade !== undefined && { prioridade: dto.prioridade }),
      ...(dto.dataVencimento !== undefined && { dataVencimento: dto.dataVencimento }),
      ...(dto.responsavelId !== undefined && {
        responsavel: dto.responsavelId
          ? { connect: { id: dto.responsavelId } }
          : { disconnect: true },
      }),
      ...(dto.contratoId !== undefined && {
        contrato: dto.contratoId
          ? { connect: { id: dto.contratoId } }
          : { disconnect: true },
      }),
      ...(dto.entidadeId !== undefined && { entidadeId: dto.entidadeId }),
    };

    if (dto.estado !== undefined && dto.estado !== atual.estado) {
      data.estado = dto.estado;
      if (dto.estado === TarefaEstado.CONCLUIDA) {
        data.concluidaEm = new Date();
        data.concluidaPor = actorUserId;
      } else if (atual.estado === TarefaEstado.CONCLUIDA) {
        data.concluidaEm = null;
        data.concluidaPor = null;
      }
    }

    const tarefa = await this.prisma.tarefa.update({
      where: { id },
      data,
      include: INCLUDE,
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.UPDATE,
      entityType: EntityType.TAREFA,
      entityId: id,
      afterData: { estado: tarefa.estado, responsavelId: tarefa.responsavelId },
    });

    return tarefa;
  }

  /** Atalho para concluir uma tarefa. */
  async concluir(tenantId: string, actorUserId: string, id: string) {
    return this.update(tenantId, actorUserId, id, {
      estado: TarefaEstado.CONCLUIDA,
    });
  }

  async softDelete(tenantId: string, actorUserId: string, id: string) {
    await this.getRaw(tenantId, id);
    await this.prisma.tarefa.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.DELETE,
      entityType: EntityType.TAREFA,
      entityId: id,
    });
    return { ok: true };
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  /** Tarefas abertas com prazo dentro da janela — fonte da Agenda e do
   *  "O meu trabalho". Reutilizado por outros módulos. */
  async listAbertasComPrazo(tenantId: string, from: Date, to: Date) {
    return this.prisma.tarefa.findMany({
      where: {
        tenantId,
        deletedAt: null,
        estado: { notIn: [TarefaEstado.CONCLUIDA, TarefaEstado.CANCELADA] },
        dataVencimento: { gte: from, lte: to },
      },
      include: INCLUDE,
      orderBy: { dataVencimento: 'asc' },
    });
  }

  private async getRaw(tenantId: string, id: string) {
    const tarefa = await this.prisma.tarefa.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true, estado: true },
    });
    if (!tarefa) throw new NotFoundException('Tarefa não encontrada');
    return tarefa;
  }

  private async assertContrato(tenantId: string, contratoId: string) {
    const c = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Contrato vinculado não encontrado');
  }

  private async assertEntidade(tenantId: string, entidadeId: string) {
    const e = await this.prisma.entidade.findFirst({
      where: { id: entidadeId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!e) throw new NotFoundException('Entidade vinculada não encontrada');
  }

  /** O responsável tem de ser membro do tenant. */
  private async assertMembro(tenantId: string, userId: string) {
    const m = await this.prisma.membership.findFirst({
      where: { tenantId, userId },
      select: { id: true },
    });
    if (!m) {
      throw new BadRequestException(
        'O responsável tem de ser um membro deste tenant.',
      );
    }
  }
}
