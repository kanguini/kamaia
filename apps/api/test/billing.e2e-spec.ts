import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { cleanupGabinete, seedGabineteWithUser, TestUserFixture } from './helpers/fixtures';

describe('Billing (e2e)', () => {
  let ctx: TestApp;
  let user: TestUserFixture;
  const auth = () => `Bearer ${user.accessToken}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    user = await seedGabineteWithUser(ctx.app, { role: 'SOCIO_GESTOR' });
  });

  afterAll(async () => {
    await cleanupGabinete(ctx.prisma, user.gabineteId);
    await ctx.close();
  });

  it('GET /api/billing/plan returns current plan + quota', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/billing/plan')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it('GET /api/billing/plan without token returns 401', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/api/billing/plan');
    expect(res.status).toBe(401);
  });

  it('POST /api/billing/webhook without stripe signature returns 400', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/billing/webhook')
      .send({ type: 'test.event' });

    expect([400, 401]).toContain(res.status);
  });
});
