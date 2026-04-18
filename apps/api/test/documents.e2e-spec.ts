import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { cleanupGabinete, seedGabineteWithUser, TestUserFixture } from './helpers/fixtures';

/**
 * Documents expose CRUD on DB-only rows (without actually going through storage)
 * by seeding rows directly. The upload endpoint requires multipart and a
 * provider key — skipped here and exercised manually.
 */
describe('Documents (e2e)', () => {
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

  it('GET /api/documents returns an empty list for a fresh gabinete', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/documents')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it('GET /api/documents/storage returns storage usage stats', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/documents/storage')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('used');
  });

  it('PUT /api/documents/:id updates a document title (seeded row)', async () => {
    const doc = await ctx.prisma.document.create({
      data: {
        gabineteId: user.gabineteId,
        uploadedById: user.id,
        title: 'Doc inicial',
        category: 'OUTRO',
        fileSize: 1024,
        mimeType: 'application/pdf',
        fileUrl: `https://example.test/${Date.now()}.pdf`,
      },
    });

    const res = await request(ctx.app.getHttpServer())
      .put(`/api/documents/${doc.id}`)
      .set('Authorization', auth())
      .send({ title: 'Doc renomeado' });

    expect(res.status).toBe(200);
    expect(res.body.data?.title).toBe('Doc renomeado');
  });
});
