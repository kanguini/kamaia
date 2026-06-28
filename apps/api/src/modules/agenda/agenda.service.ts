import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActoEstado,
  AuditAction,
  EntityType,
} from '@kamaia/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TarefasService } from '../tarefas/tarefas.service';
import { CreateAgendaEventoDto, UpdateAgendaEventoDto } from './agenda.dto';

/**
 * Item unificado da agenda. `origem` distingue eventos próprios
 * (editáveis) das datas derivadas de contratos (read-only) — estas
 * dão à agenda valor imediato mesmo antes de o utilizador criar
 * qualquer evento: a carteira já preenche o calendário.
 */
export interface AgendaItem {
  id: string;
  origem: 'evento' | 'data-chave' | 'acto' | 'obrigacao' | 'tarefa';
  titulo: string;
  inicio: string;
  fim: string | null;
  diaInteiro: boolean;
  tipo: string;
  cor: string | null;
  contratoId: string | null;
  contratoNumero: string | null;
  editavel: boolean;
}

@Injectable()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tarefas: TarefasService,
  ) {}

  /**
   * Agrega, na janela [from, to]:
   *  - eventos próprios (AgendaEvento)
   *  - datas-chave de contratos não cumpridas
   *  - actos regulatórios com prazo (pendentes/em curso)
   *  - obrigações com próxima data
   */
  async list(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<{ items: AgendaItem[] }> {
    const [eventos, datasChave, actos, obrigacoes, tarefasAbertas] = await Promise.all([
      this.prisma.agendaEvento.findMany({
        where: {
          tenantId,
          deletedAt: null,
          inicio: { gte: from, lte: to },
        },
        include: { contrato: { select: { numeroInterno: true } } },
        orderBy: { inicio: 'asc' },
      }),
      this.prisma.contratoDataChave.findMany({
        where: {
          contrato: { tenantId, deletedAt: null },
          cumprida: false,
          data: { gte: from, lte: to },
        },
        include: { contrato: { select: { id: true, numeroInterno: true } } },
      }),
      this.prisma.contratoActoRegulatorio.findMany({
        where: {
          contrato: { tenantId, deletedAt: null },
          estado: { in: [ActoEstado.PENDENTE, ActoEstado.EM_CURSO] },
          prazoLimite: { gte: from, lte: to },
        },
        include: { contrato: { select: { id: true, numeroInterno: true } } },
      }),
      this.prisma.contratoObrigacao.findMany({
        where: {
          contrato: { tenantId, deletedAt: null },
          isActive: true,
          proximaData: { gte: from, lte: to },
        },
        include: { contrato: { select: { id: true, numeroInterno: true } } },
      }),
      // Tarefas abertas com prazo na janela — o trabalho humano entra
      // na agenda a par dos sinais derivados.
      this.tarefas.listAbertasComPrazo(tenantId, from, to),
    ]);

    const items: AgendaItem[] = [];

    for (const e of eventos) {
      items.push({
        id: e.id,
        origem: 'evento',
        titulo: e.titulo,
        inicio: e.inicio.toISOString(),
        fim: e.fim ? e.fim.toISOString() : null,
        diaInteiro: e.diaInteiro,
        tipo: e.tipo,
        cor: e.cor,
        contratoId: e.contratoId,
        contratoNumero: e.contrato?.numeroInterno ?? null,
        editavel: true,
      });
    }

    for (const d of datasChave) {
      items.push({
        id: `dc-${d.id}`,
        origem: 'data-chave',
        titulo: d.descricao || prettyDataChave(d.tipo),
        inicio: d.data.toISOString(),
        fim: null,
        diaInteiro: true,
        tipo: d.tipo,
        cor: null,
        contratoId: d.contrato.id,
        contratoNumero: d.contrato.numeroInterno,
        editavel: false,
      });
    }

    for (const a of actos) {
      if (!a.prazoLimite) continue;
      items.push({
        id: `acto-${a.id}`,
        origem: 'acto',
        titulo: `Prazo — ${prettyActo(a.tipo)}`,
        inicio: a.prazoLimite.toISOString(),
        fim: null,
        diaInteiro: true,
        tipo: a.tipo,
        cor: null,
        contratoId: a.contrato.id,
        contratoNumero: a.contrato.numeroInterno,
        editavel: false,
      });
    }

    for (const o of obrigacoes) {
      if (!o.proximaData) continue;
      items.push({
        id: `obr-${o.id}`,
        origem: 'obrigacao',
        titulo: o.descricao.slice(0, 120),
        inicio: o.proximaData.toISOString(),
        fim: null,
        diaInteiro: true,
        tipo: o.tipo,
        cor: null,
        contratoId: o.contrato.id,
        contratoNumero: o.contrato.numeroInterno,
        editavel: false,
      });
    }

    for (const t of tarefasAbertas) {
      if (!t.dataVencimento) continue;
      items.push({
        id: `tarefa-${t.id}`,
        origem: 'tarefa',
        titulo: t.titulo,
        inicio: t.dataVencimento.toISOString(),
        fim: null,
        diaInteiro: true,
        tipo: t.prioridade,
        cor: null,
        contratoId: t.contratoId,
        contratoNumero: t.contrato?.numeroInterno ?? null,
        editavel: false,
      });
    }

    items.sort((a, b) => a.inicio.localeCompare(b.inicio));
    return { items };
  }

  async create(
    tenantId: string,
    actorUserId: string,
    dto: CreateAgendaEventoDto,
  ) {
    if (dto.contratoId) await this.assertContrato(tenantId, dto.contratoId);
    if (dto.entidadeId) await this.assertEntidade(tenantId, dto.entidadeId);

    const evento = await this.prisma.agendaEvento.create({
      data: {
        tenantId,
        titulo: dto.titulo,
        descricao: dto.descricao,
        tipo: dto.tipo,
        inicio: dto.inicio,
        fim: dto.fim,
        diaInteiro: dto.diaInteiro,
        local: dto.local,
        cor: dto.cor,
        contratoId: dto.contratoId,
        entidadeId: dto.entidadeId,
        createdBy: actorUserId,
      },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.CREATE,
      entityType: EntityType.AGENDA_EVENTO,
      entityId: evento.id,
      afterData: evento as unknown as Record<string, unknown>,
    });

    return evento;
  }

  async update(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: UpdateAgendaEventoDto,
  ) {
    const before = await this.assertEvento(tenantId, id);
    if (dto.contratoId) await this.assertContrato(tenantId, dto.contratoId);
    if (dto.entidadeId) await this.assertEntidade(tenantId, dto.entidadeId);

    const evento = await this.prisma.agendaEvento.update({
      where: { id },
      data: {
        ...(dto.titulo !== undefined && { titulo: dto.titulo }),
        ...(dto.descricao !== undefined && { descricao: dto.descricao }),
        ...(dto.tipo !== undefined && { tipo: dto.tipo }),
        ...(dto.inicio !== undefined && { inicio: dto.inicio }),
        ...(dto.fim !== undefined && { fim: dto.fim }),
        ...(dto.diaInteiro !== undefined && { diaInteiro: dto.diaInteiro }),
        ...(dto.local !== undefined && { local: dto.local }),
        ...(dto.cor !== undefined && { cor: dto.cor }),
        ...(dto.contratoId !== undefined && { contratoId: dto.contratoId }),
        ...(dto.entidadeId !== undefined && { entidadeId: dto.entidadeId }),
      },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.UPDATE,
      entityType: EntityType.AGENDA_EVENTO,
      entityId: id,
      beforeData: before as unknown as Record<string, unknown>,
      afterData: evento as unknown as Record<string, unknown>,
    });

    return evento;
  }

  async remove(tenantId: string, actorUserId: string, id: string) {
    const before = await this.assertEvento(tenantId, id);
    await this.prisma.agendaEvento.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.DELETE,
      entityType: EntityType.AGENDA_EVENTO,
      entityId: id,
      beforeData: before as unknown as Record<string, unknown>,
    });

    return { ok: true };
  }

  private async assertEvento(tenantId: string, id: string) {
    const e = await this.prisma.agendaEvento.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!e) throw new NotFoundException('Evento não encontrado');
    return e;
  }

  private async assertContrato(tenantId: string, contratoId: string) {
    const c = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new ForbiddenException('Contrato inválido para este tenant');
  }

  private async assertEntidade(tenantId: string, entidadeId: string) {
    const e = await this.prisma.entidade.findFirst({
      where: { id: entidadeId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!e) throw new ForbiddenException('Entidade inválida para este tenant');
  }
}

function prettyDataChave(tipo: string): string {
  const map: Record<string, string> = {
    ASSINATURA: 'Assinatura',
    INICIO_VIGENCIA: 'Início de vigência',
    TERMO: 'Termo do contrato',
    RENOVACAO_AUTOMATICA: 'Renovação automática',
    JANELA_DENUNCIA_INICIO: 'Início da janela de denúncia',
    JANELA_DENUNCIA_FIM: 'Fim da janela de denúncia',
    PAGAMENTO: 'Pagamento',
    ENTREGA: 'Entrega',
    REVISAO_PRECO: 'Revisão de preço',
    MILESTONE: 'Milestone',
    GARANTIA_VALIDADE: 'Validade da garantia',
    SEGURO_VALIDADE: 'Validade do seguro',
    OUTRO: 'Data-chave',
  };
  return map[tipo] ?? 'Data-chave';
}

function prettyActo(tipo: string): string {
  const map: Record<string, string> = {
    IMPOSTO_SELO: 'Imposto de Selo',
    REGISTO_COMERCIAL: 'Registo Comercial',
    REGISTO_PREDIAL: 'Registo Predial',
    REGISTO_AUTOMOVEL: 'Registo Automóvel',
    REGISTO_IP_IAPI: 'Registo IAPI',
    BNA_AUTORIZACAO: 'Autorização BNA',
    BNA_REGISTO: 'Registo BNA',
    AGT_RETENCAO_IRT: 'Retenção IRT (AGT)',
    AGT_OUTRO: 'Acto AGT',
    RECONHECIMENTO_NOTARIAL: 'Reconhecimento notarial',
    TRADUCAO_JURAMENTADA: 'Tradução juramentada',
    SECTORIAL_OUTRO: 'Acto sectorial',
  };
  return map[tipo] ?? 'Acto regulatório';
}
