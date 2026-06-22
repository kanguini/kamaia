/**
 * IA module — E2E.
 *
 * Testes correm em **modo stub** (sem ANTHROPIC_API_KEY), validando:
 *   - Criar conversa
 *   - Listar conversas
 *   - Enviar mensagem → resposta stub com disclaimer
 *   - Mensagens persistem no histórico
 *   - Conversa do user A não é visível ao user B
 *   - updatedAt da conversa avança quando há nova mensagem
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Role, TenantPlan, TenantStatus } from '@kamaia/shared-types';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('IA (E2E, modo stub)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let tenantId: string;
  let token: string;
  let tokenB: string;

  beforeAll(async () => {
    // Garante modo stub (sem chave). Caso CI defina por engano, removemos.
    delete process.env.ANTHROPIC_API_KEY;

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
        slug: `ia-${stamp}`,
        nome: 'IA Test',
        plan: TenantPlan.GROWTH,
        status: TenantStatus.ACTIVE,
      },
    });
    tenantId = tenant.id;

    const pwd = await bcrypt.hash('Test2026!', 10);

    const userA = await prisma.user.create({
      data: {
        email: `ia-a-${stamp}@kamaia.dev`,
        passwordHash: pwd,
        firstName: 'IA',
        lastName: 'UserA',
      },
    });
    await prisma.membership.create({
      data: {
        userId: userA.id,
        tenantId,
        role: Role.ADMIN,
        isDefault: true,
        acceptedAt: new Date(),
      },
    });
    token = (
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: userA.email, password: 'Test2026!' })
    ).body.accessToken;

    const userB = await prisma.user.create({
      data: {
        email: `ia-b-${stamp}@kamaia.dev`,
        passwordHash: pwd,
        firstName: 'IA',
        lastName: 'UserB',
      },
    });
    await prisma.membership.create({
      data: {
        userId: userB.id,
        tenantId,
        role: Role.LEGAL_LEAD,
        isDefault: true,
        acceptedAt: new Date(),
      },
    });
    tokenB = (
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: userB.email, password: 'Test2026!' })
    ).body.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  let conversationId: string;

  it('1. Criar conversa', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ia/conversations')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({ titulo: 'IS sobre arrendamento comercial' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.titulo).toBe('IS sobre arrendamento comercial');
    conversationId = res.body.id;
  });

  it('2. Listar conversas do user A', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/ia/conversations')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].id).toBe(conversationId);
  });

  it('3. Enviar mensagem → resposta stub com disclaimer + aviso da chave', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/ia/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({
        conteudo:
          'Qual a taxa de IS aplicável ao arrendamento comercial em Angola?',
      });

    expect(res.status).toBe(201);
    expect(res.body.user.conteudo).toMatch(/arrendamento comercial/);
    expect(res.body.user.role).toBe('USER');
    expect(res.body.assistant.role).toBe('ASSISTANT');
    expect(res.body.assistant.conteudo).toMatch(/ANTHROPIC_API_KEY/);
    expect(res.body.assistant.conteudo).toMatch(/aconselhamento jurídico profissional/);
    expect(res.body.assistant.modelo).toBe('stub-no-api-key');
  });

  it('4. GET conversation devolve histórico com 2 mensagens', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/ia/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(res.status).toBe(200);
    expect(res.body.messages.length).toBe(2);
    expect(res.body.messages[0].role).toBe('USER');
    expect(res.body.messages[1].role).toBe('ASSISTANT');
  });

  it('5. UserB NÃO vê conversa do UserA (mesmo tenant, isolamento por user)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/ia/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .set('X-Tenant-Id', tenantId);
    expect(res.status).toBe(404);
  });

  it('6. UserB list ainda mostra 0 conversas próprias', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/ia/conversations')
      .set('Authorization', `Bearer ${tokenB}`)
      .set('X-Tenant-Id', tenantId);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
  });

  it('7. Enviar 2ª mensagem — updatedAt da conversa avança', async () => {
    const conv1 = await request(app.getHttpServer())
      .get(`/api/ia/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    const updatedAt1 = new Date(conv1.body.updatedAt).getTime();

    await new Promise((r) => setTimeout(r, 50));  // delta minimal

    await request(app.getHttpServer())
      .post(`/api/ia/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({ conteudo: 'Segunda mensagem' });

    const conv2 = await request(app.getHttpServer())
      .get(`/api/ia/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    const updatedAt2 = new Date(conv2.body.updatedAt).getTime();
    expect(updatedAt2).toBeGreaterThan(updatedAt1);
    expect(conv2.body.messages.length).toBe(4);  // 2 trocas × (USER+ASSISTANT)
  });

  it('8. Pesquisa por título funciona', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/ia/conversations?q=arrendamento')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});
