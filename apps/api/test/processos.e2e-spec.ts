import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { cleanupGabinete, seedGabineteWithUser, TestUserFixture } from './helpers/fixtures';

/**
 * Minimum smoke coverage for the processos module.
 * A cliente is seeded up-front because every processo must belong to one.
 */
describe('Processos (e2e)', () => {
  let ctx: TestApp;
  let user: TestUserFixture;
  let clienteId: string;
  const auth = () => `Bearer ${user.accessToken}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    user = await seedGabineteWithUser(ctx.app);

    const cliente = await ctx.prisma.cliente.create({
      data: {
        gabineteId: user.gabineteId,
        name: 'Cliente E2E Processos',
        type: 'INDIVIDUAL',
      },
    });
    clienteId = cliente.id;
  });

  afterAll(async () => {
    await cleanupGabinete(ctx.prisma, user.gabineteId);
    await ctx.close();
  });

  it('GET /api/processos returns a paginated list', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/processos')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.data)).toBe(true);
  });

  it('POST /api/processos creates a processo for the gabinete', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/processos')
      .set('Authorization', auth())
      .send({
        title: 'Processo E2E',
        type: 'CIVEL',
        clienteId,
        priority: 'MEDIA',
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.data?.id).toBeTruthy();
    expect(res.body.data?.title).toBe('Processo E2E');
  });

  it('PUT /api/processos/:id/strategy persists the strategy and logs an event', async () => {
    const create = await request(ctx.app.getHttpServer())
      .post('/api/processos')
      .set('Authorization', auth())
      .send({
        title: 'Processo Estratégia',
        type: 'CIVEL',
        clienteId,
        priority: 'MEDIA',
      });
    const processoId = create.body.data.id;

    const strategy =
      'Tese principal: invalidade da notificação. Plano B: excepção dilatória de incompetência. Risco: perda de prazo se Tribunal não responder até 15 dias.';
    const res = await request(ctx.app.getHttpServer())
      .put(`/api/processos/${processoId}/strategy`)
      .set('Authorization', auth())
      .send({ strategy });

    expect([200, 201]).toContain(res.status);
    expect(res.body.data?.strategy).toBe(strategy);

    // A definição gera um evento de "Estratégia definida".
    const events = await request(ctx.app.getHttpServer())
      .get(`/api/processos/${processoId}/events`)
      .set('Authorization', auth());
    expect(events.status).toBe(200);
    const eventDescs = (events.body.data?.data || []).map((e: any) => e.description);
    expect(eventDescs.some((d: string) => /Estratégia .* definida/.test(d))).toBe(true);

    // Segunda actualização gera evento de "actualizada", não de "definida".
    const res2 = await request(ctx.app.getHttpServer())
      .put(`/api/processos/${processoId}/strategy`)
      .set('Authorization', auth())
      .send({ strategy: strategy + ' (revisto)' });
    expect([200, 201]).toContain(res2.status);

    const events2 = await request(ctx.app.getHttpServer())
      .get(`/api/processos/${processoId}/events`)
      .set('Authorization', auth());
    const descs2 = (events2.body.data?.data || []).map((e: any) => e.description);
    expect(descs2.some((d: string) => /Estratégia .* actualizada/.test(d))).toBe(true);
  });

  it('PUT /api/processos/:id/strategy rejeita textos acima do limite', async () => {
    const create = await request(ctx.app.getHttpServer())
      .post('/api/processos')
      .set('Authorization', auth())
      .send({
        title: 'Processo Estratégia Limite',
        type: 'CIVEL',
        clienteId,
        priority: 'MEDIA',
      });
    const processoId = create.body.data.id;

    const res = await request(ctx.app.getHttpServer())
      .put(`/api/processos/${processoId}/strategy`)
      .set('Authorization', auth())
      .send({ strategy: 'x'.repeat(20_001) });

    expect(res.status).toBe(400);
  });
});
