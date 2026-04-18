import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { cleanupGabinete, seedGabineteWithUser, TestUserFixture } from './helpers/fixtures';

describe('Workflows (e2e)', () => {
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

  it('POST /api/workflows/seed seeds default workflows for the gabinete', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/workflows/seed')
      .set('Authorization', auth());

    expect([200, 201]).toContain(res.status);
    expect(res.body.data.created).toBeGreaterThan(0);
  });

  it('GET /api/workflows lists seeded workflows with stages', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/workflows?scope=PROCESSO')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const civel = res.body.data.find((w: any) => w.appliesTo.includes('CIVEL'));
    expect(civel).toBeDefined();
    // Tréplica and Quadruplica must be present — the core user request
    const labels = civel.stages.map((s: any) => s.label);
    expect(labels).toContain('Tréplica');
    expect(labels).toContain('Quadruplica');
  });

  it('POST /api/workflows/:id/stages adds a new custom stage', async () => {
    const list = await request(ctx.app.getHttpServer())
      .get('/api/workflows?scope=PROCESSO&appliesTo=LABORAL')
      .set('Authorization', auth());

    const workflowId = list.body.data[0].id;
    const res = await request(ctx.app.getHttpServer())
      .post(`/api/workflows/${workflowId}/stages`)
      .set('Authorization', auth())
      .send({
        key: 'incidente-laboral',
        label: 'Incidente Laboral',
        allowsParallel: true,
        color: '#F59E0B',
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.data.label).toBe('Incidente Laboral');
    expect(res.body.data.allowsParallel).toBe(true);
  });
});
