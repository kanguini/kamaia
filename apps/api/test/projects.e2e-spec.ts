import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { cleanupGabinete, seedGabineteWithUser, TestUserFixture } from './helpers/fixtures';

describe('Projects (e2e)', () => {
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

  it('POST /api/projects creates a project with auto-attached workflow', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', auth())
      .send({
        name: 'Fusão X-Y',
        category: 'MA',
        scope: 'Operação de aquisição por parte da Empresa X',
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.data.code).toMatch(/^MA-\d{4}-\d{3}$/);
    expect(res.body.data.category).toBe('MA');
  });

  it('GET /api/projects lists created projects', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/projects?category=MA')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data.data.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/projects/:id/milestones adds a milestone', async () => {
    const create = await request(ctx.app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', auth())
      .send({ name: 'Compliance Programme 2026', category: 'COMPLIANCE' });

    const projectId = create.body.data.id;
    const due = new Date(Date.now() + 30 * 24 * 3600_000).toISOString();
    const res = await request(ctx.app.getHttpServer())
      .post(`/api/projects/${projectId}/milestones`)
      .set('Authorization', auth())
      .send({ title: 'Policy draft v1', dueDate: due });

    expect([200, 201]).toContain(res.status);
    expect(res.body.data.title).toBe('Policy draft v1');
  });

  it('link/unlink processo: POST + DELETE /api/projects/:id/processos/:processoId', async () => {
    // Seed cliente + processo unlinked
    const cliente = await ctx.prisma.cliente.create({
      data: { gabineteId: user.gabineteId, name: 'Cliente Link', type: 'INDIVIDUAL' },
    });
    const processo = await ctx.prisma.processo.create({
      data: {
        gabineteId: user.gabineteId,
        clienteId: cliente.id,
        advogadoId: user.id,
        processoNumber: `P-LINK-${Date.now()}`,
        title: 'Processo Linkable',
        type: 'CIVEL',
        priority: 'MEDIA',
        status: 'ACTIVO',
        stage: 'INICIAL',
      },
    });
    const project = await request(ctx.app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', auth())
      .send({ name: 'Projecto Link', category: 'LITIGIO' });
    const projectId = project.body.data.id;

    // Show in linkable list
    const list = await request(ctx.app.getHttpServer())
      .get(`/api/projects/${projectId}/linkable-processos`)
      .set('Authorization', auth());
    expect(list.status).toBe(200);
    expect(list.body.data.some((p: any) => p.id === processo.id)).toBe(true);

    // Link
    const linkRes = await request(ctx.app.getHttpServer())
      .post(`/api/projects/${projectId}/processos/${processo.id}`)
      .set('Authorization', auth());
    expect([200, 201]).toContain(linkRes.status);
    expect(linkRes.body.data.projectId).toBe(projectId);

    // Detail now shows it
    const detail = await request(ctx.app.getHttpServer())
      .get(`/api/projects/${projectId}`)
      .set('Authorization', auth());
    expect(detail.body.data.processos.some((p: any) => p.id === processo.id)).toBe(true);

    // Unlink
    const unlink = await request(ctx.app.getHttpServer())
      .delete(`/api/projects/${projectId}/processos/${processo.id}`)
      .set('Authorization', auth());
    expect(unlink.status).toBe(200);
  });

  it('GET /api/projects/:id/burndown returns a day-indexed series with actual vs ideal', async () => {
    const projRes = await request(ctx.app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', auth())
      .send({
        name: 'Projecto Burndown',
        category: 'CONSULTORIA',
        startDate: new Date(Date.now() - 5 * 86_400_000).toISOString(),
        endDate: new Date(Date.now() + 10 * 86_400_000).toISOString(),
        budgetAmount: 500_000_00, // 500k AOA in centavos
      });
    const projectId = projRes.body.data.id;

    const res = await request(ctx.app.getHttpServer())
      .get(`/api/projects/${projectId}/burndown`)
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data.budget).toBe(500_000_00);
    expect(Array.isArray(res.body.data.series)).toBe(true);
    expect(res.body.data.series.length).toBeGreaterThan(10);
    // Ideal should increase monotonically from 0 toward budget
    const last = res.body.data.series[res.body.data.series.length - 1];
    expect(last.idealSpent).toBeGreaterThanOrEqual(res.body.data.series[0].idealSpent);
  });

  it('GET /api/projects/templates returns the playbook catalog', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/projects/templates')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const ids = res.body.data.map((t: any) => t.id);
    // Must include the flagship playbooks
    expect(ids).toContain('ma-standard');
    expect(ids).toContain('compliance-programme');
    expect(ids).toContain('due-diligence-legal');
  });

  it('POST /api/projects/from-template materialises workflow + milestones', async () => {
    const startDate = new Date('2026-05-01T00:00:00Z').toISOString();
    const res = await request(ctx.app.getHttpServer())
      .post('/api/projects/from-template')
      .set('Authorization', auth())
      .send({
        templateId: 'ma-standard',
        name: 'Aquisição Alpha por Beta',
        startDate,
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.data.name).toBe('Aquisição Alpha por Beta');
    expect(res.body.data.category).toBe('MA');
    // The M&A template has 8 milestones
    expect(res.body.data.milestones.length).toBe(8);
    // First milestone should be "NDA assinado"
    expect(res.body.data.milestones[0].title).toBe('NDA assinado');
    // Workflow auto-attached
    expect(res.body.data.workflow?.stages?.length).toBeGreaterThan(0);
  });

  it('POST /api/projects/templates/duplicate copies a system template into the gabinete', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/projects/templates/duplicate')
      .set('Authorization', auth())
      .send({ systemId: 'ma-standard', name: 'MA do nosso gabinete' });

    expect([200, 201]).toContain(res.status);
    expect(res.body.data.basedOnSystemId).toBe('ma-standard');
    expect(res.body.data.name).toBe('MA do nosso gabinete');
    // Milestones copied over
    expect(Array.isArray(res.body.data.milestones)).toBe(true);
    expect(res.body.data.milestones.length).toBe(8);
  });

  it('PUT /api/projects/templates/:id updates custom template milestones', async () => {
    const dup = await request(ctx.app.getHttpServer())
      .post('/api/projects/templates/duplicate')
      .set('Authorization', auth())
      .send({ systemId: 'due-diligence-legal' });
    const templateId = dup.body.data.id;

    const res = await request(ctx.app.getHttpServer())
      .put(`/api/projects/templates/${templateId}`)
      .set('Authorization', auth())
      .send({
        name: 'DD customizada',
        defaultDurationDays: 14,
        milestones: [
          { title: 'Kickoff especial', startDayOffset: 0, dueDayOffset: 1 },
          { title: 'Relatório express', startDayOffset: 1, dueDayOffset: 14 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.defaultDurationDays).toBe(14);
    expect((res.body.data.milestones as any[]).length).toBe(2);

    // And listTemplates now returns it tagged as custom
    const list = await request(ctx.app.getHttpServer())
      .get('/api/projects/templates')
      .set('Authorization', auth());
    const found = list.body.data.find((t: any) => t.id === templateId);
    expect(found?.custom).toBe(true);
    expect(found?.name).toBe('DD customizada');
  });

  it('POST /api/projects/from-template works with a custom template id', async () => {
    const dup = await request(ctx.app.getHttpServer())
      .post('/api/projects/templates/duplicate')
      .set('Authorization', auth())
      .send({ systemId: 'consultoria-parecer', name: 'Parecer premium' });
    const customId = dup.body.data.id;

    const res = await request(ctx.app.getHttpServer())
      .post('/api/projects/from-template')
      .set('Authorization', auth())
      .send({ templateId: customId, name: 'Parecer para Cliente Z' });

    expect([200, 201]).toContain(res.status);
    expect(res.body.data.category).toBe('CONSULTORIA');
    expect(res.body.data.milestones.length).toBe(4);
  });

  it('alerts: drift + overdue milestone create notifications (POST /alerts/run)', async () => {
    // Seed a project with overdue milestone + budget hit
    const projRes = await request(ctx.app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', auth())
      .send({
        name: 'Projecto ao rubro',
        category: 'CONSULTORIA',
        startDate: new Date(Date.now() - 20 * 86_400_000).toISOString(),
        endDate: new Date(Date.now() + 20 * 86_400_000).toISOString(),
        budgetAmount: 100_000_00,
      });
    const projectId = projRes.body.data.id;

    // Overdue milestone (10 days past due)
    await request(ctx.app.getHttpServer())
      .post(`/api/projects/${projectId}/milestones`)
      .set('Authorization', auth())
      .send({
        title: 'Entregar draft',
        startDate: new Date(Date.now() - 15 * 86_400_000).toISOString(),
        dueDate: new Date(Date.now() - 10 * 86_400_000).toISOString(),
      });

    // Seed expense that blows past ideal (project is ~50% through the timeline,
    // ideal would be ~50k; we spend 95k, ratio > 1.15)
    const cliente = await ctx.prisma.cliente.create({
      data: { gabineteId: user.gabineteId, name: 'Cli Alert', type: 'INDIVIDUAL' },
    });
    const processo = await ctx.prisma.processo.create({
      data: {
        gabineteId: user.gabineteId,
        clienteId: cliente.id,
        advogadoId: user.id,
        processoNumber: `P-ALERT-${Date.now()}`,
        title: 'Processo alert',
        type: 'CIVEL',
        priority: 'MEDIA',
        status: 'ACTIVO',
        stage: 'INICIAL',
        projectId,
      },
    });
    await ctx.prisma.expense.create({
      data: {
        gabineteId: user.gabineteId,
        processoId: processo.id,
        userId: user.id,
        category: 'EMOLUMENTOS',
        description: 'Despesa elevada',
        amount: 95_000_00,
        date: new Date(),
      },
    });

    const run = await request(ctx.app.getHttpServer())
      .post('/api/projects/alerts/run')
      .set('Authorization', auth());

    expect(run.status).toBe(201);
    expect(run.body.data.driftAlerts).toBeGreaterThanOrEqual(1);
    expect(run.body.data.overdueAlerts).toBeGreaterThanOrEqual(1);

    // Notifications were created
    const notes = await ctx.prisma.notification.findMany({
      where: {
        gabineteId: user.gabineteId,
        type: { in: ['PROJECT_BUDGET_DRIFT', 'PROJECT_MILESTONE_OVERDUE'] },
      },
    });
    expect(notes.length).toBeGreaterThanOrEqual(2);

    // Second run should be deduped (same 24h window)
    const run2 = await request(ctx.app.getHttpServer())
      .post('/api/projects/alerts/run')
      .set('Authorization', auth());
    expect(run2.body.data.driftAlerts).toBe(0);
    expect(run2.body.data.overdueAlerts).toBe(0);
  });

  it('status reports: generate snapshot + edit narrative', async () => {
    const projRes = await request(ctx.app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', auth())
      .send({
        name: 'Projecto Reports',
        category: 'COMPLIANCE',
        startDate: new Date(Date.now() - 3 * 86_400_000).toISOString(),
        endDate: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        budgetAmount: 500_000_00,
      });
    const projectId = projRes.body.data.id;

    // Add a milestone — some completed, some overdue
    await request(ctx.app.getHttpServer())
      .post(`/api/projects/${projectId}/milestones`)
      .set('Authorization', auth())
      .send({
        title: 'Assessment',
        startDate: new Date(Date.now() - 10 * 86_400_000).toISOString(),
        dueDate: new Date(Date.now() - 5 * 86_400_000).toISOString(),
      });

    // Generate a report
    const gen = await request(ctx.app.getHttpServer())
      .post(`/api/projects/${projectId}/reports`)
      .set('Authorization', auth())
      .send({ summary: 'Primeira semana em curso', risks: [] });

    expect([200, 201]).toContain(gen.status);
    expect(gen.body.data.milestonesTotal).toBeGreaterThanOrEqual(1);
    expect(gen.body.data.milestonesOverdue).toBeGreaterThanOrEqual(1);
    // Health should default to YELLOW (overdue milestone) or RED
    expect(['YELLOW', 'RED']).toContain(gen.body.data.healthStatus);

    // Edit narrative
    const patch = await request(ctx.app.getHttpServer())
      .put(`/api/projects/reports/${gen.body.data.id}`)
      .set('Authorization', auth())
      .send({
        healthStatus: 'RED',
        summary: 'Atraso no assessment — reagendar kickoff',
        risks: [
          {
            title: 'Equipa sobrecarregada',
            severity: 'HIGH',
            mitigation: 'Alocar advogado adicional',
          },
        ],
      });
    expect(patch.status).toBe(200);
    expect(patch.body.data.healthStatus).toBe('RED');

    // List returns it
    const list = await request(ctx.app.getHttpServer())
      .get(`/api/projects/${projectId}/reports`)
      .set('Authorization', auth());
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBe(1);
  });

  it('capacity: returns planned vs actual grid per user × week', async () => {
    // Seed: create a project + link processo + add user as member with 50%
    // allocation + log time entries on the processo
    const cliente = await ctx.prisma.cliente.create({
      data: { gabineteId: user.gabineteId, name: 'Cli Cap', type: 'INDIVIDUAL' },
    });
    const processo = await ctx.prisma.processo.create({
      data: {
        gabineteId: user.gabineteId,
        clienteId: cliente.id,
        advogadoId: user.id,
        processoNumber: `P-CAP-${Date.now()}`,
        title: 'Processo Capacity',
        type: 'CIVEL',
        priority: 'MEDIA',
        status: 'ACTIVO',
        stage: 'INICIAL',
      },
    });
    const projRes = await request(ctx.app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', auth())
      .send({ name: 'Projecto Capacity', category: 'CONSULTORIA' });
    const projectId = projRes.body.data.id;

    await request(ctx.app.getHttpServer())
      .post(`/api/projects/${projectId}/processos/${processo.id}`)
      .set('Authorization', auth());

    // Update member allocation to 50% (manager already inserted)
    await request(ctx.app.getHttpServer())
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', auth())
      .send({ userId: user.id, role: 'RESPONSIBLE', allocationPct: 50 });

    // Log 10h this week
    const today = new Date().toISOString().slice(0, 10);
    await request(ctx.app.getHttpServer())
      .post('/api/timesheets')
      .set('Authorization', auth())
      .send({
        processoId: processo.id,
        category: 'PESQUISA',
        date: today,
        durationMinutes: 600,
        description: 'pesquisa extensa',
        billable: true,
      });

    const res = await request(ctx.app.getHttpServer())
      .get('/api/projects/capacity?weeks=2')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data.grid.length).toBeGreaterThanOrEqual(1);
    const me = res.body.data.grid.find((r: any) => r.user.id === user.id);
    expect(me).toBeDefined();
    expect(me.plannedPct).toBeGreaterThanOrEqual(50);
    // Current week bucket should have 600 actual minutes
    const currentWeek = me.weeks[0];
    expect(currentWeek.actualMinutes).toBeGreaterThanOrEqual(600);
    expect(currentWeek.plannedMinutes).toBeGreaterThan(0);
  });

  it('GET /api/projects/reports/:id/pdf streams a PDF', async () => {
    const projRes = await request(ctx.app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', auth())
      .send({
        name: 'Projecto PDF',
        category: 'CONSULTORIA',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 21 * 86_400_000).toISOString(),
        budgetAmount: 200_000_00,
      });
    const projectId = projRes.body.data.id;

    const gen = await request(ctx.app.getHttpServer())
      .post(`/api/projects/${projectId}/reports`)
      .set('Authorization', auth())
      .send({
        summary: 'Semana 1 — kickoff concluído',
        risks: [
          { title: 'Fonte de dados incompleta', severity: 'MEDIUM', mitigation: 'Pedir a X' },
        ],
      });

    const reportId = gen.body.data.id;
    const res = await request(ctx.app.getHttpServer())
      .get(`/api/projects/reports/${reportId}/pdf`)
      .set('Authorization', auth())
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    const body = res.body as Buffer;
    // PDF magic bytes
    expect(body.slice(0, 4).toString('utf8')).toBe('%PDF');
    expect(body.length).toBeGreaterThan(500);
  });

  it('POST /api/projects/from-template with unknown id returns 404', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/projects/from-template')
      .set('Authorization', auth())
      .send({ templateId: 'does-not-exist', name: 'X' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('TEMPLATE_NOT_FOUND');
  });

  it('PUT /api/projects/milestones/:id updates date range + progress (Gantt drag)', async () => {
    const create = await request(ctx.app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', auth())
      .send({ name: 'DD Operação Alpha', category: 'DUE_DILIGENCE' });

    const projectId = create.body.data.id;
    const startDate = new Date(Date.now() + 2 * 24 * 3600_000).toISOString();
    const dueDate = new Date(Date.now() + 10 * 24 * 3600_000).toISOString();
    const milestoneRes = await request(ctx.app.getHttpServer())
      .post(`/api/projects/${projectId}/milestones`)
      .set('Authorization', auth())
      .send({ title: 'Data room', startDate, dueDate });
    const mId = milestoneRes.body.data.id;

    // Simulate a Gantt drag: shift +3 days + mark 40% progress
    const newStart = new Date(Date.now() + 5 * 24 * 3600_000).toISOString();
    const newDue = new Date(Date.now() + 13 * 24 * 3600_000).toISOString();
    const res = await request(ctx.app.getHttpServer())
      .put(`/api/projects/milestones/${mId}`)
      .set('Authorization', auth())
      .send({ startDate: newStart, dueDate: newDue, progress: 40 });

    expect(res.status).toBe(200);
    expect(res.body.data.progress).toBe(40);
    // startDate/dueDate should reflect the shift (day-accurate comparison)
    expect(new Date(res.body.data.startDate).getUTCDate()).toBe(
      new Date(newStart).getUTCDate(),
    );
  });
});
