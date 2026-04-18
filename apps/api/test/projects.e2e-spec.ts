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
});
