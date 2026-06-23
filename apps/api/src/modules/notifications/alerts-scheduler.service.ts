import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  ContratoEventoTipo,
  DataChaveTipo,
  NotificationChannel,
  NotificationType,
} from '@kamaia/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { NotificationsService } from './notifications.service';

/**
 * AlertsScheduler — produtor de alertas a partir do estado vivo.
 *
 * Cron diário (08:00 WAT por defeito) varre:
 *   1. ContratoDataChave não-cumpridas com `data` em janela próxima
 *      (alertaDias[]). Para cada match, emite 1 notification por user
 *      (responsavel + ADMIN do tenant) + 1 webhook event.
 *   2. ContratoActoRegulatorio PENDENTE/EM_CURSO com `prazoLimite`
 *      em janela próxima.
 *   3. Contratos com renovacaoAutomatica=true em janela de denúncia.
 *
 * **Idempotência:** mantém um `ContratoEvento` tipo ALERTA_DISPARADO
 * por (contratoId, alvoId, dataAlvo, diasAntes) — evita duplicar
 * notificações se o cron correr 2x.
 *
 * Para volume grande, mover para BullMQ. Para já basta esta janela
 * diária — alertas com 1 dia de atraso são aceitáveis para datas
 * com semanas/meses de antecedência.
 */
@Injectable()
export class AlertsScheduler {
  private readonly logger = new Logger(AlertsScheduler.name);
  private inFlight = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly webhooks: WebhooksService,
  ) {}

  /** Default 08:00 cada dia. Override via env CRON_ALERTS se preciso. */
  @Cron(process.env.CRON_ALERTS ?? '0 8 * * *')
  async tick() {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      const dataChave = await this.scanDatasChave();
      const actos = await this.scanActosRegulatorios();
      this.logger.log(
        `AlertsScheduler: ${dataChave} datas-chave + ${actos} actos processados`,
      );
    } catch (e) {
      this.logger.error(
        `AlertsScheduler falhou: ${e instanceof Error ? e.stack : e}`,
      );
    } finally {
      this.inFlight = false;
    }
  }

  /** Util — manualmente disparar via endpoint de teste. */
  async runOnce(): Promise<{ datasChave: number; actos: number }> {
    return {
      datasChave: await this.scanDatasChave(),
      actos: await this.scanActosRegulatorios(),
    };
  }

  private hoje(): Date {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private addDays(base: Date, days: number): Date {
    const r = new Date(base);
    r.setDate(r.getDate() + days);
    return r;
  }

  private async scanDatasChave(): Promise<number> {
    const hoje = this.hoje();
    // Janela máxima de scan: 365 dias (cobre todos os alertaDias razoáveis)
    const limite = this.addDays(hoje, 365);

    const datas = await this.prisma.contratoDataChave.findMany({
      where: {
        cumprida: false,
        data: { gte: hoje, lte: limite },
        contrato: { deletedAt: null },
      },
      include: {
        contrato: {
          select: {
            id: true,
            tenantId: true,
            numeroInterno: true,
            titulo: true,
            responsavelId: true,
            renovacaoAutomatica: true,
          },
        },
      },
    });

    let count = 0;
    for (const dc of datas) {
      const diasAteData = Math.ceil(
        (dc.data.getTime() - hoje.getTime()) / 86_400_000,
      );
      // Verifica se o número de dias até à data está em qualquer alerta
      const triggered = dc.alertaDias.some((dias) => dias === diasAteData);
      if (!triggered) continue;

      // Idempotência: já disparado este alerta?
      const alreadySent = await this.prisma.contratoEvento.findFirst({
        where: {
          contratoId: dc.contratoId,
          tipo: ContratoEventoTipo.ALERTA_DISPARADO,
          payload: {
            path: ['dataChaveId'],
            equals: dc.id,
          },
        },
      });
      if (alreadySent) {
        const payload = alreadySent.payload as { diasAntes?: number } | null;
        if (payload?.diasAntes === diasAteData) continue;
      }

      await this.emitirAlertaDataChave(
        { ...dc, tipo: dc.tipo as DataChaveTipo },
        diasAteData,
      );
      count += 1;
    }
    return count;
  }

  private async scanActosRegulatorios(): Promise<number> {
    const hoje = this.hoje();
    const em30 = this.addDays(hoje, 30);

    const actos = await this.prisma.contratoActoRegulatorio.findMany({
      where: {
        estado: { in: ['PENDENTE', 'EM_CURSO'] },
        prazoLimite: { gte: hoje, lte: em30 },
        contrato: { deletedAt: null },
      },
      include: {
        contrato: {
          select: {
            id: true,
            tenantId: true,
            numeroInterno: true,
            titulo: true,
            responsavelId: true,
          },
        },
      },
    });

    let count = 0;
    for (const acto of actos) {
      if (!acto.prazoLimite) continue;
      const diasAtePrazo = Math.ceil(
        (acto.prazoLimite.getTime() - hoje.getTime()) / 86_400_000,
      );
      const tipoAlerta =
        diasAtePrazo <= 0
          ? NotificationType.OBRIGACAO_EM_ATRASO
          : diasAtePrazo <= 7
            ? NotificationType.IS_PRAZO_CRITICO
            : NotificationType.IS_PENDENTE;

      // Idempotência: só dispara 1x por bucket (CRÍTICO/PROXIMO/ATRASO)
      const alreadySent = await this.prisma.contratoEvento.findFirst({
        where: {
          contratoId: acto.contratoId,
          tipo: ContratoEventoTipo.ALERTA_DISPARADO,
          payload: {
            path: ['actoId'],
            equals: acto.id,
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (alreadySent) {
        const p = alreadySent.payload as { bucket?: string } | null;
        if (p?.bucket === tipoAlerta) continue;
      }

      await this.emitirAlertaActo(
        { ...acto, prazoLimite: acto.prazoLimite },
        diasAtePrazo,
        tipoAlerta,
      );
      count += 1;
    }
    return count;
  }

  private async emitirAlertaDataChave(
    dc: {
      id: string;
      tipo: DataChaveTipo;
      data: Date;
      descricao: string | null;
      contrato: {
        id: string;
        tenantId: string;
        numeroInterno: string;
        titulo: string;
        responsavelId: string | null;
        renovacaoAutomatica: boolean;
      };
    },
    diasAntes: number,
  ) {
    const c = dc.contrato;
    const notifType = this.mapDataChaveToType(dc.tipo, c.renovacaoAutomatica);
    const webhookEvent = this.mapDataChaveToWebhook(dc.tipo, diasAntes);
    const titulo = `${this.labelDataChave(dc.tipo)} em ${diasAntes} dias — ${c.numeroInterno}`;
    const conteudo =
      `${c.titulo}\n` +
      `Tipo: ${dc.tipo}\n` +
      `Data: ${dc.data.toISOString().slice(0, 10)}\n` +
      (dc.descricao ? `Notas: ${dc.descricao}\n` : '');

    // Quem é notificado: responsável do contrato + ADMINs do tenant
    const destinatarios = await this.resolverDestinatarios(c.tenantId, c.responsavelId);

    // Atomicidade: notifications + outbox webhook + ContratoEvento
    // num único $transaction. Se qualquer passo falhar, fazemos
    // rollback e a próxima passagem do cron repete (sem deixar
    // notifications órfãs ou timeline inconsistente).
    await this.prisma.$transaction(async (tx) => {
      for (const userId of destinatarios) {
        for (const channel of [NotificationChannel.IN_APP, NotificationChannel.EMAIL]) {
          await this.notifications.create(
            {
              channel,
              type: notifType,
              userId,
              tenantId: c.tenantId,
              titulo,
              conteudo,
              payload: {
                contratoId: c.id,
                numeroInterno: c.numeroInterno,
                dataChaveId: dc.id,
                tipoDataChave: dc.tipo,
                diasAntes,
              },
            },
            tx,
          );
        }
      }

      if (webhookEvent) {
        await this.webhooks.enqueueEvent(
          c.tenantId,
          webhookEvent,
          {
            contratoId: c.id,
            numeroInterno: c.numeroInterno,
            titulo: c.titulo,
            dataChaveTipo: dc.tipo,
            data: dc.data.toISOString(),
            diasAntes,
          },
          tx,
        );
      }

      await tx.contratoEvento.create({
        data: {
          contratoId: c.id,
          tipo: ContratoEventoTipo.ALERTA_DISPARADO,
          resumo: titulo,
          payload: { dataChaveId: dc.id, diasAntes, notifType } as object,
          actorTipo: 'SYSTEM',
        },
      });
    });
  }

  private async emitirAlertaActo(
    acto: {
      id: string;
      tipo: string;
      tgisVerbaNumero: string | null;
      valorLiquidar: bigint | null;
      prazoLimite: Date;
      contrato: {
        id: string;
        tenantId: string;
        numeroInterno: string;
        titulo: string;
        responsavelId: string | null;
      };
    },
    diasAtePrazo: number,
    notifType: NotificationType,
  ) {
    const c = acto.contrato;
    const titulo = `${acto.tipo}${acto.tgisVerbaNumero ? ` (Verba ${acto.tgisVerbaNumero})` : ''} — ${diasAtePrazo} dias — ${c.numeroInterno}`;
    const conteudo =
      `Contrato: ${c.titulo}\n` +
      `Acto: ${acto.tipo}\n` +
      (acto.tgisVerbaNumero ? `Verba TGIS: ${acto.tgisVerbaNumero}\n` : '') +
      (acto.valorLiquidar ? `Valor a liquidar: ${acto.valorLiquidar.toString()} centavos\n` : '') +
      `Prazo limite: ${acto.prazoLimite.toISOString().slice(0, 10)}\n`;

    const destinatarios = await this.resolverDestinatarios(c.tenantId, c.responsavelId);

    // Mesma estratégia: tudo numa $transaction para garantir
    // notifications + webhook + ContratoEvento juntos ou nada.
    await this.prisma.$transaction(async (tx) => {
      for (const userId of destinatarios) {
        await this.notifications.create(
          {
            channel: NotificationChannel.IN_APP,
            type: notifType,
            userId,
            tenantId: c.tenantId,
            titulo,
            conteudo,
            payload: {
              contratoId: c.id,
              actoId: acto.id,
              tipo: acto.tipo,
              diasAtePrazo,
            },
          },
          tx,
        );
      }

      await this.webhooks.enqueueEvent(
        c.tenantId,
        'acto_regulatorio.detectado',
        {
          contratoId: c.id,
          numeroInterno: c.numeroInterno,
          actoId: acto.id,
          tipo: acto.tipo,
          prazoLimite: acto.prazoLimite.toISOString(),
          diasAtePrazo,
          severidade: notifType,
        },
        tx,
      );

      await tx.contratoEvento.create({
        data: {
          contratoId: c.id,
          tipo: ContratoEventoTipo.ALERTA_DISPARADO,
          resumo: titulo,
          payload: { actoId: acto.id, bucket: notifType, diasAtePrazo } as object,
          actorTipo: 'SYSTEM',
        },
      });
    });
  }

  /** Combina responsável do contrato + ADMINs do tenant, sem duplicados. */
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

  private mapDataChaveToType(
    tipo: DataChaveTipo,
    renovacaoAuto: boolean,
  ): NotificationType {
    switch (tipo) {
      case DataChaveTipo.TERMO:
        return renovacaoAuto
          ? NotificationType.RENOVACAO_AUTOMATICA_PROXIMA
          : NotificationType.CONTRATO_VENCIMENTO_PROXIMO;
      case DataChaveTipo.JANELA_DENUNCIA_INICIO:
      case DataChaveTipo.JANELA_DENUNCIA_FIM:
        return NotificationType.JANELA_DENUNCIA_PROXIMA;
      case DataChaveTipo.RENOVACAO_AUTOMATICA:
        return NotificationType.RENOVACAO_AUTOMATICA_PROXIMA;
      case DataChaveTipo.PAGAMENTO:
        return NotificationType.PAGAMENTO_PROXIMO;
      case DataChaveTipo.ENTREGA:
        return NotificationType.ENTREGA_PROXIMA;
      default:
        return NotificationType.CONTRATO_VENCIMENTO_PROXIMO;
    }
  }

  private mapDataChaveToWebhook(
    tipo: DataChaveTipo,
    diasAntes: number,
  ): string | null {
    if (tipo === DataChaveTipo.TERMO) {
      if (diasAntes === 30) return 'contrato.expira_em_30_dias';
      if (diasAntes === 7) return 'contrato.expira_em_7_dias';
    }
    if (
      tipo === DataChaveTipo.JANELA_DENUNCIA_INICIO ||
      tipo === DataChaveTipo.JANELA_DENUNCIA_FIM
    ) {
      return 'contrato.janela_denuncia_proxima';
    }
    if (tipo === DataChaveTipo.RENOVACAO_AUTOMATICA) {
      return 'contrato.renovacao_automatica_proxima';
    }
    return null;
  }

  private labelDataChave(tipo: DataChaveTipo): string {
    switch (tipo) {
      case DataChaveTipo.TERMO: return 'Termo do contrato';
      case DataChaveTipo.JANELA_DENUNCIA_INICIO: return 'Abre janela de denúncia';
      case DataChaveTipo.JANELA_DENUNCIA_FIM: return 'Fecha janela de denúncia';
      case DataChaveTipo.RENOVACAO_AUTOMATICA: return 'Renovação automática';
      case DataChaveTipo.PAGAMENTO: return 'Pagamento devido';
      case DataChaveTipo.ENTREGA: return 'Entrega devida';
      case DataChaveTipo.REVISAO_PRECO: return 'Revisão de preço';
      default: return tipo;
    }
  }
}
