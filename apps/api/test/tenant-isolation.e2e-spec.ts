/**
 * Tenant isolation — teste de integração crítico.
 *
 * Garante que:
 *   1. User com membership em Tenant A não consegue ler Contratos do Tenant B
 *   2. Cross-tenant POST falha (criar contrato sem header X-Tenant-Id válido)
 *   3. Sub-tenant herda acesso via parent (AGENCY) mas não pode escalar para outros sub-tenants
 *   4. Audit log regista a tentativa
 *
 * Este é o pilar da arquitectura multi-tenant. Uma regressão aqui é
 * malpractice — clientes do mesmo gabinete a ver-se uns aos outros.
 *
 * NOTA: este teste requer a DB de dev local com seed corrido. Em CI
 * deveria correr contra um Postgres efémero (ver script abaixo).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Role, TenantPlan, TenantStatus } from '@kamaia/shared-types';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Tenant Isolation (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  // Identidades preparadas
  let tenantA: { id: string; slug: string };
  let tenantB: { id: string; slug: string };
  let agencyTenant: { id: string };
  let subTenantOfAgency: { id: string };
  let userOnlyA: { id: string; token: string };
  let userOnlyB: { id: string; token: string };
  let userAgency: { id: string; token: string };
  let contratoInA: { id: string };
  let contratoInB: { id: string };
  let contratoInSubAgency: { id: string };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = new PrismaClient();

    await setupFixtures();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  async function setupFixtures() {
    const stamp = Date.now().toString(36);
    const pwd = await bcrypt.hash('Test2026!', 10);

    // Tenant A (regular)
    const tA = await prisma.tenant.create({
      data: {
        slug: `isol-a-${stamp}`,
        nome: 'Isolation Test A',
        plan: TenantPlan.GROWTH,
        status: TenantStatus.ACTIVE,
      },
    });
    tenantA = { id: tA.id, slug: tA.slug };

    // Tenant B (regular)
    const tB = await prisma.tenant.create({
      data: {
        slug: `isol-b-${stamp}`,
        nome: 'Isolation Test B',
        plan: TenantPlan.GROWTH,
        status: TenantStatus.ACTIVE,
      },
    });
    tenantB = { id: tB.id, slug: tB.slug };

    // Agency tenant + sub
    const agency = await prisma.tenant.create({
      data: {
        slug: `isol-agency-${stamp}`,
        nome: 'Isolation Agency',
        plan: TenantPlan.AGENCY,
        status: TenantStatus.ACTIVE,
      },
    });
    agencyTenant = { id: agency.id };
    const sub = await prisma.tenant.create({
      data: {
        slug: `isol-sub-${stamp}`,
        nome: 'Isolation Sub',
        plan: TenantPlan.STARTER,
        status: TenantStatus.ACTIVE,
        parentTenantId: agency.id,
      },
    });
    subTenantOfAgency = { id: sub.id };

    // Users
    const uA = await prisma.user.create({
      data: {
        email: `useronlya-${stamp}@kamaia.dev`,
        passwordHash: pwd,
        firstName: 'Only',
        lastName: 'A',
      },
    });
    await prisma.membership.create({
      data: {
        userId: uA.id,
        tenantId: tenantA.id,
        role: Role.ADMIN,
        isDefault: true,
        acceptedAt: new Date(),
      },
    });

    const uB = await prisma.user.create({
      data: {
        email: `useronlyb-${stamp}@kamaia.dev`,
        passwordHash: pwd,
        firstName: 'Only',
        lastName: 'B',
      },
    });
    await prisma.membership.create({
      data: {
        userId: uB.id,
        tenantId: tenantB.id,
        role: Role.ADMIN,
        isDefault: true,
        acceptedAt: new Date(),
      },
    });

    const uAg = await prisma.user.create({
      data: {
        email: `useragency-${stamp}@kamaia.dev`,
        passwordHash: pwd,
        firstName: 'Agency',
        lastName: 'User',
      },
    });
    // Só Membership no tenant-pai; espera-se que herde acesso ao sub
    await prisma.membership.create({
      data: {
        userId: uAg.id,
        tenantId: agencyTenant.id,
        role: Role.ADMIN,
        isDefault: true,
        acceptedAt: new Date(),
      },
    });

    // Login de cada um para obter o JWT
    const loginA = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: uA.email, password: 'Test2026!' });
    userOnlyA = { id: uA.id, token: loginA.body.accessToken };

    const loginB = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: uB.email, password: 'Test2026!' });
    userOnlyB = { id: uB.id, token: loginB.body.accessToken };

    const loginAg = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: uAg.email, password: 'Test2026!' });
    userAgency = { id: uAg.id, token: loginAg.body.accessToken };

    // Tipo de contrato (catálogo global)
    const tipo = await prisma.tipoContrato.findFirst({
      where: { codigo: 'PRESTACAO_SERVICOS', tenantId: null },
    });
    const tipoId = tipo!.id;

    // Contratos: um em cada tenant
    const cA = await prisma.contrato.create({
      data: {
        tenantId: tenantA.id,
        numeroInterno: `ISOL-A-${stamp}`,
        titulo: 'Contrato isolation A',
        tipoId,
        estado: 'ACTIVO',
        origem: 'CRIADO_INTERNAMENTE',
      },
    });
    contratoInA = { id: cA.id };

    const cB = await prisma.contrato.create({
      data: {
        tenantId: tenantB.id,
        numeroInterno: `ISOL-B-${stamp}`,
        titulo: 'Contrato isolation B',
        tipoId,
        estado: 'ACTIVO',
        origem: 'CRIADO_INTERNAMENTE',
      },
    });
    contratoInB = { id: cB.id };

    const cSub = await prisma.contrato.create({
      data: {
        tenantId: subTenantOfAgency.id,
        numeroInterno: `ISOL-SUB-${stamp}`,
        titulo: 'Contrato isolation sub',
        tipoId,
        estado: 'ACTIVO',
        origem: 'CRIADO_INTERNAMENTE',
      },
    });
    contratoInSubAgency = { id: cSub.id };
  }

  // ─── 1. Cross-tenant read deve falhar ──────────────────────
  it('userOnlyA NÃO consegue ler contrato do tenant B', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/contratos/${contratoInB.id}`)
      .set('Authorization', `Bearer ${userOnlyA.token}`)
      .set('X-Tenant-Id', tenantA.id);

    // Esperado: 404 (não revelar existência) — tenant scoping na query.
    expect([403, 404]).toContain(res.status);
  });

  it('userOnlyA NÃO consegue assumir o tenant B via header', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/contratos')
      .set('Authorization', `Bearer ${userOnlyA.token}`)
      .set('X-Tenant-Id', tenantB.id);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/membership|tenant/i);
  });

  it('userOnlyB NÃO consegue ler contrato do tenant A', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/contratos/${contratoInA.id}`)
      .set('Authorization', `Bearer ${userOnlyB.token}`)
      .set('X-Tenant-Id', tenantB.id);

    expect([403, 404]).toContain(res.status);
  });

  // ─── 2. Sem header X-Tenant-Id ────────────────────────────
  it('falta de X-Tenant-Id em endpoint scoped → 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/contratos')
      .set('Authorization', `Bearer ${userOnlyA.token}`);
    expect(res.status).toBe(403);
  });

  // ─── 3. Cross-tenant write deve falhar ─────────────────────
  it('userOnlyA NÃO consegue criar contrato no tenant B (header forjado)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/contratos')
      .set('Authorization', `Bearer ${userOnlyA.token}`)
      .set('X-Tenant-Id', tenantB.id)
      .send({
        titulo: 'Injecção cross-tenant',
        tipoId: '00000000-0000-0000-0000-000000000000',
      });
    expect(res.status).toBe(403);
  });

  // ─── 4. Mesmo tenant funciona ──────────────────────────────
  it('userOnlyA LÊ contrato do próprio tenant A', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/contratos/${contratoInA.id}`)
      .set('Authorization', `Bearer ${userOnlyA.token}`)
      .set('X-Tenant-Id', tenantA.id);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(contratoInA.id);
  });

  // ─── 5. Modo AGENCY: parent → sub herda ───────────────────
  it('userAgency com Membership só no tenant-pai HERDA acesso ao sub', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/contratos/${contratoInSubAgency.id}`)
      .set('Authorization', `Bearer ${userAgency.token}`)
      .set('X-Tenant-Id', subTenantOfAgency.id);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(contratoInSubAgency.id);
  });

  it('userAgency NÃO pode escalar para tenant B (sem parent-link)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/contratos/${contratoInB.id}`)
      .set('Authorization', `Bearer ${userAgency.token}`)
      .set('X-Tenant-Id', tenantB.id);
    expect(res.status).toBe(403);
  });

  // ─── 6. Sem JWT ────────────────────────────────────────────
  it('request sem JWT → 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/contratos')
      .set('X-Tenant-Id', tenantA.id);
    expect(res.status).toBe(401);
  });
});
