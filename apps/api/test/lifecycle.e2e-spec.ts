/**
 * Contract full lifecycle — E2E.
 *
 * Percorre o ciclo de vida completo de um contrato, verificando
 * em cada passo:
 *   - State machine permite a transição
 *   - Audit log + ContratoEvento foram escritos
 *   - Compliance engine disparou nos estados certos
 *   - Webhooks foram enfileirados (via WebhookDelivery)
 *
 * Cenário: prestação de serviços USD 100k para não-residente.
 *
 *   INTAKE
 *     → DRAFTING (add partes + valor)
 *     → REV_INTERNA
 *     → REV_CLIENTE
 *     → EM_NEGOCIACAO
 *     → APROVACAO
 *     → PRONTO_ASSINATURA
 *     → ASSINADO          (compliance engine dispara IS+BNA+AGT)
 *     → POS_ASSINATURA
 *     → ACTIVO
 *     → EM_ADENDA         (criada adenda)
 *     → ACTIVO            (adenda concluída)
 *     → EM_TERMINACAO     (via terminacao.registar)
 *     → TERMINADO
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  ContratoEstado,
  PartePapel,
  Role,
  TenantPlan,
  TenantStatus,
} from '@kamaia/shared-types';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Contract Lifecycle (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  let tenantId: string;
  let token: string;
  let contratoId: string;
  let selfEntId: string;
  let cpEntId: string;
  let tipoId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = new PrismaClient();

    const stamp = Date.now().toString(36);
    const tenant = await prisma.tenant.create({
      data: {
        slug: `lc-${stamp}`,
        nome: 'Lifecycle Test',
        plan: TenantPlan.GROWTH,
        status: TenantStatus.ACTIVE,
      },
    });
    tenantId = tenant.id;

    const pwd = await bcrypt.hash('Test2026!', 10);
    const user = await prisma.user.create({
      data: {
        email: `lc-${stamp}@kamaia.dev`,
        passwordHash: pwd,
        firstName: 'LC',
        lastName: 'Test',
      },
    });
    await prisma.membership.create({
      data: {
        userId: user.id,
        tenantId,
        role: Role.ADMIN,
        isDefault: true,
        acceptedAt: new Date(),
      },
    });
    token = (
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: user.email, password: 'Test2026!' })
    ).body.accessToken;

    // Subscrever a um webhook para validar que os eventos disparam
    const wh = await request(app.getHttpServer())
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({
        nome: 'lifecycle-hook',
        url: 'https://example.test/lc',
        events: [
          'contrato.criado',
          'contrato.estado_alterado',
          'contrato.assinado',
          'contrato.terminado',
          'acto_regulatorio.detectado',
        ],
      });
    expect(wh.status).toBe(201);

    // Setup: tipo + entidades
    const tipo = await prisma.tipoContrato.findFirst({
      where: { codigo: 'PRESTACAO_SERVICOS', tenantId: null },
    });
    tipoId = tipo!.id;

    const self = await request(app.getHttpServer())
      .post('/api/entidades')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({
        tipo: 'PESSOA_COLECTIVA',
        nome: 'Lifecycle Self Lda',
        nif: `LC-S-${stamp}`,
        nacionalidadeCambial: 'RESIDENTE',
      });
    selfEntId = self.body.id;

    const cp = await request(app.getHttpServer())
      .post('/api/entidades')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({
        tipo: 'PESSOA_COLECTIVA',
        nome: 'Lifecycle Counterparty Inc',
        nif: `LC-C-${stamp}`,
        nacionalidadeCambial: 'NAO_RESIDENTE',
        paisResidencia: 'US',
      });
    cpEntId = cp.body.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  async function transitar(para: ContratoEstado, motivo?: string): Promise<void> {
    const res = await request(app.getHttpServer())
      .post(`/api/contratos/${contratoId}/transicao`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({ para, motivo });
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe(para);
  }

  it('1. Cria contrato em INTAKE', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/contratos')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({
        titulo: 'Lifecycle test contract',
        tipoId,
        valor: '10000000000',
        moeda: 'USD',
        valorEmAKZ: '8500000000000',
        leiAplicavel: 'Lei angolana',
        dataAssinatura: '2026-06-22',
      });
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe(ContratoEstado.INTAKE);
    contratoId = res.body.id;
  });

  it('2. Add partes', async () => {
    await request(app.getHttpServer())
      .post(`/api/contratos/${contratoId}/partes`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({ entidadeId: selfEntId, papel: PartePapel.PARTE_PRINCIPAL });
    await request(app.getHttpServer())
      .post(`/api/contratos/${contratoId}/partes`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({ entidadeId: cpEntId, papel: PartePapel.CONTRAPARTE });
  });

  it('3. Caminho longo: DRAFTING → REV_INTERNA → REV_CLIENTE → EM_NEGOCIACAO → APROVACAO → PRONTO_ASSINATURA → ASSINADO', async () => {
    await transitar(ContratoEstado.DRAFTING);
    await transitar(ContratoEstado.REV_INTERNA);
    await transitar(ContratoEstado.REV_CLIENTE);
    await transitar(ContratoEstado.EM_NEGOCIACAO);
    await transitar(ContratoEstado.APROVACAO);
    await transitar(ContratoEstado.PRONTO_ASSINATURA);
    await transitar(ContratoEstado.ASSINADO);
  }, 30_000);

  it('4. ASSINADO disparou ComplianceEngine (3 actos: IS+BNA+AGT)', async () => {
    const detail = await request(app.getHttpServer())
      .get(`/api/contratos/${contratoId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(detail.status).toBe(200);
    const tipos = detail.body.actosRegulatorios.map(
      (a: { tipo: string }) => a.tipo,
    );
    expect(tipos).toEqual(
      expect.arrayContaining(['IMPOSTO_SELO', 'BNA_AUTORIZACAO', 'AGT_RETENCAO_IRT']),
    );
    // IS é Verba 23.3 (7%) sobre USD 100M (10_000_000_00 centavos) = 700_000_000
    const is = detail.body.actosRegulatorios.find(
      (a: { tipo: string }) => a.tipo === 'IMPOSTO_SELO',
    );
    expect(is.valorLiquidar).toBe('700000000');
    expect(is.tgisVerbaNumero).toBe('23.3');
  });

  it('5. POS_ASSINATURA → ACTIVO', async () => {
    await transitar(ContratoEstado.POS_ASSINATURA);
    await transitar(ContratoEstado.ACTIVO);
  });

  it('6. Cria adenda — contrato vai a EM_ADENDA', async () => {
    const adenda = await request(app.getHttpServer())
      .post(`/api/contratos/${contratoId}/adendas`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({ titulo: 'Lifecycle adenda 1', herdarPartes: true });
    expect(adenda.status).toBe(201);
    expect(adenda.body.parentContratoId).toBe(contratoId);

    const detail = await request(app.getHttpServer())
      .get(`/api/contratos/${contratoId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(detail.body.estado).toBe(ContratoEstado.EM_ADENDA);
  });

  it('7. EM_ADENDA → ACTIVO (adenda finalizou, regressa)', async () => {
    await transitar(ContratoEstado.ACTIVO);
  });

  it('8. Regista terminação — estado TERMINADO', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/contratos/${contratoId}/terminacao`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({
        tipo: 'DENUNCIA_TEMPESTIVA',
        dataEfectiva: '2027-12-31',
        motivacao: 'Cliente exerceu direito de denúncia.',
      });
    expect(res.status).toBe(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/contratos/${contratoId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(detail.body.estado).toBe(ContratoEstado.TERMINADO);
    expect(detail.body.terminacao.tipo).toBe('DENUNCIA_TEMPESTIVA');
  });

  it('9. Timeline tem ≥12 eventos com tipos esperados', async () => {
    const events = await request(app.getHttpServer())
      .get(`/api/contratos/${contratoId}/eventos?limit=50`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(events.status).toBe(200);
    expect(events.body.length).toBeGreaterThanOrEqual(12);
    const tipos = events.body.map((e: { tipo: string }) => e.tipo);
    expect(tipos).toEqual(
      expect.arrayContaining([
        'CRIADO',
        'PARTE_ADICIONADA',
        'ESTADO_ALTERADO',
        'ACTO_DETECTADO',
        'ADENDA_CRIADA',
        'TERMINADO',
      ]),
    );
  });

  it('10. Webhook deliveries foram enfileiradas para os eventos', async () => {
    // Conta deliveries para o webhook deste tenant
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhook: { tenantId } },
    });
    expect(deliveries.length).toBeGreaterThan(0);
    const events = deliveries.map((d) => d.event);
    expect(events).toEqual(
      expect.arrayContaining([
        'contrato.criado',
        'contrato.estado_alterado',
        'contrato.assinado',
        'contrato.terminado',
      ]),
    );
    // Pelo menos 3 actos detectados
    expect(events.filter((e) => e === 'acto_regulatorio.detectado').length).toBe(3);
  });

  it('11. Transição ilegal final: TERMINADO → ACTIVO rejeitada', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/contratos/${contratoId}/transicao`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({ para: ContratoEstado.ACTIVO });
    expect(res.status).toBe(400);
  });
});
