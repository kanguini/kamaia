import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { cleanupGabinete, seedGabineteWithUser, TestUserFixture } from './helpers/fixtures';

describe('Reports (e2e)', () => {
  let ctx: TestApp;
  let user: TestUserFixture;
  let clienteId: string;
  let processoId: string;
  const auth = () => `Bearer ${user.accessToken}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    user = await seedGabineteWithUser(ctx.app);

    const cliente = await ctx.prisma.cliente.create({
      data: { gabineteId: user.gabineteId, name: 'Cliente Report', type: 'INDIVIDUAL' },
    });
    clienteId = cliente.id;
    const processo = await ctx.prisma.processo.create({
      data: {
        gabineteId: user.gabineteId,
        clienteId: cliente.id,
        advogadoId: user.id,
        processoNumber: `P-REP-${Date.now()}`,
        title: 'Processo Report',
        type: 'CIVEL',
        priority: 'MEDIA',
        status: 'ACTIVO',
        stage: 'INICIAL',
      },
    });
    processoId = processo.id;
  });

  afterAll(async () => {
    await cleanupGabinete(ctx.prisma, user.gabineteId);
    await ctx.close();
  });

  it('GET /api/reports/processo/:id returns a processo report', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/api/reports/processo/${processoId}`)
      .set('Authorization', auth());

    // Report endpoint may return JSON or a PDF stream — just assert success.
    expect([200, 201]).toContain(res.status);
  });

  it('GET /api/reports/cliente/:id returns a cliente report', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/api/reports/cliente/${clienteId}`)
      .set('Authorization', auth());

    expect([200, 201]).toContain(res.status);
  });

  it('GET /api/reports/dashboard returns dashboard report data', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/reports/dashboard')
      .set('Authorization', auth());

    expect([200, 201]).toContain(res.status);
  });
});
