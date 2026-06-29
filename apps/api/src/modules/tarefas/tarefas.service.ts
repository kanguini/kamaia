import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  ActoEstado,
  AuditAction,
  EntityType,
  ItemTrabalho,
  ordenarTrabalho,
  TarefaEstado,
  TAREFA_PRIORIDADE_PESO,
} from '@kamaia/shared-types';
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

// Detalhe (drawer): inclui checklist + comentários. NÃO usado na lista do
// quadro (seria pesado por cartão).
const INCLUDE_DETALHE = {
  ...INCLUDE,
  checklist: { orderBy: { ordem: 'asc' } },
  comentarios: {
    orderBy: { createdAt: 'asc' },
    include: {
      autor: { select: { id: true, firstName: true, lastName: true } },
    },
  },
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
      include: INCLUDE_DETALHE,
    });
    if (!tarefa) throw new NotFoundException('Tarefa não encontrada');
    return tarefa;
  }

  // ─── Checklist ────────────────────────────────────────────────────

  async addChecklistItem(
    tenantId: string,
    actorUserId: string,
    id: string,
    texto: string,
  ) {
    await this.getRaw(tenantId, id);
    const last = await this.prisma.tarefaChecklistItem.findFirst({
      where: { tarefaId: id },
      orderBy: { ordem: 'desc' },
      select: { ordem: true },
    });
    await this.prisma.tarefaChecklistItem.create({
      data: { tarefaId: id, texto, ordem: (last?.ordem ?? -1) + 1 },
    });
    await this.auditTarefa(tenantId, actorUserId, id);
    return this.get(tenantId, id);
  }

  async updateChecklistItem(
    tenantId: string,
    actorUserId: string,
    id: string,
    itemId: string,
    dto: { texto?: string; concluido?: boolean },
  ) {
    await this.getRaw(tenantId, id);
    const { count } = await this.prisma.tarefaChecklistItem.updateMany({
      where: { id: itemId, tarefaId: id },
      data: {
        ...(dto.texto !== undefined && { texto: dto.texto }),
        ...(dto.concluido !== undefined && { concluido: dto.concluido }),
      },
    });
    if (count === 0) throw new NotFoundException('Item não encontrado');
    await this.auditTarefa(tenantId, actorUserId, id);
    return this.get(tenantId, id);
  }

  async removeChecklistItem(
    tenantId: string,
    actorUserId: string,
    id: string,
    itemId: string,
  ) {
    await this.getRaw(tenantId, id);
    await this.prisma.tarefaChecklistItem.deleteMany({
      where: { id: itemId, tarefaId: id },
    });
    await this.auditTarefa(tenantId, actorUserId, id);
    return this.get(tenantId, id);
  }

  // ─── Comentários ──────────────────────────────────────────────────

  async addComentario(
    tenantId: string,
    actorUserId: string,
    id: string,
    texto: string,
  ) {
    await this.getRaw(tenantId, id);
    await this.prisma.tarefaComentario.create({
      data: { tarefaId: id, autorId: actorUserId, texto },
    });
    await this.auditTarefa(tenantId, actorUserId, id);
    return this.get(tenantId, id);
  }

  async removeComentario(
    tenantId: string,
    actorUserId: string,
    id: string,
    comentarioId: string,
  ) {
    await this.getRaw(tenantId, id);
    // Só o autor pode apagar o seu comentário (defesa contra edição
    // cruzada; a role já restringe quem chega aqui).
    const { count } = await this.prisma.tarefaComentario.deleteMany({
      where: { id: comentarioId, tarefaId: id, autorId: actorUserId },
    });
    if (count === 0) {
      throw new NotFoundException('Comentário não encontrado ou não é seu');
    }
    await this.auditTarefa(tenantId, actorUserId, id);
    return this.get(tenantId, id);
  }

  private async auditTarefa(
    tenantId: string,
    actorUserId: string,
    id: string,
  ) {
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.UPDATE,
      entityType: EntityType.TAREFA,
      entityId: id,
    });
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

    // Coluna do quadro. Largar numa coluna-sistema (que mapeia um estado)
    // sincroniza o estado do ciclo de vida; numa coluna livre, o estado
    // mantém-se.
    let estadoAlvo = dto.estado;
    if (dto.colunaId !== undefined) {
      if (dto.colunaId === null) {
        data.coluna = { disconnect: true };
      } else {
        const col = await this.assertColuna(tenantId, dto.colunaId);
        data.coluna = { connect: { id: dto.colunaId } };
        // col.estado é o enum do Prisma; estadoAlvo é o de shared-types
        // (mesmos valores, tipos nominais distintos).
        if (col.estado && estadoAlvo === undefined) {
          estadoAlvo = col.estado as unknown as TarefaEstado;
        }
      }
    }

    if (estadoAlvo !== undefined && estadoAlvo !== atual.estado) {
      data.estado = estadoAlvo;
      if (estadoAlvo === TarefaEstado.CONCLUIDA) {
        data.concluidaEm = new Date();
        data.concluidaPor = actorUserId;
      } else if (
        atual.estado === TarefaEstado.CONCLUIDA &&
        (estadoAlvo === TarefaEstado.A_FAZER ||
          estadoAlvo === TarefaEstado.EM_CURSO)
      ) {
        // Só limpa o carimbo numa REABERTURA para trabalho activo —
        // cancelar uma concluída preserva o registo de que foi feita.
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

  // ─── Colunas do quadro ───────────────────────────────────────────

  async listColunas(tenantId: string) {
    await this.ensureColunas(tenantId);
    return this.prisma.tarefaColuna.findMany({
      where: { tenantId },
      orderBy: { ordem: 'asc' },
    });
  }

  async createColuna(
    tenantId: string,
    actorUserId: string,
    dto: { nome: string; cor?: string },
  ) {
    await this.ensureColunas(tenantId);
    const last = await this.prisma.tarefaColuna.findFirst({
      where: { tenantId },
      orderBy: { ordem: 'desc' },
      select: { ordem: true },
    });
    const col = await this.prisma.tarefaColuna.create({
      data: {
        tenantId,
        nome: dto.nome,
        cor: dto.cor,
        ordem: (last?.ordem ?? -1) + 1,
        sistema: false,
      },
    });
    await this.auditColuna(tenantId, actorUserId, col.id, AuditAction.CREATE);
    return this.listColunas(tenantId);
  }

  async updateColuna(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: { nome?: string; cor?: string | null; ordem?: number },
  ) {
    const { count } = await this.prisma.tarefaColuna.updateMany({
      where: { id, tenantId },
      data: {
        ...(dto.nome !== undefined && { nome: dto.nome }),
        ...(dto.cor !== undefined && { cor: dto.cor }),
        ...(dto.ordem !== undefined && { ordem: dto.ordem }),
      },
    });
    if (count === 0) throw new NotFoundException('Coluna não encontrada');
    await this.auditColuna(tenantId, actorUserId, id, AuditAction.UPDATE);
    return this.listColunas(tenantId);
  }

  async removeColuna(tenantId: string, actorUserId: string, id: string) {
    const col = await this.prisma.tarefaColuna.findFirst({
      where: { id, tenantId },
      select: { id: true, sistema: true },
    });
    if (!col) throw new NotFoundException('Coluna não encontrada');
    if (col.sistema) {
      throw new BadRequestException(
        'As colunas de sistema (A fazer / Em curso / Concluída) não podem ser eliminadas.',
      );
    }
    // As tarefas nesta coluna ficam com colunaId null (FK SetNull) e voltam
    // a agrupar pelo seu estado.
    await this.prisma.tarefaColuna.delete({ where: { id } });
    await this.auditColuna(tenantId, actorUserId, id, AuditAction.DELETE);
    return this.listColunas(tenantId);
  }

  /** Cria as 3 colunas-sistema na primeira utilização do quadro. */
  private async ensureColunas(tenantId: string) {
    const n = await this.prisma.tarefaColuna.count({ where: { tenantId } });
    if (n > 0) return;
    await this.prisma.tarefaColuna.createMany({
      data: [
        { tenantId, nome: 'A fazer', estado: TarefaEstado.A_FAZER, ordem: 0, sistema: true },
        { tenantId, nome: 'Em curso', estado: TarefaEstado.EM_CURSO, ordem: 1, sistema: true },
        { tenantId, nome: 'Concluída', estado: TarefaEstado.CONCLUIDA, ordem: 2, sistema: true },
      ],
      skipDuplicates: true,
    });
  }

  private async assertColuna(tenantId: string, id: string) {
    const col = await this.prisma.tarefaColuna.findFirst({
      where: { id, tenantId },
      select: { id: true, estado: true },
    });
    if (!col) throw new NotFoundException('Coluna vinculada não encontrada');
    return col;
  }

  private async auditColuna(
    tenantId: string,
    actorUserId: string,
    id: string,
    action: AuditAction,
  ) {
    await this.audit.log({
      tenantId,
      actorUserId,
      action,
      entityType: EntityType.TAREFA,
      entityId: id,
    });
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

  /**
   * "O meu trabalho": fila unificada e priorizada das MINHAS tarefas
   * abertas + os sinais derivados do ciclo de vida do tenant
   * (obrigações, compliance, datas-chave) até `dias` à frente (e os já
   * em atraso no último ano). A ordenação é pura (ordenarTrabalho).
   */
  async trabalho(tenantId: string, userId: string, dias = 90) {
    const agora = new Date();
    const to = new Date(agora.getTime() + dias * 86_400_000);
    const desde = new Date(agora.getTime() - 365 * 86_400_000);

    const [tarefas, obrigacoes, actos, datas] = await Promise.all([
      this.prisma.tarefa.findMany({
        where: {
          tenantId,
          deletedAt: null,
          responsavelId: userId,
          estado: { notIn: [TarefaEstado.CONCLUIDA, TarefaEstado.CANCELADA] },
        },
        include: { contrato: { select: { id: true, numeroInterno: true } } },
      }),
      this.prisma.contratoObrigacao.findMany({
        where: {
          contrato: { tenantId, deletedAt: null },
          isActive: true,
          proximaData: { gte: desde, lte: to },
        },
        include: { contrato: { select: { id: true, numeroInterno: true } } },
      }),
      this.prisma.contratoActoRegulatorio.findMany({
        where: {
          contrato: { tenantId, deletedAt: null },
          estado: { in: [ActoEstado.PENDENTE, ActoEstado.EM_CURSO] },
          prazoLimite: { gte: desde, lte: to },
        },
        include: { contrato: { select: { id: true, numeroInterno: true } } },
      }),
      this.prisma.contratoDataChave.findMany({
        where: {
          contrato: { tenantId, deletedAt: null },
          cumprida: false,
          data: { gte: desde, lte: to },
        },
        include: { contrato: { select: { id: true, numeroInterno: true } } },
      }),
    ]);

    const itens: ItemTrabalho[] = [];

    for (const t of tarefas) {
      itens.push({
        id: `tarefa-${t.id}`,
        tipo: 'tarefa',
        titulo: t.titulo,
        prazo: t.dataVencimento ? t.dataVencimento.toISOString() : null,
        contratoId: t.contratoId,
        contratoNumero: t.contrato?.numeroInterno ?? null,
        pesoPrioridade: TAREFA_PRIORIDADE_PESO[t.prioridade],
        href: t.contratoId ? `/contratos/${t.contratoId}` : '/tarefas',
      });
    }
    for (const o of obrigacoes) {
      if (!o.proximaData) continue;
      itens.push({
        id: `obr-${o.id}`,
        tipo: 'obrigacao',
        titulo: o.descricao.slice(0, 140),
        prazo: o.proximaData.toISOString(),
        contratoId: o.contrato.id,
        contratoNumero: o.contrato.numeroInterno,
        pesoPrioridade: 2,
        href: `/contratos/${o.contrato.id}`,
      });
    }
    for (const a of actos) {
      if (!a.prazoLimite) continue;
      itens.push({
        id: `acto-${a.id}`,
        tipo: 'compliance',
        titulo: a.tipo.replace(/_/g, ' '),
        prazo: a.prazoLimite.toISOString(),
        contratoId: a.contrato.id,
        contratoNumero: a.contrato.numeroInterno,
        pesoPrioridade: 2,
        href: `/contratos/${a.contrato.id}`,
      });
    }
    for (const d of datas) {
      itens.push({
        id: `dc-${d.id}`,
        tipo: 'data-chave',
        titulo: d.descricao || d.tipo.replace(/_/g, ' '),
        prazo: d.data.toISOString(),
        contratoId: d.contrato.id,
        contratoNumero: d.contrato.numeroInterno,
        pesoPrioridade: 1,
        href: `/contratos/${d.contrato.id}`,
      });
    }

    return { itens: ordenarTrabalho(itens, agora) };
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
      // deletedAt: null — um membro removido não pode ser responsável.
      where: { tenantId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!m) {
      throw new BadRequestException(
        'O responsável tem de ser um membro deste tenant.',
      );
    }
  }
}
