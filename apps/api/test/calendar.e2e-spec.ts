import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { cleanupGabinete, seedGabineteWithUser, TestUserFixture } from './helpers/fixtures';

describe('Calendar (e2e)', () => {
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

  it('POST /api/calendar/events creates an event', async () => {
    const startAt = new Date(Date.now() + 3600_000).toISOString();
    const endAt = new Date(Date.now() + 2 * 3600_000).toISOString();

    const res = await request(ctx.app.getHttpServer())
      .post('/api/calendar/events')
      .set('Authorization', auth())
      .send({
        title: 'Reunião cliente',
        type: 'REUNIAO',
        startAt,
        endAt,
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.data?.id).toBeTruthy();
  });

  it('GET /api/calendar/events returns events in a date window', async () => {
    const startDate = new Date(Date.now() - 24 * 3600_000).toISOString();
    const endDate = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();

    const res = await request(ctx.app.getHttpServer())
      .get('/api/calendar/events')
      .query({ startDate, endDate })
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('PUT /api/calendar/events/:id updates an event title', async () => {
    const startAt = new Date(Date.now() + 3 * 3600_000).toISOString();
    const endAt = new Date(Date.now() + 4 * 3600_000).toISOString();
    const create = await request(ctx.app.getHttpServer())
      .post('/api/calendar/events')
      .set('Authorization', auth())
      .send({ title: 'Original', type: 'OUTRO', startAt, endAt });

    const id = create.body.data.id;
    const res = await request(ctx.app.getHttpServer())
      .put(`/api/calendar/events/${id}`)
      .set('Authorization', auth())
      .send({ title: 'Actualizado' });

    expect(res.status).toBe(200);
    expect(res.body.data?.title).toBe('Actualizado');
  });
});
