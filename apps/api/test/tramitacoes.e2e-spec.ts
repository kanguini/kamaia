import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import {
  cleanupGabinete,
  seedGabineteWithUser,
  TestUserFixture,
} from './helpers/fixtures';

describe('Tramitacoes (e2e)', () => {
  let ctx: TestApp;
  let user: TestUserFixture;
  let processoId: string;
  const auth = () => `Bearer ${user.accessToken}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    user = await seedGabineteWithUser(ctx.app);

    const cliente = await ctx.prisma.cliente.create({
      data: {
        gabineteId: user.gabineteId,
        name: 'Cliente Tram',
        type: 'INDIVIDUAL',
      },
    });
    const processo = await ctx.prisma.processo.create({
      data: {
        gabineteId: user.gabineteId,
        clienteId: cliente.id,
        advogadoId: user.id,
        processoNumber: `P-TRM-${Date.now()}`,
        title: 'Processo Tramitação',
        type: 'CIVEL',
        priority: 'MEDIA',
        status: 'ACTIVO',
        stage: 'Petição Inicial',
      },
    });
    processoId = processo.id;
  });

  afterAll(async () => {
    await cleanupGabinete(ctx.prisma, user.gabineteId);
    await ctx.close();
  });

  it('GET /api/tramitacoes/vocabulary devolve vocabulário + templates', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/tramitacoes/vocabulary')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data?.actoTypes)).toBe(true);
    expect(res.body.data.actoTypes.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.data?.templates)).toBe(true);
    expect(res.body.data.templates.length).toBeGreaterThan(0);
  });

  it('POST /api/tramitacoes cria um acto processual', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/tramitacoes')
      .set('Authorization', auth())
      .send({
        processoId,
        autor: 'NOS',
        actoType: 'contestacao',
        title: 'Contestação apresentada',
        description: 'Entregue via CITIUS',
        actoDate: new Date().toISOString().slice(0, 10),
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.data?.id).toBeTruthy();
    expect(res.body.data?.autor).toBe('NOS');
    expect(res.body.data?.actoType).toBe('contestacao');
  });

  it('POST /api/tramitacoes rejeita actoType desconhecido', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/tramitacoes')
      .set('Authorization', auth())
      .send({
        processoId,
        autor: 'NOS',
        actoType: 'tipo-inexistente-xyz',
        title: 'Acto inválido',
        actoDate: new Date().toISOString().slice(0, 10),
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_ACTO_TYPE');
  });

  it('POST /api/tramitacoes/from-template gera Prazo automaticamente (citacao-recebida)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/tramitacoes/from-template')
      .set('Authorization', auth())
      .send({
        processoId,
        templateKey: 'citacao-recebida',
        actoDate: new Date().toISOString().slice(0, 10),
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.data?.actoType).toBe('citacao');
    expect(res.body.data?.autor).toBe('TRIBUNAL');
    // Template gera Prazo (20d) e avança fase
    expect(res.body.data?.generatedPrazoId).toBeTruthy();
    expect(res.body.data?.generatedPrazo?.type).toBe('CONTESTACAO');
    expect(res.body.data?.advancedToStage).toBe('citacao');
  });

  it('GET /api/tramitacoes filtra por processo e devolve lista', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/api/tramitacoes?processoId=${processoId}`)
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data?.data)).toBe(true);
    expect(res.body.data.data.length).toBeGreaterThanOrEqual(2);
  });
});
