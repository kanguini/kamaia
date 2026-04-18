import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { cleanupGabinete, seedGabineteWithUser, TestUserFixture } from './helpers/fixtures';

describe('Tasks (Kanban) (e2e)', () => {
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

  it('POST /api/tasks/columns creates a kanban column', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/tasks/columns')
      .set('Authorization', auth())
      .send({ title: 'Por Fazer', color: '#3B82F6' });

    expect([200, 201]).toContain(res.status);
    expect(res.body.data?.id).toBeTruthy();
    expect(res.body.data?.title).toBe('Por Fazer');
  });

  it('GET /api/tasks/columns lists columns + nested tasks', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/tasks/columns')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/tasks creates a task inside a column', async () => {
    const column = await request(ctx.app.getHttpServer())
      .post('/api/tasks/columns')
      .set('Authorization', auth())
      .send({ title: 'Em Curso' });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/tasks')
      .set('Authorization', auth())
      .send({
        columnId: column.body.data.id,
        title: 'Preparar contestação',
        priority: 'ALTA',
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.data?.title).toBe('Preparar contestação');
  });
});
