import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { cleanupGabinete, seedGabineteWithUser, TestUserFixture } from './helpers/fixtures';

/**
 * Executive dashboard aggregator returns financial + operational + risk
 * + top WIP in a single payload, using data seeded across modules.
 */
describe('Executive Dashboard (e2e)', () => {
  let ctx: TestApp;
  let user: TestUserFixture;
  const auth = () => `Bearer ${user.accessToken}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    user = await seedGabineteWithUser(ctx.app, { role: 'SOCIO_GESTOR' });

    const cliente = await ctx.prisma.cliente.create({
      data: { gabineteId: user.gabineteId, name: 'Cliente Exec', type: 'INDIVIDUAL' },
    });
    const processo = await ctx.prisma.processo.create({
      data: {
        gabineteId: user.gabineteId,
        clienteId: cliente.id,
        advogadoId: user.id,
        processoNumber: `P-EXEC-${Date.now()}`,
        title: 'Processo Exec',
        type: 'CIVEL',
        priority: 'MEDIA',
        status: 'ACTIVO',
        stage: 'INICIAL',
        feeAmount: 10_000_00,
      },
    });

    // Unbilled billable time entry → should show in WIP
    await ctx.prisma.timeEntry.create({
      data: {
        gabineteId: user.gabineteId,
        processoId: processo.id,
        userId: user.id,
        category: 'PESQUISA',
        description: 'WIP research',
        date: new Date(),
        durationMinutes: 180, // 3 hours × 10k = 30k AKZ
        billable: true,
      },
    });

    // Overdue prazo
    await ctx.prisma.prazo.create({
      data: {
        gabineteId: user.gabineteId,
        processoId: processo.id,
        title: 'Contestação atrasada',
        type: 'CONTESTACAO',
        dueDate: new Date(Date.now() - 2 * 86_400_000),
        alertHoursBefore: 48,
        status: 'PENDENTE',
      },
    });

    // At-risk project
    await ctx.prisma.project.create({
      data: {
        gabineteId: user.gabineteId,
        clienteId: cliente.id,
        managerId: user.id,
        code: `EXEC-2026-001`,
        name: 'Projecto em risco',
        category: 'CONSULTORIA',
        status: 'ACTIVO',
        healthStatus: 'RED',
      },
    });
  });

  afterAll(async () => {
    await cleanupGabinete(ctx.prisma, user.gabineteId);
    await ctx.close();
  });

  it('GET /stats/executive returns the unified aggregator payload', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/stats/executive')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    const d = res.body.data;

    // Financial shape
    expect(d.financial).toBeDefined();
    expect(typeof d.financial.revenueBilledThisMonth).toBe('number');
    expect(typeof d.financial.outstandingTotal).toBe('number');
    expect(d.financial.wipValue).toBeGreaterThanOrEqual(30_000_00 - 1);

    // Operational
    expect(d.operational.billableHoursThisMonth).toBeGreaterThanOrEqual(3);
    expect(d.operational.activeProjects).toBeGreaterThanOrEqual(1);

    // Risk
    expect(d.risk.overduePrazos).toBeGreaterThanOrEqual(1);
    expect(d.risk.atRiskProjects.length).toBeGreaterThanOrEqual(1);
    expect(d.risk.atRiskProjects[0].healthStatus).toMatch(/RED|YELLOW/);

    // Top WIP
    expect(d.topWipClientes.length).toBeGreaterThanOrEqual(1);
    expect(d.topWipClientes[0].value).toBeGreaterThanOrEqual(30_000_00 - 1);
  });
});
