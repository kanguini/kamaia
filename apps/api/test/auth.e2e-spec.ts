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

  it('POST /api/auth/forgot-password + reset-password flow', async () => {
    // Request reset — always returns 200 even if email doesn't exist
    const fake = await request(ctx.app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@example.test' });
    expect([200, 201]).toContain(fake.status);

    const real = await request(ctx.app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: user.email });
    expect([200, 201]).toContain(real.status);

    // For the test we sign the reset token manually (same algorithm as
    // the service) so we don't need a mail inbox.
    const jwt = await import('@nestjs/jwt');
    const jwtService = new jwt.JwtService({
      secret: process.env.JWT_SECRET ?? 'test-jwt-secret-for-e2e',
      signOptions: { expiresIn: '1h' },
    });
    const token = jwtService.sign({ sub: user.id, purpose: 'password-reset' });

    // Reset with bad token → 401
    const bad = await request(ctx.app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token: 'not-a-real-token-xxxxxxxx', newPassword: 'NovaPass@2026' });
    expect([400, 401]).toContain(bad.status);

    // Reset with good token → 201
    const ok = await request(ctx.app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'NovaPass@2026' });
    expect([200, 201]).toContain(ok.status);

    // Login with new password works
    const login = await request(ctx.app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: 'NovaPass@2026' });
    expect([200, 201]).toContain(login.status);

    // Update the test user's password in-memory for any subsequent tests
    user.password = 'NovaPass@2026';
  });

  it('GET /api/auth/me returns the current user when authorised', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data?.email).toBe(user.email);
  });
});
