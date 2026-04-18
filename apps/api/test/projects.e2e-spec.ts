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
        budgetAmount: 500_000_00, // 500k AKZ in centavos
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
