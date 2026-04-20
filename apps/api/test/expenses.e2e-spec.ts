import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { cleanupGabinete, seedGabineteWithUser, TestUserFixture } from './helpers/fixtures';

describe('Expenses (e2e)', () => {
  let ctx: TestApp;
  let user: TestUserFixture;
  let processoId: string;
  const auth = () => `Bearer ${user.accessToken}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    user = await seedGabineteWithUser(ctx.app);

    const cliente = await ctx.prisma.cliente.create({
      data: { gabineteId: user.gabineteId, name: 'Cliente Exp', type: 'INDIVIDUAL' },
    });
    const processo = await ctx.prisma.processo.create({
      data: {
        gabineteId: user.gabineteId,
        clienteId: cliente.id,
        advogadoId: user.id,
        processoNumber: `P-EXP-${Date.now()}`,
        title: 'Processo Exp',
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

  it('POST /api/expenses creates an expense', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/expenses')
      .set('Authorization', auth())
      .send({
        processoId,
        category: 'EMOLUMENTOS',
        description: 'Taxa de justiça',
        amount: 150000, // centavos (1500 AOA)
        date: new Date().toISOString().slice(0, 10),
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.data?.id).toBeTruthy();
    expect(res.body.data?.amount).toBe(150000);
  });

  it('GET /api/expenses returns a list', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/expenses')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it('PUT /api/expenses/:id updates the amount', async () => {
    const create = await request(ctx.app.getHttpServer())
      .post('/api/expenses')
      .set('Authorization', auth())
      .send({
        processoId,
        category: 'COPIAS',
        description: 'Fotocópias',
        amount: 5000,
        date: new Date().toISOString().slice(0, 10),
      });

    const id = create.body.data.id;
    const res = await request(ctx.app.getHttpServer())
      .put(`/api/expenses/${id}`)
      .set('Authorization', auth())
      .send({ amount: 7500 });

    expect(res.status).toBe(200);
    expect(res.body.data?.amount).toBe(7500);
  });
});
