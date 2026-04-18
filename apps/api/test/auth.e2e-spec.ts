import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { cleanupGabinete, seedGabineteWithUser, TestUserFixture } from './helpers/fixtures';

describe('Auth (e2e)', () => {
  let ctx: TestApp;
  let user: TestUserFixture;

  beforeAll(async () => {
    ctx = await createTestApp();
    user = await seedGabineteWithUser(ctx.app);
  });

  afterAll(async () => {
    await cleanupGabinete(ctx.prisma, user.gabineteId);
    await ctx.close();
  });

  it('POST /api/auth/login authenticates with valid credentials', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });

    expect([200, 201]).toContain(res.status);
    expect(res.body.data?.tokens?.accessToken).toBeTruthy();
    expect(res.body.data?.user?.email).toBe(user.email);
  });

  it('POST /api/auth/login rejects invalid credentials with 401', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrong-password-123' });

    expect(res.status).toBe(401);
    expect(res.body.error || res.body.message).toBeDefined();
  });

  it('GET /api/auth/me returns the current user when authorised', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data?.email).toBe(user.email);
  });
});
