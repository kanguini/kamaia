import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { cleanupGabinete, seedGabineteWithUser, TestUserFixture } from './helpers/fixtures';

describe('Timesheets (e2e)', () => {
  let ctx: TestApp;
  let user: TestUserFixture;
  let processoId: string;
  const auth = () => `Bearer ${user.accessToken}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    user = await seedGabineteWithUser(ctx.app);

    const cliente = await ctx.prisma.cliente.create({
      data: { gabineteId: user.gabineteId, name: 'Cliente TS', type: 'INDIVIDUAL' },
    });
    const processo = await ctx.prisma.processo.create({
      data: {
        gabineteId: user.gabineteId,
        clienteId: cliente.id,
        advogadoId: user.id,
        processoNumber: `P-TS-${Date.now()}`,
        title: 'Processo TS',
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

  it('POST /api/timesheets creates a time entry', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/timesheets')
      .set('Authorization', auth())
      .send({
        processoId,
        category: 'PESQUISA',
        date: new Date().toISOString().slice(0, 10),
        durationMinutes: 90,
        description: 'Leitura processo',
        billable: true,
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.data?.id).toBeTruthy();
    expect(res.body.data?.durationMinutes).toBe(90);
  });

  it('GET /api/timesheets lists entries', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/timesheets')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it('GET /api/timesheets/summary returns per-processo totals', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/timesheets/summary')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    // Summary returns an array with {processoId, totalMinutes, ...}
    expect(Array.isArray(res.body.data)).toBe(true);
    const entry = res.body.data.find((r: { processoId: string }) => r.processoId === processoId);
    expect(entry).toBeDefined();
    expect(entry.totalMinutes).toBeGreaterThanOrEqual(90);
  });
});
