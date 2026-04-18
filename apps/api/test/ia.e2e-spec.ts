import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { cleanupGabinete, seedGabineteWithUser, TestUserFixture } from './helpers/fixtures';

/**
 * The IA module routes requests to Google Gemini. We don't hit the provider
 * here — only the endpoints that don't generate completions: list/get/delete
 * and the quota endpoint, which read local rows.
 */
describe('IA (e2e)', () => {
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

  it('GET /api/ia/conversations returns a list for the gabinete', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/ia/conversations')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it('GET /api/ia/quota returns monthly quota info (or 404 if not seeded)', async () => {
    // Seed a UsageQuota row so the endpoint resolves successfully. Normally
    // created during gabinete registration — fixture keeps seeding minimal.
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    await ctx.prisma.usageQuota.upsert({
      where: { gabineteId: user.gabineteId },
      update: {},
      create: {
        gabineteId: user.gabineteId,
        aiQueriesUsed: 0,
        storageUsedBytes: BigInt(0),
        periodStart: now,
        periodEnd: nextMonth,
      },
    });

    const res = await request(ctx.app.getHttpServer())
      .get('/api/ia/quota')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('limit');
    expect(res.body.data).toHaveProperty('used');
  });

  it('GET /api/ia/conversations without token returns 401', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/api/ia/conversations');
    expect(res.status).toBe(401);
  });
});
