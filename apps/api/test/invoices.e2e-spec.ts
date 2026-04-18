import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { cleanupGabinete, seedGabineteWithUser, TestUserFixture } from './helpers/fixtures';

/**
 * Full invoicing lifecycle:
 *   seed cliente + processo + timesheets + expense
 *   → preview-draft
 *   → create (lock TimeEntry/Expense)
 *   → send
 *   → record payment (partial + full)
 *   → PDF streams
 *   → void (unlocks)
 */
describe('Invoices (e2e)', () => {
  let ctx: TestApp;
  let user: TestUserFixture;
  const auth = () => `Bearer ${user.accessToken}`;
  let clienteId: string;
  let processoId: string;
  let timeEntryIds: string[] = [];
  let expenseIds: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    user = await seedGabineteWithUser(ctx.app, { role: 'SOCIO_GESTOR' });

    const cliente = await ctx.prisma.cliente.create({
      data: {
        gabineteId: user.gabineteId,
        name: 'Cliente Factura',
        type: 'INDIVIDUAL',
        nif: `N${Date.now().toString().slice(-10)}`,
      },
    });
    clienteId = cliente.id;
    const processo = await ctx.prisma.processo.create({
      data: {
        gabineteId: user.gabineteId,
        clienteId,
        advogadoId: user.id,
        processoNumber: `P-INV-${Date.now()}`,
        title: 'Processo factura',
        type: 'CIVEL',
        priority: 'MEDIA',
        status: 'ACTIVO',
        stage: 'INICIAL',
        feeAmount: 15_000_00, // 15k AKZ / hour
      },
    });
    processoId = processo.id;

    // 2 timesheets (total 3h billable) + 1 expense (5k AKZ)
    const t1 = await ctx.prisma.timeEntry.create({
      data: {
        gabineteId: user.gabineteId,
        processoId,
        userId: user.id,
        category: 'PESQUISA',
        description: 'Pesquisa jurisprudência',
        date: new Date(),
        durationMinutes: 120,
        billable: true,
      },
    });
    const t2 = await ctx.prisma.timeEntry.create({
      data: {
        gabineteId: user.gabineteId,
        processoId,
        userId: user.id,
        category: 'REDACCAO',
        description: 'Redacção peça',
        date: new Date(),
        durationMinutes: 60,
        billable: true,
      },
    });
    timeEntryIds = [t1.id, t2.id];

    const e1 = await ctx.prisma.expense.create({
      data: {
        gabineteId: user.gabineteId,
        processoId,
        userId: user.id,
        category: 'EMOLUMENTOS',
        description: 'Taxa de justiça',
        amount: 5_000_00,
        date: new Date(),
      },
    });
    expenseIds = [e1.id];
  });

  afterAll(async () => {
    await cleanupGabinete(ctx.prisma, user.gabineteId);
    await ctx.close();
  });

  it('POST /invoices/preview-draft lists unbilled entries + expenses', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/invoices/preview-draft')
      .set('Authorization', auth())
      .send({
        clienteId,
        dateFrom: new Date(Date.now() - 30 * 86_400_000).toISOString(),
        dateTo: new Date(Date.now() + 86_400_000).toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.data.timeEntries.length).toBe(2);
    expect(res.body.data.expenses.length).toBe(1);
  });

  let invoiceId: string;

  it('POST /invoices creates DRAFT + locks sources', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', auth())
      .send({
        clienteId,
        timeEntryIds,
        expenseIds,
        taxRate: 14,
        notes: 'Serviços jurídicos mês de Abril',
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.number).toMatch(/^\d{4}\/\d{4}$/);
    // 3h × 15k + 5k expense = 50k subtotal; IVA 14% = 7k; total 57k (centavos: 5.7M)
    expect(res.body.data.subtotal).toBe(3 * 15_000_00 + 5_000_00);
    expect(res.body.data.taxAmount).toBe(
      Math.round(res.body.data.subtotal * 0.14),
    );
    expect(res.body.data.total).toBe(
      res.body.data.subtotal + res.body.data.taxAmount,
    );
    expect(res.body.data.items.length).toBe(3);
    invoiceId = res.body.data.id;

    // Sources locked
    const lockedTime = await ctx.prisma.timeEntry.findFirst({
      where: { id: timeEntryIds[0] },
    });
    expect(lockedTime?.invoiceId).toBe(invoiceId);

    // Re-preview should now return empty (nothing left to bill)
    const preview = await request(ctx.app.getHttpServer())
      .post('/api/invoices/preview-draft')
      .set('Authorization', auth())
      .send({
        clienteId,
        dateFrom: new Date(Date.now() - 30 * 86_400_000).toISOString(),
        dateTo: new Date(Date.now() + 86_400_000).toISOString(),
      });
    expect(preview.body.data.timeEntries.length).toBe(0);
    expect(preview.body.data.expenses.length).toBe(0);
  });

  it('POST /invoices/:id/send transitions DRAFT → SENT', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/api/invoices/${invoiceId}/send`)
      .set('Authorization', auth());

    expect([200, 201]).toContain(res.status);
    expect(res.body.data.status).toBe('SENT');
    expect(res.body.data.sentAt).toBeTruthy();
  });

  it('POST /invoices/:id/payments — partial + full payment flips to PAID', async () => {
    const detail = await request(ctx.app.getHttpServer())
      .get(`/api/invoices/${invoiceId}`)
      .set('Authorization', auth());
    const total: number = detail.body.data.total;

    // Partial
    const p1 = await request(ctx.app.getHttpServer())
      .post(`/api/invoices/${invoiceId}/payments`)
      .set('Authorization', auth())
      .send({ amount: Math.floor(total / 2), method: 'TRANSFERENCIA' });
    expect([200, 201]).toContain(p1.status);
    expect(p1.body.data.newStatus).toBe('PARTIALLY_PAID');

    // Full
    const p2 = await request(ctx.app.getHttpServer())
      .post(`/api/invoices/${invoiceId}/payments`)
      .set('Authorization', auth())
      .send({ amount: total - Math.floor(total / 2), method: 'DINHEIRO' });
    expect(p2.body.data.newStatus).toBe('PAID');
  });

  it('GET /invoices/:id/pdf streams a PDF', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/api/invoices/${invoiceId}/pdf`)
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
    expect(body.slice(0, 4).toString('utf8')).toBe('%PDF');
    expect(body.length).toBeGreaterThan(500);
  });

  it('POST /invoices/:id/void unlocks sources', async () => {
    // Can't void a PAID invoice — seed a new draft for this test
    const t = await ctx.prisma.timeEntry.create({
      data: {
        gabineteId: user.gabineteId,
        processoId,
        userId: user.id,
        category: 'REUNIAO',
        description: 'Reunião',
        date: new Date(),
        durationMinutes: 30,
        billable: true,
      },
    });
    const draft = await request(ctx.app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', auth())
      .send({ clienteId, timeEntryIds: [t.id] });
    const draftId = draft.body.data.id;

    const res = await request(ctx.app.getHttpServer())
      .post(`/api/invoices/${draftId}/void`)
      .set('Authorization', auth());
    expect([200, 201]).toContain(res.status);

    const unlocked = await ctx.prisma.timeEntry.findFirst({ where: { id: t.id } });
    expect(unlocked?.invoiceId).toBeNull();
  });
});
