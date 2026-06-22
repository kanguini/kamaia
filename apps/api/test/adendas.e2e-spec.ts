/**
 * Adendas — fluxo E2E.
 *
 * Cobre:
 *   - Criar adenda sobre contrato ACTIVO (pai transita para EM_ADENDA)
 *   - Adenda herda partes do pai por defeito
 *   - Numeração `{numeroPai}-A01`, `-A02`, ...
 *   - Adenda NÃO pode ser criada se pai não está ACTIVO (400)
 *   - Adenda NÃO pode ser criada sobre outra adenda (400)
 *   - GET /adendas lista adendas do pai
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

describe('Adendas (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  let tenantId: string;
  let token: string;
  let parentContratoId: string;

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
        slug: `adend-${stamp}`,
        nome: 'Adendas Test',
        plan: TenantPlan.GROWTH,
        status: TenantStatus.ACTIVE,
      },
    });
    tenantId = tenant.id;

    const pwd = await bcrypt.hash('Test2026!', 10);
    const user = await prisma.user.create({
      data: {
        email: `adendas-${stamp}@kamaia.dev`,
        passwordHash: pwd,
        firstName: 'A',
        lastName: 'D',
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

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Test2026!' });
    token = login.body.accessToken;

    // Cria entidades + contrato ACTIVO para servir de pai
    const tipo = await prisma.tipoContrato.findFirst({
      where: { codigo: 'PRESTACAO_SERVICOS', tenantId: null },
    });
    const self = await prisma.entidade.create({
      data: {
        tenantId,
        tipo: 'PESSOA_COLECTIVA',
        nome: 'Adenda Self',
        nacionalidadeCambial: 'RESIDENTE',
      },
    });
    const cp = await prisma.entidade.create({
      data: {
        tenantId,
        tipo: 'PESSOA_COLECTIVA',
        nome: 'Adenda Contraparte',
        nacionalidadeCambial: 'RESIDENTE',
      },
    });
    const parent = await prisma.contrato.create({
      data: {
        tenantId,
        numeroInterno: `ADEND-${stamp}-001`,
        titulo: 'Contrato pai',
        tipoId: tipo!.id,
        estado: ContratoEstado.ACTIVO,
        origem: 'CRIADO_INTERNAMENTE',
        valor: 10_000_000_00n,
        moeda: 'AKZ',
      },
    });
    parentContratoId = parent.id;
    await prisma.contratoParte.createMany({
      data: [
        { contratoId: parent.id, entidadeId: self.id, papel: PartePapel.PARTE_PRINCIPAL, ordem: 0 },
        { contratoId: parent.id, entidadeId: cp.id, papel: PartePapel.CONTRAPARTE, ordem: 1 },
      ],
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('cria adenda sobre contrato ACTIVO', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/contratos/${parentContratoId}/adendas`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({
        titulo: 'Adenda 1 — extensão de prazo',
        descricao: 'Estender por mais 12 meses',
        herdarPartes: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.parentContratoId).toBe(parentContratoId);
    expect(res.body.estado).toBe(ContratoEstado.DRAFTING);
    expect(res.body.numeroInterno).toMatch(/-A01$/);
  });

  it('pai transitou para EM_ADENDA', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/contratos/${parentContratoId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe(ContratoEstado.EM_ADENDA);
  });

  it('adenda herdou as 2 partes do pai', async () => {
    const adendas = await request(app.getHttpServer())
      .get(`/api/contratos/${parentContratoId}/adendas`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    const adendaId = adendas.body[0].id;

    const partes = await request(app.getHttpServer())
      .get(`/api/contratos/${adendaId}/partes`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(partes.status).toBe(200);
    expect(partes.body.length).toBe(2);
    expect(partes.body.map((p: { papel: string }) => p.papel)).toEqual(
      expect.arrayContaining(['PARTE_PRINCIPAL', 'CONTRAPARTE']),
    );
  });

  it('lista adendas do pai', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/contratos/${parentContratoId}/adendas`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('NÃO cria adenda quando o pai está EM_ADENDA (não ACTIVO)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/contratos/${parentContratoId}/adendas`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({ titulo: 'Adenda 2 — deve falhar' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/ACTIVO/i);
  });

  it('NÃO cria adenda sobre outra adenda', async () => {
    // Volta o pai a ACTIVO manualmente para permitir nova adenda
    await prisma.contrato.update({
      where: { id: parentContratoId },
      data: { estado: ContratoEstado.ACTIVO },
    });
    const novaAdenda = await request(app.getHttpServer())
      .post(`/api/contratos/${parentContratoId}/adendas`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({ titulo: 'Adenda 2 — válida' });
    expect(novaAdenda.status).toBe(201);
    expect(novaAdenda.body.numeroInterno).toMatch(/-A02$/);

    // Reposicionar pai para ACTIVO de novo
    await prisma.contrato.update({
      where: { id: parentContratoId },
      data: { estado: ContratoEstado.ACTIVO },
    });
    // Tentar criar adenda da adenda (que tem parentContratoId)
    const res = await request(app.getHttpServer())
      .post(`/api/contratos/${novaAdenda.body.id}/adendas`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({ titulo: 'Adenda de adenda — deve falhar' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/adenda/i);
  });
});
