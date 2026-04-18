import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { cleanupGabinete, seedGabineteWithUser, TestUserFixture } from './helpers/fixtures';

describe('Stats (e2e)', () => {
  let ctx: TestApp;
  let user: TestUserFixture;
  const auth = () => `Bearer ${user.accessToken}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    user = await seedGabineteWithUser(ctx.app);
  });

  afterAll(async () => {
    await cleanupGabinete(ctx.prisma, user.gabineteId);
    await ctx.close();
  });

  it('GET /api/stats/dashboard returns aggregated KPIs', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/stats/dashboard')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it('GET /api/stats/kpis returns KPI metrics', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/stats/kpis')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it('GET /api/stats/rentabilidade returns profitability numbers', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/stats/rentabilidade')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });
});
