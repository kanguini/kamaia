/**
 * Webhook delivery worker — unit tests.
 *
 * Cobre as garantias críticas:
 *   - Assinatura HMAC SHA-256 sobre body (formato `sha256=<hex>`)
 *   - Headers Kamaia (X-Kamaia-Event, -Delivery, -Signature)
 *   - Sucesso → status SUCCESS, marca entregueEm
 *   - 5xx → RETRYING com backoff exponencial correcto
 *   - Esgotamento de tentativas → FAILED
 *   - Webhook desactivado → FAILED sem chamar fetch
 */
import { createHmac } from 'crypto';
import { WebhookDeliveryWorker } from './webhook-delivery.worker';

interface MockPrismaState {
  deliveries: Map<string, MockDelivery>;
}

interface MockDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: unknown;
  status: string;
  tentativas: number;
  proximaTentativa: Date | null;
  responseStatus: number | null;
  responseBody: string | null;
  entregueEm: Date | null;
  createdAt: Date;
  webhook: { id: string; url: string; secret: string; isActive: boolean };
}

function makePrismaMock(state: MockPrismaState) {
  return {
    webhookDelivery: {
      findMany: jest.fn(async ({ take }: { take: number }) => {
        const now = Date.now();
        return Array.from(state.deliveries.values())
          .filter(
            (d) =>
              ['PENDING', 'RETRYING'].includes(d.status) &&
              (d.proximaTentativa === null || d.proximaTentativa.getTime() <= now),
          )
          .slice(0, take);
      }),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<MockDelivery>;
        }) => {
          const cur = state.deliveries.get(where.id);
          if (!cur) throw new Error('not found');
          Object.assign(cur, data);
          state.deliveries.set(where.id, cur);
          return cur;
        },
      ),
    },
  };
}

function makeDelivery(over: Partial<MockDelivery> = {}): MockDelivery {
  return {
    id: 'del-' + Math.random().toString(36).slice(2, 8),
    webhookId: 'wh-1',
    event: 'contrato.assinado',
    payload: { contratoId: 'c-1', titulo: 'X' },
    status: 'PENDING',
    tentativas: 0,
    proximaTentativa: new Date(0),
    responseStatus: null,
    responseBody: null,
    entregueEm: null,
    createdAt: new Date(),
    webhook: {
      id: 'wh-1',
      // 8.8.8.8 é IP público literal — passa o SSRF check sem DNS.
      // Para os specs do worker importa só a forma do request
      // (fetch é stubbed), não o destino real.
      url: 'https://8.8.8.8/hook',
      secret: 'super-secret-32-bytes-of-entropy-here',
      isActive: true,
    },
    ...over,
  };
}

describe('WebhookDeliveryWorker', () => {
  const originalFetch = global.fetch;
  let state: MockPrismaState;
  let worker: WebhookDeliveryWorker;

  beforeEach(() => {
    state = { deliveries: new Map() };
    const prisma = makePrismaMock(state);
    worker = new WebhookDeliveryWorker(prisma as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('200 OK → SUCCESS + entregueEm preenchido', async () => {
    const d = makeDelivery();
    state.deliveries.set(d.id, d);
    let capturedBody = '';
    let capturedHeaders: Record<string, string> = {};
    global.fetch = jest.fn(async (_url, init: RequestInit | undefined) => {
      capturedBody = init?.body as string;
      capturedHeaders = init?.headers as Record<string, string>;
      return new Response('ok', { status: 200 });
    }) as never;

    await worker.tick();

    const after = state.deliveries.get(d.id)!;
    expect(after.status).toBe('SUCCESS');
    expect(after.responseStatus).toBe(200);
    expect(after.entregueEm).toBeInstanceOf(Date);

    // HMAC correcto
    const expectedSig = createHmac('sha256', d.webhook.secret).update(capturedBody).digest('hex');
    expect(capturedHeaders['x-kamaia-signature']).toBe(`sha256=${expectedSig}`);
    expect(capturedHeaders['x-kamaia-event']).toBe(d.event);
    expect(capturedHeaders['x-kamaia-delivery']).toBe(d.id);

    // Payload contém event + deliveryId + timestamp + data
    const parsed = JSON.parse(capturedBody);
    expect(parsed.event).toBe(d.event);
    expect(parsed.deliveryId).toBe(d.id);
    expect(parsed.data).toEqual(d.payload);
  });

  it('500 server error → RETRYING com backoff de 60s na 1ª tentativa', async () => {
    const d = makeDelivery();
    state.deliveries.set(d.id, d);
    global.fetch = jest.fn(async () => new Response('boom', { status: 500 })) as never;

    const before = Date.now();
    await worker.tick();

    const after = state.deliveries.get(d.id)!;
    expect(after.status).toBe('RETRYING');
    expect(after.responseStatus).toBe(500);
    expect(after.tentativas).toBe(1);
    // Backoff[0] = 60s → próxima tentativa ~ now + 60s (com tolerância)
    const delaySec = (after.proximaTentativa!.getTime() - before) / 1000;
    expect(delaySec).toBeGreaterThanOrEqual(55);
    expect(delaySec).toBeLessThan(70);
  });

  it('Backoff cresce exponencialmente nas tentativas seguintes', async () => {
    const d = makeDelivery({ tentativas: 3 });  // 4ª tentativa após este tick
    state.deliveries.set(d.id, d);
    global.fetch = jest.fn(async () => new Response('boom', { status: 503 })) as never;

    const before = Date.now();
    await worker.tick();

    const after = state.deliveries.get(d.id)!;
    expect(after.status).toBe('RETRYING');
    expect(after.tentativas).toBe(4);
    // Backoff[3] = 1h = 3600s
    const delaySec = (after.proximaTentativa!.getTime() - before) / 1000;
    expect(delaySec).toBeGreaterThanOrEqual(3500);
    expect(delaySec).toBeLessThan(3700);
  });

  it('6ª tentativa falhada → FAILED (esgotou)', async () => {
    const d = makeDelivery({ tentativas: 5 });
    state.deliveries.set(d.id, d);
    global.fetch = jest.fn(async () => new Response('still boom', { status: 502 })) as never;

    await worker.tick();

    const after = state.deliveries.get(d.id)!;
    expect(after.status).toBe('FAILED');
    expect(after.tentativas).toBe(6);
  });

  it('Webhook desactivado → FAILED sem chamar fetch', async () => {
    const d = makeDelivery({
      webhook: { ...makeDelivery().webhook, isActive: false },
    });
    state.deliveries.set(d.id, d);
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as never;

    await worker.tick();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.deliveries.get(d.id)!.status).toBe('FAILED');
  });

  it('Erro de rede (fetch throw) → RETRYING', async () => {
    const d = makeDelivery();
    state.deliveries.set(d.id, d);
    global.fetch = jest.fn(async () => {
      throw new Error('ENOTFOUND 8.8.8.8');
    }) as never;

    await worker.tick();

    const after = state.deliveries.get(d.id)!;
    expect(after.status).toBe('RETRYING');
    expect(after.responseBody).toMatch(/ENOTFOUND/);
    expect(after.tentativas).toBe(1);
  });

  it('Body JSON é estável (timestamp determinístico no payload)', async () => {
    const d = makeDelivery();
    state.deliveries.set(d.id, d);
    let body = '';
    global.fetch = jest.fn(async (_u, init: RequestInit | undefined) => {
      body = init?.body as string;
      return new Response('ok', { status: 200 });
    }) as never;

    await worker.tick();

    const parsed = JSON.parse(body);
    expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
