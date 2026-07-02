import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  ContratoEventoTipo,
  EntityType,
  ObrigacaoPeriodicidade,
  ObrigacaoTipo,
  ObrigacaoInstanciaEstado,
} from '@kamaia/shared-types';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WebhooksService } from '../../webhooks/webhooks.service';

/**
 * Obrigações contratuais — pagamentos mensais, reportes trimestrais,
 * SLAs, garantias com validade. Cada `ContratoObrigacao` agrupa
 * `ContratoObrigacaoInstancia` (uma por ciclo).
 *
 * Geração de instâncias:
 *  - Na criação da obrigação, gera a primeira instância com base
 *    em `proximaData`
 *  - Quando uma instância é marcada CUMPRIDA, gera a seguinte
 *    automaticamente (se periodicidade != UNICA)
 *  - Job nocturno (alerts-scheduler) acorda os alertas configurados
 *
 * Princípio M.1: a feature já existia no schema mas dormente; este
 * service activa o ciclo end-to-end.
 */
@Injectable()
export class ContratoObrigacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly webhooks: WebhooksService,
  ) {}

  async list(tenantId: string, contratoId: string) {
    await this.assertContrato(tenantId, contratoId);
    return this.prisma.contratoObrigacao.findMany({
      where: { contratoId, isActive: true },
      include: {
        parteResponsavel: {
          include: { entidade: { select: { nome: true } } },
        },
        instancias: {
          orderBy: { dataPrevista: 'desc' },
          take: 12,
        },
      },
      orderBy: [{ proximaData: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(
    tenantId: string,
    actorUserId: string,
    contratoId: string,
    dto: {
      parteResponsavelId: string;
      tipo: ObrigacaoTipo;
      descricao: string;
      periodicidade: ObrigacaoPeriodicidade;
      proximaData?: Date;
      valorEsperado?: bigint;
      moeda?: string;
      alertaDias?: number[];
    },
  ) {
    await this.assertContrato(tenantId, contratoId);

    // Valida que a parte responsável pertence ao contrato
    const parte = await this.prisma.contratoParte.findFirst({
      where: { id: dto.parteResponsavelId, contratoId },
      select: { id: true },
    });
    if (!parte) {
      throw new BadRequestException(
        'Parte responsável não pertence a este contrato',
      );
    }

    const obrigacao = await this.prisma.$transaction(async (tx) => {
      const o = await tx.contratoObrigacao.create({
        data: {
          contratoId,
          parteResponsavelId: dto.parteResponsavelId,
          tipo: dto.tipo,
          descricao: dto.descricao,
          periodicidade: dto.periodicidade,
          proximaData: dto.proximaData,
          valorEsperado: dto.valorEsperado,
          moeda: dto.moeda,
          alertaDias: dto.alertaDias ?? [15, 5],
          isActive: true,
        },
      });

      // Cria primeira instância se proximaData foi indicada
      if (dto.proximaData) {
        await tx.contratoObrigacaoInstancia.create({
          data: {
            obrigacaoId: o.id,
            dataPrevista: dto.proximaData,
            estado: ObrigacaoInstanciaEstado.PENDENTE,
          },
        });
      }

      await tx.contratoEvento.create({
        data: {
          contratoId,
          tipo: ContratoEventoTipo.OBRIGACAO_ADICIONADA,
          resumo: `Obrigação adicionada: ${dto.descricao.slice(0, 80)}`,
          payload: {
            obrigacaoId: o.id,
            tipo: dto.tipo,
            periodicidade: dto.periodicidade,
          } as object,
          actorUserId,
          actorTipo: 'USER',
        },
      });

      return o;
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.CREATE,
      entityType: EntityType.CONTRATO,
      entityId: contratoId,
      afterData: { obrigacaoId: obrigacao.id, tipo: obrigacao.tipo } as object,
    });

    return obrigacao;
  }

  /**
   * Marca uma instância como CUMPRIDA. Se a obrigação tem
   * periodicidade != UNICA, gera automaticamente a próxima instância
   * baseada na periodicidade.
   */
  async cumprirInstancia(
    tenantId: string,
    actorUserId: string,
    contratoId: string,
    instanciaId: string,
    dto: {
      dataReal?: Date;
      valorReal?: bigint;
      comprovativoId?: string;
      observacoes?: string;
    },
  ) {
    await this.assertContrato(tenantId, contratoId);

    const instancia = await this.prisma.contratoObrigacaoInstancia.findFirst({
      where: {
        id: instanciaId,
        obrigacao: { contratoId },
      },
      include: { obrigacao: true },
    });
    if (!instancia) throw new NotFoundException('Instância não encontrada');

    if (dto.comprovativoId) {
      const doc = await this.prisma.document.findFirst({
        where: { id: dto.comprovativoId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!doc) throw new NotFoundException('Documento not found');
    }

    if (instancia.estado === ObrigacaoInstanciaEstado.CUMPRIDA) {
      // Idempotente — devolve estado actual
      return instancia;
    }

    const dataReal = dto.dataReal ?? new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      // Claim atómico: o filtro de estado DENTRO da tx fecha a race do
      // duplo-clique — o check idempotente lá fora é check-then-act e
      // duas tx simultâneas passavam ambas, gerando DUAS instâncias
      // seguintes (renda cobrada 2x/mês). count===0 → outro pedido
      // ganhou; devolve o estado actual sem duplicar nada.
      const claim = await tx.contratoObrigacaoInstancia.updateMany({
        where: {
          id: instanciaId,
          estado: { not: ObrigacaoInstanciaEstado.CUMPRIDA },
        },
        data: {
          estado: ObrigacaoInstanciaEstado.CUMPRIDA,
          dataReal,
          valorReal: dto.valorReal,
          comprovativoId: dto.comprovativoId,
          observacoes: dto.observacoes,
        },
      });
      if (claim.count === 0) {
        return tx.contratoObrigacaoInstancia.findUniqueOrThrow({
          where: { id: instanciaId },
        });
      }
      const u = await tx.contratoObrigacaoInstancia.findUniqueOrThrow({
        where: { id: instanciaId },
      });

      // Actualiza ultimaData da obrigação
      await tx.contratoObrigacao.update({
        where: { id: instancia.obrigacaoId },
        data: { ultimaData: dataReal },
      });

      // Gera próxima instância automaticamente se periodicidade != UNICA
      if (instancia.obrigacao.periodicidade !== ObrigacaoPeriodicidade.UNICA) {
        // A cadência deriva da data PREVISTA, não da data real de
        // pagamento — renda devida a dia 1 paga a dia 10 mantinha o
        // calendário a derivar mês após mês.
        const proxima = nextDate(instancia.dataPrevista, instancia.obrigacao.periodicidade as ObrigacaoPeriodicidade);
        await tx.contratoObrigacaoInstancia.create({
          data: {
            obrigacaoId: instancia.obrigacaoId,
            dataPrevista: proxima,
            estado: ObrigacaoInstanciaEstado.PENDENTE,
          },
        });
        await tx.contratoObrigacao.update({
          where: { id: instancia.obrigacaoId },
          data: { proximaData: proxima },
        });
      } else {
        // Única — desactiva a obrigação porque já cumprida
        await tx.contratoObrigacao.update({
          where: { id: instancia.obrigacaoId },
          data: { proximaData: null },
        });
      }

      await tx.contratoEvento.create({
        data: {
          contratoId,
          tipo: ContratoEventoTipo.OBRIGACAO_CUMPRIDA,
          resumo: `Obrigação cumprida: ${instancia.obrigacao.descricao.slice(0, 80)}`,
          payload: {
            obrigacaoId: instancia.obrigacaoId,
            instanciaId,
            dataReal: dataReal.toISOString(),
            valorReal: dto.valorReal?.toString(),
          } as object,
          actorUserId,
          actorTipo: 'USER',
        },
      });

      return u;
    });

    await this.webhooks.enqueueEvent(tenantId, 'obrigacao.cumprida', {
      contratoId,
      obrigacaoId: instancia.obrigacaoId,
      instanciaId,
      dataReal: dataReal.toISOString(),
    });

    return updated;
  }

  async dispensarInstancia(
    tenantId: string,
    _actorUserId: string,
    contratoId: string,
    instanciaId: string,
    dto: { motivo: string },
  ) {
    await this.assertContrato(tenantId, contratoId);
    if (!dto.motivo || dto.motivo.trim().length < 5) {
      throw new BadRequestException('Motivo obrigatório (min. 5 chars) para audit trail');
    }
    const instancia = await this.prisma.contratoObrigacaoInstancia.findFirst({
      where: { id: instanciaId, obrigacao: { contratoId } },
    });
    if (!instancia) throw new NotFoundException('Instância não encontrada');
    if (instancia.estado === ObrigacaoInstanciaEstado.CUMPRIDA) {
      throw new BadRequestException('Instância já cumprida — não pode ser dispensada');
    }
    return this.prisma.contratoObrigacaoInstancia.update({
      where: { id: instanciaId },
      data: {
        estado: ObrigacaoInstanciaEstado.DISPENSADA,
        observacoes: dto.motivo,
      },
    });
  }

  async desactivar(
    tenantId: string,
    _actorUserId: string,
    contratoId: string,
    obrigacaoId: string,
  ) {
    await this.assertContrato(tenantId, contratoId);
    const o = await this.prisma.contratoObrigacao.findFirst({
      where: { id: obrigacaoId, contratoId },
    });
    if (!o) throw new NotFoundException('Obrigação não encontrada');
    return this.prisma.contratoObrigacao.update({
      where: { id: obrigacaoId },
      data: { isActive: false },
    });
  }

  private async assertContrato(tenantId: string, contratoId: string) {
    const c = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Contrato not found');
  }
}

/**
 * Calcula a próxima data conforme periodicidade.
 * UNICA não chega aqui (caller faz early-return).
 *
 * Usa soma de meses com CLAMP do dia (mesmo padrão do
 * renovacao.service.addMonths): 31-Jan + 1 mês → 28/29-Fev. O setMonth
 * cru transbordava (31-Jan MENSAL → 2/3-Mar, saltando Fevereiro).
 */
function nextDate(from: Date, p: ObrigacaoPeriodicidade): Date {
  const mesesPorPeriodicidade: Partial<Record<ObrigacaoPeriodicidade, number>> = {
    [ObrigacaoPeriodicidade.MENSAL]: 1,
    [ObrigacaoPeriodicidade.BIMESTRAL]: 2,
    [ObrigacaoPeriodicidade.TRIMESTRAL]: 3,
    [ObrigacaoPeriodicidade.SEMESTRAL]: 6,
    [ObrigacaoPeriodicidade.ANUAL]: 12,
  };
  const meses = mesesPorPeriodicidade[p];
  if (!meses) return new Date(from); // UNICA não chega aqui

  const d = new Date(from);
  const dia = d.getUTCDate();
  const alvoMes = d.getUTCMonth() + meses;
  d.setUTCDate(1); // evita overflow intermédio
  d.setUTCMonth(alvoMes);
  const ultimoDia = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimoDia));
  return d;
}
