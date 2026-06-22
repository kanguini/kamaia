/**
 * Importação em lote — E2E.
 *
 * Cobre:
 *   - Criar lote
 *   - Adicionar linhas
 *   - Start → processarSincrono cria contratos REPOSITORIO
 *   - Estados das linhas: PENDENTE → CRIADO
 *   - Estado do lote: EM_FILA → PROCESSANDO → CONCLUIDO
 *   - Idempotência de start (chamar 2x não duplica contratos)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  LinhaEstado,
  LoteEstado,
  Role,
  TenantPlan,
  TenantStatus,
} from '@kamaia/shared-types';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Importação em lote (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let tenantId: string;
  let token: string;

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
        slug: `imp-${stamp}`,
        nome: 'Importacao Test',
        plan: TenantPlan.GROWTH,
        status: TenantStatus.ACTIVE,
      },
    });
    tenantId = tenant.id;

    const pwd = await bcrypt.hash('Test2026!', 10);
    const user = await prisma.user.create({
      data: {
        email: `imp-${stamp}@kamaia.dev`,
        passwordHash: pwd,
        firstName: 'Imp',
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
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  let loteId: string;

  it('1. Cria lote em EM_FILA', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/importacao/lotes')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({ nome: 'Carteira legada Q2 2026' });

    expect(res.status).toBe(201);
    expect(res.body.estado).toBe(LoteEstado.EM_FILA);
    expect(res.body.totalLinhas).toBe(0);
    loteId = res.body.id;
  });

  it('2. Adiciona 3 linhas — totalLinhas sobe', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await request(app.getHttpServer())
        .post(`/api/importacao/lotes/${loteId}/linhas`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-Id', tenantId)
        .send({
          metadataInput: {
            titulo: `Contrato importado ${i + 1}`,
            valor: '10000000',
            moeda: 'AKZ',
          },
        });
      expect(res.status).toBe(201);
      expect(res.body.estado).toBe(LinhaEstado.PENDENTE);
    }

    const lote = await request(app.getHttpServer())
      .get(`/api/importacao/lotes/${loteId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(lote.body.totalLinhas).toBe(3);
  });

  it('3. Start → 201 + ok:true', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/importacao/lotes/${loteId}/start`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
  });

  it('4. Após processamento síncrono → CONCLUIDO + linhas CRIADO', async () => {
    // O processamento é síncrono no MVP, então no momento do GET já está pronto
    const detail = await request(app.getHttpServer())
      .get(`/api/importacao/lotes/${loteId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);

    expect(detail.body.estado).toBe(LoteEstado.CONCLUIDO);
    expect(detail.body.processadas).toBe(3);
    expect(detail.body.falhas).toBe(0);

    // Linhas devem ter contratoId preenchido
    const linhas = await prisma.importacaoLinha.findMany({
      where: { loteId },
    });
    expect(linhas).toHaveLength(3);
    for (const l of linhas) {
      expect(l.estado).toBe(LinhaEstado.CRIADO);
      expect(l.contratoId).not.toBeNull();
    }
  });

  it('5. Contratos criados estão em REPOSITORIO ou ACTIVO', async () => {
    const linhas = await prisma.importacaoLinha.findMany({
      where: { loteId },
    });
    const contratos = await prisma.contrato.findMany({
      where: { id: { in: linhas.map((l) => l.contratoId!) } },
    });
    expect(contratos.length).toBe(3);
    for (const c of contratos) {
      expect(['REPOSITORIO', 'ACTIVO']).toContain(c.estado);
      expect(c.origem).toBe('IMPORTADO_REPOSITORIO');
    }
  });

  it('6. Lista lotes por estado', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/importacao/lotes?estado=CONCLUIDO')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    for (const l of res.body.data) {
      expect(l.estado).toBe(LoteEstado.CONCLUIDO);
    }
  });

  it('7. Start de lote já processado é idempotente (não cria contratos duplicados)', async () => {
    const antes = await prisma.contrato.count({ where: { tenantId } });
    const res = await request(app.getHttpServer())
      .post(`/api/importacao/lotes/${loteId}/start`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    // Pode retornar 200 (já processado) ou 400 (estado inválido) — tolerar ambos
    expect([200, 201, 400]).toContain(res.status);
    const depois = await prisma.contrato.count({ where: { tenantId } });
    expect(depois).toBe(antes);
  });
});
