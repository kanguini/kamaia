import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { cleanupGabinete, seedGabineteWithUser, TestUserFixture } from './helpers/fixtures';

describe('Portal (e2e)', () => {
  let ctx: TestApp;
  let user: TestUserFixture;
  let clienteId: string;
  const auth = () => `Bearer ${user.accessToken}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    user = await seedGabineteWithUser(ctx.app);

    const cliente = await ctx.prisma.cliente.create({
      data: { gabineteId: user.gabineteId, name: 'Cliente Portal', type: 'INDIVIDUAL' },
    });
    clienteId = cliente.id;
  });

  afterAll(async () => {
    await cleanupGabinete(ctx.prisma, user.gabineteId);
    await ctx.close();
  });

  it('POST /api/portal/generate-link/:clienteId issues an access link', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/api/portal/generate-link/${clienteId}`)
      .set('Authorization', auth());

    expect([200, 201]).toContain(res.status);
    expect(res.body.data).toBeDefined();
  });

  it('GET /api/portal/overview without portal token returns 401', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/api/portal/overview');
    expect(res.status).toBe(401);
  });

  it('GET /api/portal/processo/:id without portal token returns 401', async () => {
    const res = await request(ctx.app.getHttpServer()).get(
      '/api/portal/processo/00000000-0000-0000-0000-000000000000',
    );
    expect(res.status).toBe(401);
  });
});
