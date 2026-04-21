import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { cleanupGabinete, seedGabineteWithUser, TestUserFixture } from './helpers/fixtures';

describe('Team (e2e)', () => {
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

  it('GET /api/team/members returns the gabinete members', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/team/members')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/team/invite without email fails validation', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/team/invite')
      .set('Authorization', auth())
      .send({ firstName: 'Sem', lastName: 'Email', role: 'ADVOGADO_MEMBRO' });

    expect(res.status).toBe(400);
    // ParseZodPipe emite code=VALIDATION_FAILED com details[] do ZodError.
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it('POST /api/team/invite creates a new member', async () => {
    const email = `invited-${Date.now()}@test.kamaia`;
    const res = await request(ctx.app.getHttpServer())
      .post('/api/team/invite')
      .set('Authorization', auth())
      .send({
        email,
        firstName: 'Novo',
        lastName: 'Membro',
        role: 'ADVOGADO_MEMBRO',
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.data?.email).toBe(email);
  });
});
