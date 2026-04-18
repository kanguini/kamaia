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

  it('GET /api/processos/kanban returns processos grouped by stage', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/processos/kanban')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });
});
