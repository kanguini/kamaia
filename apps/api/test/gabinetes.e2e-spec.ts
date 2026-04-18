import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { cleanupGabinete, seedGabineteWithUser, TestUserFixture } from './helpers/fixtures';

describe('Gabinetes (e2e)', () => {
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

  it('GET /api/gabinetes/current returns the user gabinete', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/gabinetes/current')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data?.id).toBe(user.gabineteId);
  });

  it('PUT /api/gabinetes/current updates gabinete data', async () => {
    const res = await request(ctx.app.getHttpServer())
      .put('/api/gabinetes/current')
      .set('Authorization', auth())
      .send({ name: 'Gabinete Renomeado' });

    expect(res.status).toBe(200);
    expect(res.body.data?.name).toBe('Gabinete Renomeado');
  });

  it('GET /api/gabinetes/current without token returns 401', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/api/gabinetes/current');
    expect(res.status).toBe(401);
  });
});
