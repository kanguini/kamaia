import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { cleanupGabinete, seedGabineteWithUser, TestUserFixture } from './helpers/fixtures';

/**
 * Verifies that parallel stage instances work end-to-end:
 *  - A processo is created with the default workflow auto-attached
 *  - Entering "Tréplica" (articulado, non-parallel) closes previous stage
 *  - Entering "Incidente" (parallel) keeps "Tréplica" open simultaneously
 *  - Exiting an instance closes it
 */
describe('Processos — parallel stage instances (e2e)', () => {
  let ctx: TestApp;
  let user: TestUserFixture;
  let processoId: string;
  const auth = () => `Bearer ${user.accessToken}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    user = await seedGabineteWithUser(ctx.app);

    const cliente = await ctx.prisma.cliente.create({
      data: { gabineteId: user.gabineteId, name: 'Cliente Stages', type: 'INDIVIDUAL' },
    });
    const created = await request(ctx.app.getHttpServer())
      .post('/api/processos')
      .set('Authorization', auth())
      .send({
        title: 'Processo parallel',
        type: 'CIVEL',
        clienteId: cliente.id,
        priority: 'MEDIA',
      });
    processoId = created.body.data.id;
  });

  afterAll(async () => {
    await cleanupGabinete(ctx.prisma, user.gabineteId);
    await ctx.close();
  });

  it('has an EM_CURSO instance for the first stage right after creation', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/api/processos/${processoId}/stages`)
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    const active = res.body.data.filter((i: any) => i.status === 'EM_CURSO');
    expect(active.length).toBe(1);
  });

  it('entering Tréplica (non-parallel) closes the previous stage', async () => {
    // Find the CIVEL workflow + Tréplica stage
    const wfList = await request(ctx.app.getHttpServer())
      .get('/api/workflows?scope=PROCESSO&appliesTo=CIVEL')
      .set('Authorization', auth());
    const treplica = wfList.body.data[0].stages.find((s: any) => s.key === 'treplica');

    const enter = await request(ctx.app.getHttpServer())
      .post(`/api/processos/${processoId}/stages/enter`)
      .set('Authorization', auth())
      .send({ stageId: treplica.id });

    expect([200, 201]).toContain(enter.status);

    const list = await request(ctx.app.getHttpServer())
      .get(`/api/processos/${processoId}/stages`)
      .set('Authorization', auth());
    const active = list.body.data.filter((i: any) => i.status === 'EM_CURSO');
    expect(active.length).toBe(1);
    expect(active[0].stage.key).toBe('treplica');
  });

  it('entering Incidente (parallel) adds a second active stage', async () => {
    const wfList = await request(ctx.app.getHttpServer())
      .get('/api/workflows?scope=PROCESSO&appliesTo=CIVEL')
      .set('Authorization', auth());
    const incidente = wfList.body.data[0].stages.find((s: any) => s.key === 'incidente');

    const enter = await request(ctx.app.getHttpServer())
      .post(`/api/processos/${processoId}/stages/enter`)
      .set('Authorization', auth())
      .send({ stageId: incidente.id });

    expect([200, 201]).toContain(enter.status);

    const list = await request(ctx.app.getHttpServer())
      .get(`/api/processos/${processoId}/stages`)
      .set('Authorization', auth());
    const active = list.body.data.filter((i: any) => i.status === 'EM_CURSO');
    expect(active.length).toBe(2); // Tréplica + Incidente simultaneously
  });
});
