import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { cleanupGabinete, seedGabineteWithUser, TestUserFixture } from './helpers/fixtures';

describe('Notifications (e2e)', () => {
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

  it('GET /api/notifications returns a paginated list', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it('GET /api/notifications/unread-count returns a numeric count', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/notifications/unread-count')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(typeof res.body.data?.count).toBe('number');
  });

  it('GET /api/notifications/preferences returns default preferences', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/notifications/preferences')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });
});
