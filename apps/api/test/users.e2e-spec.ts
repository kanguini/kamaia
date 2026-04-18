import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { cleanupGabinete, seedGabineteWithUser, TestUserFixture } from './helpers/fixtures';

describe('Users (e2e)', () => {
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

  it('GET /api/users/me returns the authenticated user', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data?.email).toBe(user.email);
  });

  it('PUT /api/users/me updates profile fields', async () => {
    const res = await request(ctx.app.getHttpServer())
      .put('/api/users/me')
      .set('Authorization', auth())
      .send({ firstName: 'Atualizado', lastName: 'Nome' });

    expect(res.status).toBe(200);
    expect(res.body.data?.firstName).toBe('Atualizado');
  });

  it('POST /api/users/me/change-password rejects wrong current password', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/users/me/change-password')
      .set('Authorization', auth())
      .send({ currentPassword: 'wrong-password', newPassword: 'NewPass@123' });

    expect([400, 401]).toContain(res.status);
  });
});
