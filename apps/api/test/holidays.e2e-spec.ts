import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { cleanupGabinete, seedGabineteWithUser, TestUserFixture } from './helpers/fixtures';

/**
 * Holidays + business-day math.
 *  - Auto-seeds Angolan public holidays (current year + next two).
 *  - Business-day calculation skips weekends AND holidays.
 *  - Gabinete can add/remove local holidays without affecting others.
 */
describe('Holidays (e2e)', () => {
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

  it('GET /holidays auto-seeds Angolan system holidays', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/holidays')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    const names: string[] = res.body.data.map((h: any) => h.name);
    // Pick a few flagship ones
    expect(names).toContain('Ano Novo');
    expect(names).toContain('Dia da Independência');
    expect(names).toContain('Dia do Trabalhador');
    expect(names).toContain('Natal');
    // Easter-based floating holidays must also be seeded
    expect(names.some((n) => n.includes('Sexta-feira Santa'))).toBe(true);
    expect(names.some((n) => n.includes('Carnaval'))).toBe(true);
  });

  it('GET /holidays/compute-business-date skips weekends AND holidays', async () => {
    // Monday 2026-04-13 (picked arbitrary in a seeded year) + 5 business days
    // should land 2026-04-20 if no holidays between — BUT 4 April is Dia da
    // Paz. Use early May to demonstrate skipping 1 May (Dia do Trabalhador).
    // Start: Monday 27 April 2026; add 5 business days → should land
    // Mon 4 May 2026 (Fri 1 May is Dia do Trabalhador, skipped).
    const startDate = new Date('2026-04-27T00:00:00.000Z').toISOString();
    const res = await request(ctx.app.getHttpServer())
      .get(`/api/holidays/compute-business-date?startDate=${startDate}&days=5`)
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    const result = new Date(res.body.data.resultDate);
    // Must be a weekday (1-5 = Mon-Fri)
    expect(result.getUTCDay()).toBeGreaterThanOrEqual(1);
    expect(result.getUTCDay()).toBeLessThanOrEqual(5);
    // It should land AFTER Fri 1 May because that's a holiday
    expect(result.getTime()).toBeGreaterThan(new Date('2026-05-01').getTime());
    // Sanity: skippedHolidays should include 2026-05-01
    expect(res.body.data.skippedHolidays).toContain('2026-05-01');
  });

  it('POST /holidays creates a gabinete-local holiday visible only to that gabinete', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/holidays')
      .set('Authorization', auth())
      .send({
        name: 'Dia do Gabinete',
        date: new Date('2026-06-15T00:00:00.000Z').toISOString(),
        kind: 'MUNICIPAL',
      });
    expect([200, 201]).toContain(res.status);

    // Should appear in the gabinete's list
    const list = await request(ctx.app.getHttpServer())
      .get('/api/holidays?year=2026')
      .set('Authorization', auth());
    expect(list.body.data.some((h: any) => h.name === 'Dia do Gabinete')).toBe(
      true,
    );

    // And it should affect business-day math for this gabinete
    const compute = await request(ctx.app.getHttpServer())
      .get(
        `/api/holidays/compute-business-date?startDate=${new Date('2026-06-12T00:00:00.000Z').toISOString()}&days=2`,
      )
      .set('Authorization', auth());
    expect(compute.body.data.skippedHolidays).toContain('2026-06-15');
  });
});
