import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import {
  cleanupGabinete,
  seedGabineteWithUser,
  TestUserFixture,
} from './helpers/fixtures';

describe('Audiencias (e2e)', () => {
  let ctx: TestApp;
  let user: TestUserFixture;
  let processoId: string;
  const auth = () => `Bearer ${user.accessToken}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    user = await seedGabineteWithUser(ctx.app);

    const cliente = await ctx.prisma.cliente.create({
      data: {
        gabineteId: user.gabineteId,
        name: 'Cliente Aud',
        type: 'INDIVIDUAL',
      },
    });
    const processo = await ctx.prisma.processo.create({
      data: {
        gabineteId: user.gabineteId,
        clienteId: cliente.id,
        advogadoId: user.id,
        processoNumber: `P-AUD-${Date.now()}`,
        title: 'Processo Audiência',
        type: 'CIVEL',
        priority: 'MEDIA',
        status: 'ACTIVO',
        stage: 'Instrução',
      },
    });
    processoId = processo.id;
  });

  afterAll(async () => {
    await cleanupGabinete(ctx.prisma, user.gabineteId);
    await ctx.close();
  });

  it('GET /api/audiencias/vocabulary devolve tipos, estados e transições', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/audiencias/vocabulary')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data?.typeLabels).toBeTruthy();
    expect(res.body.data?.statusLabels).toBeTruthy();
    expect(res.body.data?.allowedTransitions).toBeTruthy();
  });

  it('POST /api/audiencias agenda uma nova audiência', async () => {
    const scheduledAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(ctx.app.getHttpServer())
      .post('/api/audiencias')
      .set('Authorization', auth())
      .send({
        processoId,
        type: 'AUDIENCIA_PREVIA',
        scheduledAt,
        durationMinutes: 90,
        location: 'Tribunal Provincial — Sala 2',
        judge: 'Dr. Manuel Kianga',
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.data?.id).toBeTruthy();
    expect(res.body.data?.status).toBe('AGENDADA');
    expect(res.body.data?.type).toBe('AUDIENCIA_PREVIA');
  });

  it('POST /api/audiencias/:id/held marca como realizada e bloqueia nova transição', async () => {
    const create = await request(ctx.app.getHttpServer())
      .post('/api/audiencias')
      .set('Authorization', auth())
      .send({
        processoId,
        type: 'JULGAMENTO',
        scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      });
    const id = create.body.data.id;

    const held = await request(ctx.app.getHttpServer())
      .post(`/api/audiencias/${id}/held`)
      .set('Authorization', auth())
      .send({ outcome: 'Realizada; designada data para sentença.' });

    expect([200, 201]).toContain(held.status);
    expect(held.body.data?.status).toBe('REALIZADA');
    expect(held.body.data?.outcome).toMatch(/sentença/);

    // Segunda transição a partir de REALIZADA deve falhar (terminal).
    const retry = await request(ctx.app.getHttpServer())
      .post(`/api/audiencias/${id}/held`)
      .set('Authorization', auth())
      .send({ outcome: 'Duplicado' });

    expect(retry.status).toBe(409);
    expect(retry.body.code).toBe('INVALID_TRANSITION');
  });

  it('POST /api/audiencias/:id/postpone fecha actual e cria nova linkada via previousId', async () => {
    const first = await request(ctx.app.getHttpServer())
      .post('/api/audiencias')
      .set('Authorization', auth())
      .send({
        processoId,
        type: 'DISCUSSAO_JULGAMENTO',
        scheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'Sala 1',
      });
    const originalId = first.body.data.id;

    const postponed = await request(ctx.app.getHttpServer())
      .post(`/api/audiencias/${originalId}/postpone`)
      .set('Authorization', auth())
      .send({
        newScheduledAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
        reason: 'Indisponibilidade do juiz',
      });

    expect([200, 201]).toContain(postponed.status);
    expect(postponed.body.data?.status).toBe('AGENDADA');
    expect(postponed.body.data?.previousId).toBe(originalId);
    expect(postponed.body.data?.type).toBe('DISCUSSAO_JULGAMENTO');
    // Herança dos detalhes do evento anterior.
    expect(postponed.body.data?.location).toBe('Sala 1');

    // A anterior ficou em ADIADA.
    const old = await request(ctx.app.getHttpServer())
      .get(`/api/audiencias/${originalId}`)
      .set('Authorization', auth());
    expect(old.body.data?.status).toBe('ADIADA');
    expect(old.body.data?.outcome).toMatch(/Adiada/);
  });

  it('POST /api/audiencias/:id/cancel cancela audiência agendada', async () => {
    const create = await request(ctx.app.getHttpServer())
      .post('/api/audiencias')
      .set('Authorization', auth())
      .send({
        processoId,
        type: 'TENTATIVA_CONCILIACAO',
        scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      });
    const id = create.body.data.id;

    const cancelled = await request(ctx.app.getHttpServer())
      .post(`/api/audiencias/${id}/cancel`)
      .set('Authorization', auth())
      .send({ reason: 'Acordo extrajudicial alcançado' });

    expect([200, 201]).toContain(cancelled.status);
    expect(cancelled.body.data?.status).toBe('CANCELADA');
    expect(cancelled.body.data?.outcome).toMatch(/Acordo/);
  });

  it('GET /api/audiencias?processoId= filtra por processo', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/api/audiencias?processoId=${processoId}`)
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data?.data)).toBe(true);
    expect(res.body.data.data.length).toBeGreaterThanOrEqual(4);
  });

  it('GET /api/audiencias/upcoming devolve apenas as AGENDADAs dos próximos 30 dias', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/audiencias/upcoming')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    res.body.data.forEach((a: any) => {
      expect(a.status).toBe('AGENDADA');
    });
  });
});
