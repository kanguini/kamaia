import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  AuditAction,
  ContratoEstado,
  ContratoEventoTipo,
  DataChaveTipo,
  EntityType,
  NotificationChannel,
  NotificationType,
} from '@kamaia/shared-types';
import { AuditService } from '../../audit/audit.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WebhooksService } from '../../webhooks/webhooks.service';

/**
 * RenovacaoEngineService — motor de renovação tácita de contratos.
 *
 * Cron diário (09:00 WAT por defeito, depois do AlertsScheduler) varre:
 *   - Contratos com `renovacaoAutomatica = true`
 *   - Estado `ACTIVO`
 *   - `dataTermo` ≤ hoje
 *   - `denunciaEm` nulo (denúncia tempestiva bloqueia)
 *
 * Para cada match, executa renovação tácita:
 *   1. Calcula novo `dataTermo = old + prazoRenovacaoMeses`
 *      (se `prazoRenovacaoMeses` for nulo, falha gracefully e
 *      emite RENOVACAO_FALHOU para acção manual)
 *   2. Update `contrato.dataTermo`
 *   3. Cria `ContratoDataChave(TERMO)` para o novo período
 *   4. Cria `ContratoEvento(RENOVACAO_EXECUTADA)`
 *   5. Audit log + notification (responsavel + ADMINs) + webhook
 *
 * Toda a sequência corre numa transacção única por contrato — se
 * falhar a meio, fica como estava e a próxima passagem do cron tenta
 * de novo.
 *
 * **Idempotência:** o filtro `dataTermo ≤ hoje` deixa de matchar
 * assim que o novo termo é gravado, por isso não há perigo de
 * renovar duas vezes no mesmo dia. Adicionalmente, verificamos
 * eventos `RENOVACAO_EXECUTADA` recentes (últimas 24h) e saltamos.
 */
@Injectable()
export class RenovacaoEngineService {
  private readonly logger = new Logger(RenovacaoEngineService.name);
  private inFlight = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly webhooks: WebhooksService,
  ) {}

  @Cron(process.env.CRON_RENOVACAO ?? '0 9 * * *')
  async tick() {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      const { renovados, falhas } = await this.runOnce();
      this.logger.log(
        `RenovacaoEngine: ${renovados} renovados, ${falhas} falhas`,
      );
    } catch (e) {
      this.logger.error(
        `RenovacaoEngine falhou: ${e instanceof Error ? e.stack : e}`,
      );
    } finally {
      this.inFlight = false;
    }
  }

  /**
   * Processa renovações. Sem `tenantId` corre globalmente (uso do cron
   * SYSTEM); com `tenantId` fica restrito a esse tenant — o endpoint
   * admin DEVE passá-lo para não disparar renovações de outros tenants.
   */
  async runOnce(tenantId?: string): Promise<{ renovados: number; falhas: number }> {
    const hoje = this.hoje();
    const candidatos = await this.prisma.contrato.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        renovacaoAutomatica: true,
        denunciaEm: null,
        estado: ContratoEstado.ACTIVO,
        dataTermo: { lte: hoje },
        deletedAt: null,
      },
      select: {
        id: true,
        tenantId: true,
        numeroInterno: true,
        titulo: true,
        dataTermo: true,
        prazoRenovacaoMeses: true,
        responsavelId: true,
      },
    });

    let renovados = 0;
    let falhas = 0;
    for (const c of candidatos) {
      // Skip se já renovado nas últimas 24h (idempotência defensiva)
      const recente = await this.prisma.contratoEvento.findFirst({
        where: {
          contratoId: c.id,
          tipo: ContratoEventoTipo.RENOVACAO_EXECUTADA,
          createdAt: { gte: new Date(Date.now() - 24 * 3600_000) },
        },
        select: { id: true },
      });
      if (recente) continue;

      try {
        await this.renovarUm(c);
        renovados++;
      } catch (e) {
        falhas++;
        this.logger.warn(
          `Renovação falhou para ${c.numeroInterno}: ${e instanceof Error ? e.message : e}`,
        );
        await this.registarFalha(c, e instanceof Error ? e.message : String(e));
      }
    }
    return { renovados, falhas };
  }

  /**
   * Renova um contrato. Tudo dentro de uma transacção atómica.
   *
   * Side-effects fora da transacção (audit, notification, webhook)
   * só correm depois do commit, para evitar disparar eventos sobre
   * estado que afinal foi rollbacked.
   */
  private async renovarUm(c: {
    id: string;
    tenantId: string;
    numeroInterno: string;
    titulo: string;
    dataTermo: Date | null;
    prazoRenovacaoMeses: number | null;
    responsavelId: string | null;
  }): Promise<void> {
    if (!c.dataTermo) {
      throw new BadRequestException('Contrato sem dataTermo — não renovável.');
    }
    if (!c.prazoRenovacaoMeses || c.prazoRenovacaoMeses <= 0) {
      throw new BadRequestException(
        'Contrato sem prazoRenovacaoMeses — completar antes de renovar.',
      );
    }

    const dataTermoAntiga = new Date(c.dataTermo);
    const dataTermoNova = this.addMonths(dataTermoAntiga, c.prazoRenovacaoMeses);

    const destinatarios = await this.resolverDestinatarios(
      c.tenantId,
      c.responsavelId,
    );
    const titulo = `Contrato ${c.numeroInterno} renovado automaticamente`;
    const conteudo =
      `${c.titulo}\n` +
      `Novo termo: ${dataTermoNova.toISOString().slice(0, 10)}\n` +
      `Período: +${c.prazoRenovacaoMeses} meses\n` +
      `Bloqueia esta renovação registando uma denúncia antes do próximo termo.`;

    // Atomicidade: tudo numa única transacção — update, datas-chave,
    // timeline, notifications e webhook. Falha qualquer passo →
    // rollback; o próximo tick do cron repete sem deixar estado
    // inconsistente para trás.
    await this.prisma.$transaction(async (tx) => {
      await tx.contrato.update({
        where: { id: c.id },
        data: { dataTermo: dataTermoNova },
      });

      await tx.contratoDataChave.updateMany({
        where: {
          contratoId: c.id,
          tipo: DataChaveTipo.TERMO,
          data: dataTermoAntiga,
          cumprida: false,
        },
        data: { cumprida: true, cumpridaEm: new Date() },
      });

      await tx.contratoDataChave.create({
        data: {
          contratoId: c.id,
          tipo: DataChaveTipo.TERMO,
          data: dataTermoNova,
          descricao: `Termo após renovação tácita (${c.prazoRenovacaoMeses}m)`,
        },
      });

      await tx.contratoEvento.create({
        data: {
          contratoId: c.id,
          tipo: ContratoEventoTipo.RENOVACAO_EXECUTADA,
          resumo: `Renovação tácita executada — novo termo ${dataTermoNova
            .toISOString()
            .slice(0, 10)}`,
          payload: {
            dataTermoAntiga: dataTermoAntiga.toISOString(),
            dataTermoNova: dataTermoNova.toISOString(),
            prazoMeses: c.prazoRenovacaoMeses,
          } as object,
          actorTipo: 'SYSTEM',
        },
      });

      for (const userId of destinatarios) {
        for (const channel of [
          NotificationChannel.IN_APP,
          NotificationChannel.EMAIL,
        ]) {
          await this.notifications.create(
            {
              channel,
              type: NotificationType.RENOVACAO_AUTOMATICA_PROXIMA,
              userId,
              tenantId: c.tenantId,
              titulo,
              conteudo,
              payload: {
                contratoId: c.id,
                numeroInterno: c.numeroInterno,
                dataTermoNova: dataTermoNova.toISOString(),
              },
            },
            tx,
          );
        }
      }

      await this.webhooks.enqueueEvent(
        c.tenantId,
        'contrato.renovacao_executada',
        {
          contratoId: c.id,
          numeroInterno: c.numeroInterno,
          dataTermoAntiga: dataTermoAntiga.toISOString(),
          dataTermoNova: dataTermoNova.toISOString(),
          prazoMeses: c.prazoRenovacaoMeses,
        },
        tx,
      );
    });

    // Audit log fora da tx é OK — é só observabilidade, não
    // muda estado funcional.
    await this.audit.log({
      tenantId: c.tenantId,
      actorUserId: c.responsavelId ?? undefined,
      action: AuditAction.UPDATE,
      entityType: EntityType.CONTRATO,
      entityId: c.id,
      beforeData: { dataTermo: dataTermoAntiga.toISOString() },
      afterData: {
        dataTermo: dataTermoNova.toISOString(),
        triggeredBy: 'renovacao-engine',
      },
    });
  }

  private async registarFalha(
    c: {
      id: string;
      tenantId: string;
      numeroInterno: string;
      titulo: string;
      responsavelId: string | null;
    },
    motivo: string,
  ): Promise<void> {
    // Idempotência: só uma falha por contrato por dia
    const inicioDia = new Date();
    inicioDia.setUTCHours(0, 0, 0, 0);
    const jaRegistada = await this.prisma.contratoEvento.findFirst({
      where: {
        contratoId: c.id,
        tipo: ContratoEventoTipo.RENOVACAO_FALHOU,
        createdAt: { gte: inicioDia },
      },
    });
    if (jaRegistada) return;

    await this.prisma.contratoEvento.create({
      data: {
        contratoId: c.id,
        tipo: ContratoEventoTipo.RENOVACAO_FALHOU,
        resumo: `Renovação automática falhou: ${motivo}`,
        payload: { motivo } as object,
        actorTipo: 'SYSTEM',
      },
    });

    const destinatarios = await this.resolverDestinatarios(
      c.tenantId,
      c.responsavelId,
    );
    for (const userId of destinatarios) {
      await this.notifications.create({
        channel: NotificationChannel.IN_APP,
        type: NotificationType.RENOVACAO_AUTOMATICA_PROXIMA,
        userId,
        tenantId: c.tenantId,
        titulo: `Renovação falhou — ${c.numeroInterno}`,
        conteudo: `${c.titulo}\nMotivo: ${motivo}\nCompletar o campo "Prazo de renovação (meses)" ou renovar manualmente.`,
        payload: { contratoId: c.id, motivo },
      });
    }
  }

  /**
   * Regista uma denúncia tempestiva no contrato, bloqueando renovações
   * automáticas futuras. Idempotente: se já estiver denunciado,
   * lança erro 400.
   */
  async denunciar(
    tenantId: string,
    actorUserId: string,
    contratoId: string,
    motivo: string | null,
  ): Promise<{ denunciaEm: Date }> {
    const c = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId, deletedAt: null },
      select: {
        id: true,
        tenantId: true,
        numeroInterno: true,
        titulo: true,
        denunciaEm: true,
        responsavelId: true,
      },
    });
    if (!c) throw new NotFoundException('Contrato não encontrado');
    if (c.denunciaEm) {
      throw new BadRequestException(
        `Contrato já denunciado em ${c.denunciaEm.toISOString().slice(0, 10)}.`,
      );
    }

    const denunciaEm = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.contrato.update({
        where: { id: contratoId },
        data: {
          denunciaEm,
          denunciaPorUserId: actorUserId,
          denunciaMotivo: motivo ?? null,
        },
      });
      await tx.contratoEvento.create({
        data: {
          contratoId,
          tipo: ContratoEventoTipo.DENUNCIA_REGISTADA,
          resumo: `Denúncia tempestiva registada${motivo ? `: ${motivo.slice(0, 80)}` : ''}`,
          payload: {
            denunciaEm: denunciaEm.toISOString(),
            motivo: motivo ?? null,
          } as object,
          actorUserId,
          actorTipo: 'USER',
        },
      });
    });

    await this.audit.log({
      tenantId: c.tenantId,
      actorUserId,
      action: AuditAction.UPDATE,
      entityType: EntityType.CONTRATO,
      entityId: contratoId,
      beforeData: { denunciaEm: null },
      afterData: { denunciaEm: denunciaEm.toISOString(), motivo },
    });

    await this.webhooks.enqueueEvent(c.tenantId, 'contrato.denuncia_registada', {
      contratoId,
      numeroInterno: c.numeroInterno,
      denunciaEm: denunciaEm.toISOString(),
      motivo,
    });

    return { denunciaEm };
  }

  private hoje(): Date {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Soma meses preservando o dia. Se o dia não existir no mês alvo
   * (e.g. 31-Jan + 1 mês → 28/29-Feb), faz clamp para o último dia.
   */
  private addMonths(base: Date, months: number): Date {
    const d = new Date(base);
    const targetMonth = d.getUTCMonth() + months;
    const day = d.getUTCDate();
    d.setUTCDate(1); // clamp para evitar overflow Date intermédio
    d.setUTCMonth(targetMonth);
    const lastDay = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    d.setUTCDate(Math.min(day, lastDay));
    return d;
  }

  private async resolverDestinatarios(
    tenantId: string,
    responsavelId: string | null,
  ): Promise<string[]> {
    const admins = await this.prisma.membership.findMany({
      where: { tenantId, role: 'ADMIN', acceptedAt: { not: null } },
      select: { userId: true },
    });
    const set = new Set<string>(admins.map((a) => a.userId));
    if (responsavelId) set.add(responsavelId);
    return Array.from(set);
  }
}
