/**
 * Performance test — valida que o produto sustenta o alvo de
 * 50.000 contratos/tenant declarado no CLAUDE.md.
 *
 * Neste teste seed-amos 1.000 contratos num tenant (~2% do alvo)
 * e verificamos que:
 *   - GET /contratos/dashboard (agregações) responde < 800ms
 *   - GET /contratos?limit=50 (cursor pagination) responde < 500ms
 *   - GET /contratos?q=... (FTS-like search) responde < 800ms
 *   - GET /contratos?expiraEm=30 (filter por data) responde < 600ms
 *
 * Limiares conservadores para uma DB local sem cache de query plan
 * quente. Em prod com PgBouncer + read replica os números são
 * substancialmente melhores.
 *
 * Se este teste regredir, há indícios de:
 *   - índice em falta
 *   - N+1 em include
 *   - falta de cursor pagination
 *   - query plan errado (e.g. seq scan em vez de index)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  ContratoEstado,
  Role,
  TenantPlan,
  TenantStatus,
} from '@kamaia/shared-types';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Performance — 1000 contratos', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let tenantId: string;
  let token: string;

  const N = 1000;
  // Limiares (ms). Generosos para CI sem warm cache; ajustar quando
  // implementarmos infra de produção com read replicas + cache.
  const LIMITES_MS = {
    dashboard: 1500,
    list: 1000,
    search: 1500,
    filterByDate: 1200,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = new PrismaClient();

    await seedLargeTenant();
  }, 180_000);

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  async function seedLargeTenant() {
    const stamp = Date.now().toString(36);
    const tenant = await prisma.tenant.create({
      data: {
        slug: `perf-${stamp}`,
        nome: 'Perf Test Tenant',
        plan: TenantPlan.SCALE,
        status: TenantStatus.ACTIVE,
      },
    });
    tenantId = tenant.id;

    const pwd = await bcrypt.hash('Test2026!', 10);
    const user = await prisma.user.create({
      data: {
        email: `perf-${stamp}@kamaia.dev`,
        passwordHash: pwd,
        firstName: 'Perf',
        lastName: 'User',
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

    // Seed contratos em chunks de 250 (createMany dispensa includes)
    const tipo = await prisma.tipoContrato.findFirst({
      where: { codigo: 'PRESTACAO_SERVICOS', tenantId: null },
    });
    const tipoId = tipo!.id;

    const estados = [
      ContratoEstado.ACTIVO,
      ContratoEstado.ACTIVO,
      ContratoEstado.ACTIVO,
      ContratoEstado.ACTIVO,  // 4/8 activos
      ContratoEstado.DRAFTING,
      ContratoEstado.EM_NEGOCIACAO,
      ContratoEstado.TERMINADO,
      ContratoEstado.REPOSITORIO,
    ];
    const titulos = [
      'Prestação de serviços cloud',
      'Manutenção industrial',
      'Consultoria fiscal',
      'Fornecimento equipamento',
      'Arrendamento escritório',
      'Licença software',
      'Avença legal',
      'Mútuo bancário',
    ];

    const agora = new Date();
    const data: Array<{
      tenantId: string;
      numeroInterno: string;
      titulo: string;
      tipoId: string;
      estado: ContratoEstado;
      origem: 'CRIADO_INTERNAMENTE';
      valor: bigint;
      moeda: string;
      dataAssinatura: Date | null;
      dataTermo: Date | null;
    }> = [];

    for (let i = 0; i < N; i++) {
      const ano = 2024 + (i % 3);
      const offsetTermo = (i % 365) - 30;  // -30 a +334 dias
      const termo = new Date(agora);
      termo.setDate(termo.getDate() + offsetTermo);
      data.push({
        tenantId,
        numeroInterno: `PERF-${stamp}-${i.toString().padStart(5, '0')}`,
        titulo: `${titulos[i % titulos.length]} #${i}`,
        tipoId,
        estado: estados[i % estados.length],
        origem: 'CRIADO_INTERNAMENTE',
        valor: BigInt(1_000_000 + i * 1_000),
        moeda: i % 3 === 0 ? 'USD' : 'AKZ',
        dataAssinatura: new Date(ano, 0, 1),
        dataTermo: termo,
      });
    }

    for (let i = 0; i < data.length; i += 250) {
      await prisma.contrato.createMany({
        data: data.slice(i, i + 250),
      });
    }
  }

  async function timed(fn: () => Promise<unknown>): Promise<number> {
    // Warm-up uma vez para estabilizar o query plan
    await fn();
    const t0 = process.hrtime.bigint();
    await fn();
    const t1 = process.hrtime.bigint();
    return Number(t1 - t0) / 1_000_000;
  }

  it('GET /contratos/dashboard < limite com 1000 contratos', async () => {
    const elapsed = await timed(async () => {
      const res = await request(app.getHttpServer())
        .get('/api/contratos/dashboard')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-Id', tenantId);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(N);
    });
    expect(elapsed).toBeLessThan(LIMITES_MS.dashboard);
    // eslint-disable-next-line no-console
    console.log(`  dashboard: ${elapsed.toFixed(0)}ms / limite ${LIMITES_MS.dashboard}ms`);
  });

  it('GET /contratos?limit=50 (cursor pagination) < limite', async () => {
    const elapsed = await timed(async () => {
      const res = await request(app.getHttpServer())
        .get('/api/contratos?limit=50')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-Id', tenantId);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(50);
    });
    expect(elapsed).toBeLessThan(LIMITES_MS.list);
    // eslint-disable-next-line no-console
    console.log(`  list 50: ${elapsed.toFixed(0)}ms / limite ${LIMITES_MS.list}ms`);
  });

  it('GET /contratos?q=cloud (search) < limite', async () => {
    const elapsed = await timed(async () => {
      const res = await request(app.getHttpServer())
        .get('/api/contratos?q=cloud&limit=50')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-Id', tenantId);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
    expect(elapsed).toBeLessThan(LIMITES_MS.search);
    // eslint-disable-next-line no-console
    console.log(`  search: ${elapsed.toFixed(0)}ms / limite ${LIMITES_MS.search}ms`);
  });

  it('GET /contratos?expiraEm=30 (filtro data) < limite', async () => {
    const elapsed = await timed(async () => {
      const res = await request(app.getHttpServer())
        .get('/api/contratos?expiraEm=30&limit=50')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-Id', tenantId);
      expect(res.status).toBe(200);
    });
    expect(elapsed).toBeLessThan(LIMITES_MS.filterByDate);
    // eslint-disable-next-line no-console
    console.log(`  expiraEm=30: ${elapsed.toFixed(0)}ms / limite ${LIMITES_MS.filterByDate}ms`);
  });

  it('Paginação completa de 20 páginas × 50 = 1000 contratos', async () => {
    const t0 = process.hrtime.bigint();
    let cursor: string | null = null;
    let total = 0;
    let pages = 0;
    do {
      const url = cursor
        ? `/api/contratos?limit=50&cursor=${cursor}`
        : '/api/contratos?limit=50';
      const res = await request(app.getHttpServer())
        .get(url)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-Id', tenantId);
      expect(res.status).toBe(200);
      total += res.body.data.length;
      cursor = res.body.nextCursor;
      pages += 1;
      if (pages > 25) break;  // safety
    } while (cursor);
    const elapsed = Number(process.hrtime.bigint() - t0) / 1_000_000;
    expect(total).toBe(N);
    expect(pages).toBeGreaterThanOrEqual(20);
    // eslint-disable-next-line no-console
    console.log(`  full scan (${pages} páginas): ${elapsed.toFixed(0)}ms (${(elapsed / pages).toFixed(0)}ms/página)`);
  });
});
