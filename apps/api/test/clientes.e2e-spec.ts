import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { cleanupGabinete, seedGabineteWithUser, TestUserFixture } from './helpers/fixtures';

describe('Clientes (e2e)', () => {
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

  it('GET /api/clientes returns empty list for a fresh gabinete', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/clientes')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data?.data)).toBe(true);
    expect(res.body.data.total).toBe(0);
  });

  it('POST /api/clientes creates a cliente for the current gabinete', async () => {
    const shortNif = `NIF${Date.now().toString().slice(-10)}`; // max 20 chars
    const res = await request(ctx.app.getHttpServer())
      .post('/api/clientes')
      .set('Authorization', auth())
      .send({
        name: 'João Teste',
        type: 'INDIVIDUAL',
        nif: shortNif,
        email: `joao-${Date.now()}@test.kamaia`,
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.data?.id).toBeTruthy();
    expect(res.body.data?.gabineteId).toBe(user.gabineteId);
  });

  it('POST /api/clientes rejects duplicate NIF with NIF_EXISTS', async () => {
    // NIF max length is 20 in the DTO — keep well under that
    const nif = `DUP${Date.now().toString().slice(-10)}`;
    await request(ctx.app.getHttpServer())
      .post('/api/clientes')
      .set('Authorization', auth())
      .send({ name: 'First', type: 'INDIVIDUAL', nif });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/clientes')
      .set('Authorization', auth())
      .send({ name: 'Second', type: 'INDIVIDUAL', nif });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NIF_EXISTS');
  });
});
