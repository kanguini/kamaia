import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { cleanupGabinete, seedGabineteWithUser, TestUserFixture } from './helpers/fixtures';

describe('Prazos (e2e)', () => {
  let ctx: TestApp;
  let user: TestUserFixture;
  let processoId: string;
  const auth = () => `Bearer ${user.accessToken}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    user = await seedGabineteWithUser(ctx.app);

    const cliente = await ctx.prisma.cliente.create({
      data: { gabineteId: user.gabineteId, name: 'Cliente Prazos', type: 'INDIVIDUAL' },
    });
    const processo = await ctx.prisma.processo.create({
      data: {
        gabineteId: user.gabineteId,
        clienteId: cliente.id,
        advogadoId: user.id,
        processoNumber: `P-${Date.now()}`,
        title: 'Processo Prazos',
        type: 'CIVEL',
        priority: 'MEDIA',
        status: 'ACTIVO',
        stage: 'INICIAL',
      },
    });
    processoId = processo.id;
  });

  afterAll(async () => {
    await cleanupGabinete(ctx.prisma, user.gabineteId);
    await ctx.close();
  });

  it('POST /api/prazos creates a prazo tied to a processo', async () => {
    const dueDate = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const res = await request(ctx.app.getHttpServer())
      .post('/api/prazos')
      .set('Authorization', auth())
      .send({
        processoId,
        title: 'Contestação',
        type: 'CONTESTACAO',
        dueDate,
        alertHoursBefore: 48,
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.data?.id).toBeTruthy();
    expect(res.body.data?.status).toBe('PENDENTE');
  });

  it('GET /api/prazos/upcoming lists upcoming prazos', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/prazos/upcoming')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it('PATCH /api/prazos/:id/complete marks a prazo as completed', async () => {
    const dueDate = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();
    const create = await request(ctx.app.getHttpServer())
      .post('/api/prazos')
      .set('Authorization', auth())
      .send({ processoId, title: 'Audiência', type: 'CONTESTACAO', dueDate });

    const prazoId = create.body.data.id;
    const res = await request(ctx.app.getHttpServer())
      .patch(`/api/prazos/${prazoId}/complete`)
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data?.status).toBe('CUMPRIDO');
  });
});
