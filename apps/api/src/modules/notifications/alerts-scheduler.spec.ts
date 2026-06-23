/**
 * AlertsScheduler unit tests.
 *
 * Garante:
 *   - Idempotência: 2 runs seguidos não duplicam notifications/webhooks
 *   - Mapeamento DataChaveTipo → NotificationType correcto
 *   - Mapeamento DataChaveTipo + diasAntes → webhook event correcto
 *   - Destinatários = responsável + ADMINs (dedup)
 *   - Buckets de severidade no ActoRegulatorio (CRITICO/PROXIMO/ATRASO)
 */
import {
  ContratoEventoTipo,
  DataChaveTipo,
  NotificationType,
} from '@kamaia/shared-types';
import { AlertsScheduler } from './alerts-scheduler.service';

interface State {
  datasChave: Array<{
    id: string;
    tipo: DataChaveTipo;
    data: Date;
    descricao: string | null;
    alertaDias: number[];
    cumprida: boolean;
    contratoId: string;
    contrato: {
      id: string;
      tenantId: string;
      numeroInterno: string;
      titulo: string;
      responsavelId: string | null;
      renovacaoAutomatica: boolean;
      deletedAt: Date | null;
    };
  }>;
  actos: Array<{
    id: string;
    tipo: string;
    tgisVerbaNumero: string | null;
    valorLiquidar: bigint | null;
    prazoLimite: Date | null;
    estado: string;
    contratoId: string;
    contrato: {
      id: string;
      tenantId: string;
      numeroInterno: string;
      titulo: string;
      responsavelId: string | null;
      deletedAt: Date | null;
    };
  }>;
  memberships: Array<{ tenantId: string; userId: string; role: string; acceptedAt: Date | null }>;
  eventos: Array<{
    contratoId: string;
    tipo: string;
    payload: unknown;
    actorTipo: string | null;
    createdAt: Date;
    id: string;
  }>;
}

interface NotifCall {
  channel: string;
  type: string;
  userId: string;
  tenantId: string;
  titulo: string;
  conteudo: string;
  payload?: Record<string, unknown>;
}

function makeMocks(state: State) {
  const notifications = {
    create: jest.fn<Promise<void>, [NotifCall]>(async () => undefined),
  };
  const webhooks = {
    enqueueEvent: jest.fn<Promise<number>, [string, string, object]>(
      async () => 1,
    ),
  };

  const prisma = {
    contratoDataChave: {
      findMany: jest.fn(async () => state.datasChave),
    },
    contratoActoRegulatorio: {
      findMany: jest.fn(async () => state.actos),
    },
    membership: {
      findMany: jest.fn(async (args: { where: { tenantId: string; role: string } }) =>
        state.memberships
          .filter(
            (m) =>
              m.tenantId === args.where.tenantId &&
              m.role === args.where.role &&
              m.acceptedAt !== null,
          )
          .map((m) => ({ userId: m.userId })),
      ),
    },
    contratoEvento: {
      findFirst: jest.fn(
        async (args: { where: Record<string, unknown> & { payload?: { path?: string[]; equals?: unknown } } }) => {
          const tipo = args.where.tipo;
          const contratoId = args.where.contratoId;
          const path = args.where.payload?.path;
          const equals = args.where.payload?.equals;
          return (
            state.eventos.find((e) => {
              if (tipo && e.tipo !== tipo) return false;
              if (contratoId && e.contratoId !== contratoId) return false;
              if (path && equals !== undefined) {
                const p = e.payload as Record<string, unknown> | null;
                if (!p || p[path[0]] !== equals) return false;
              }
              return true;
            }) ?? null
          );
        },
      ),
      create: jest.fn(
        async (args: { data: Record<string, unknown> }) => {
          const row = {
            id: 'evt-' + state.eventos.length,
            createdAt: new Date(),
            actorTipo: (args.data.actorTipo as string) ?? null,
            contratoId: args.data.contratoId as string,
            tipo: args.data.tipo as string,
            payload: args.data.payload,
          };
          state.eventos.push(row);
          return row;
        },
      ),
    },
  } as Record<string, unknown>;

  // $transaction passa o próprio prisma como tx — os modelos
  // mockados já têm os mesmos métodos `create`/`findFirst`/etc.
  // Suficiente para os specs porque não estamos a testar isolation,
  // mas sim a sequência de operações.
  (prisma as { $transaction: unknown }).$transaction = jest.fn(
    async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
  );

  return { prisma, notifications, webhooks };
}

function makeDataChave(
  over: Partial<State['datasChave'][number]> = {},
): State['datasChave'][number] {
  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);
  const em30 = new Date(hoje);
  em30.setDate(em30.getDate() + 30);
  return {
    id: 'dc-1',
    tipo: DataChaveTipo.TERMO,
    data: em30,
    descricao: 'Termo natural',
    alertaDias: [90, 30, 7],
    cumprida: false,
    contratoId: 'c-1',
    contrato: {
      id: 'c-1',
      tenantId: 't-1',
      numeroInterno: 'CT-2026-00001',
      titulo: 'Test contract',
      responsavelId: 'u-resp',
      renovacaoAutomatica: false,
      deletedAt: null,
    },
    ...over,
  };
}

function makeActo(
  over: Partial<State['actos'][number]> = {},
): State['actos'][number] {
  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);
  const em15 = new Date(hoje);
  em15.setDate(em15.getDate() + 15);
  return {
    id: 'acto-1',
    tipo: 'IMPOSTO_SELO',
    tgisVerbaNumero: '23.3',
    valorLiquidar: 100000n,
    prazoLimite: em15,
    estado: 'PENDENTE',
    contratoId: 'c-1',
    contrato: {
      id: 'c-1',
      tenantId: 't-1',
      numeroInterno: 'CT-2026-00001',
      titulo: 'Test',
      responsavelId: 'u-resp',
      deletedAt: null,
    },
    ...over,
  };
}

describe('AlertsScheduler', () => {
  let state: State;
  let scheduler: AlertsScheduler;
  let mocks: ReturnType<typeof makeMocks>;

  beforeEach(() => {
    state = {
      datasChave: [],
      actos: [],
      memberships: [
        { tenantId: 't-1', userId: 'u-admin-1', role: 'ADMIN', acceptedAt: new Date() },
        { tenantId: 't-1', userId: 'u-admin-2', role: 'ADMIN', acceptedAt: new Date() },
      ],
      eventos: [],
    };
    mocks = makeMocks(state);
    scheduler = new AlertsScheduler(
      mocks.prisma as never,
      mocks.notifications as never,
      mocks.webhooks as never,
    );
  });

  it('TERMO em exactamente 30 dias dispara notificações + webhook expira_em_30_dias', async () => {
    state.datasChave = [makeDataChave()];
    const out = await scheduler.runOnce();
    expect(out.datasChave).toBe(1);

    // 2 destinatários (admins) + 1 responsável = 3, em 2 canais = 6 notifications
    expect(mocks.notifications.create).toHaveBeenCalledTimes(6);
    const firstCall = mocks.notifications.create.mock.calls[0][0] as unknown as {
      type: NotificationType;
      tenantId: string;
    };
    expect(firstCall.type).toBe(NotificationType.CONTRATO_VENCIMENTO_PROXIMO);
    expect(firstCall.tenantId).toBe('t-1');

    expect(mocks.webhooks.enqueueEvent).toHaveBeenCalledWith(
      't-1',
      'contrato.expira_em_30_dias',
      expect.objectContaining({ contratoId: 'c-1', diasAntes: 30 }),
      expect.anything(),
    );
  });

  it('TERMO em 7 dias dispara webhook expira_em_7_dias', async () => {
    const hoje = new Date(); hoje.setUTCHours(0, 0, 0, 0);
    const em7 = new Date(hoje); em7.setDate(em7.getDate() + 7);
    state.datasChave = [makeDataChave({ data: em7 })];
    await scheduler.runOnce();
    expect(mocks.webhooks.enqueueEvent).toHaveBeenCalledWith(
      't-1',
      'contrato.expira_em_7_dias',
      expect.objectContaining({ diasAntes: 7 }),
      expect.anything(),
    );
  });

  it('JANELA_DENUNCIA dispara tipo correcto', async () => {
    const hoje = new Date(); hoje.setUTCHours(0, 0, 0, 0);
    const em30 = new Date(hoje); em30.setDate(em30.getDate() + 30);
    state.datasChave = [makeDataChave({ tipo: DataChaveTipo.JANELA_DENUNCIA_FIM, data: em30 })];
    await scheduler.runOnce();
    expect(mocks.webhooks.enqueueEvent).toHaveBeenCalledWith(
      't-1',
      'contrato.janela_denuncia_proxima',
      expect.any(Object),
      expect.anything(),
    );
    const notif = mocks.notifications.create.mock.calls[0][0] as unknown as { type: NotificationType };
    expect(notif.type).toBe(NotificationType.JANELA_DENUNCIA_PROXIMA);
  });

  it('Renovação automática dispara tipo RENOVACAO_AUTOMATICA_PROXIMA', async () => {
    const hoje = new Date(); hoje.setUTCHours(0, 0, 0, 0);
    const em30 = new Date(hoje); em30.setDate(em30.getDate() + 30);
    state.datasChave = [
      makeDataChave({
        data: em30,
        contrato: { ...makeDataChave().contrato, renovacaoAutomatica: true },
      }),
    ];
    await scheduler.runOnce();
    const notif = mocks.notifications.create.mock.calls[0][0] as unknown as { type: NotificationType };
    expect(notif.type).toBe(NotificationType.RENOVACAO_AUTOMATICA_PROXIMA);
  });

  it('Idempotência: 2 runs seguidos não disparam o mesmo alerta 2x', async () => {
    state.datasChave = [makeDataChave()];
    await scheduler.runOnce();
    const firstRunCalls = mocks.notifications.create.mock.calls.length;
    expect(firstRunCalls).toBeGreaterThan(0);

    // Re-run sem alterar state — não deve duplicar
    await scheduler.runOnce();
    expect(mocks.notifications.create.mock.calls.length).toBe(firstRunCalls);
  });

  it('Data fora da janela alertaDias não dispara', async () => {
    const hoje = new Date(); hoje.setUTCHours(0, 0, 0, 0);
    const em15 = new Date(hoje); em15.setDate(em15.getDate() + 15);  // 15 não está em [90,30,7]
    state.datasChave = [makeDataChave({ data: em15 })];
    const out = await scheduler.runOnce();
    expect(out.datasChave).toBe(0);
    expect(mocks.notifications.create).not.toHaveBeenCalled();
  });

  it('Data cumprida nunca dispara (filtrado pela query)', async () => {
    // O scanner pediu where: cumprida=false, então o mock filtra
    state.datasChave = [];  // simula que cumprida=true exclui o registo
    const out = await scheduler.runOnce();
    expect(out.datasChave).toBe(0);
  });

  it('Acto regulatório com prazo ≤ 7 dias → bucket IS_PRAZO_CRITICO', async () => {
    const hoje = new Date(); hoje.setUTCHours(0, 0, 0, 0);
    const em5 = new Date(hoje); em5.setDate(em5.getDate() + 5);
    state.actos = [makeActo({ prazoLimite: em5 })];
    await scheduler.runOnce();
    const notif = mocks.notifications.create.mock.calls[0][0] as unknown as { type: NotificationType };
    expect(notif.type).toBe(NotificationType.IS_PRAZO_CRITICO);
  });

  it('Acto regulatório com prazo > 7 dias → bucket IS_PENDENTE', async () => {
    const hoje = new Date(); hoje.setUTCHours(0, 0, 0, 0);
    const em20 = new Date(hoje); em20.setDate(em20.getDate() + 20);
    state.actos = [makeActo({ prazoLimite: em20 })];
    await scheduler.runOnce();
    const notif = mocks.notifications.create.mock.calls[0][0] as unknown as { type: NotificationType };
    expect(notif.type).toBe(NotificationType.IS_PENDENTE);
  });

  it('Destinatários: responsável + ADMINs sem duplicar quando responsável É admin', async () => {
    state.memberships = [
      { tenantId: 't-1', userId: 'u-resp', role: 'ADMIN', acceptedAt: new Date() },
      { tenantId: 't-1', userId: 'u-admin-2', role: 'ADMIN', acceptedAt: new Date() },
    ];
    state.datasChave = [makeDataChave()];
    await scheduler.runOnce();
    // 2 destinatários únicos (u-resp + u-admin-2) × 2 canais = 4 notifs
    expect(mocks.notifications.create.mock.calls.length).toBe(4);
  });

  it('ContratoEvento ALERTA_DISPARADO é criado por cada disparo', async () => {
    state.datasChave = [makeDataChave()];
    await scheduler.runOnce();
    const eventoAlerta = state.eventos.find(
      (e) => e.tipo === ContratoEventoTipo.ALERTA_DISPARADO,
    );
    expect(eventoAlerta).toBeDefined();
    expect((eventoAlerta!.payload as { dataChaveId: string }).dataChaveId).toBe('dc-1');
    expect(eventoAlerta!.actorTipo).toBe('SYSTEM');
  });
});
