/**
 * Documents module — E2E.
 *
 * Cobre o stub actual (base64 upload + local disk). Quando o Multer
 * + R2 estiverem wired, este teste continua válido para a parte de
 * metadata e download URL.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Role, TenantPlan, TenantStatus } from '@kamaia/shared-types';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Documents (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let tenantId: string;
  let token: string;
  let docId: string;

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
        slug: `doc-${stamp}`,
        nome: 'Documents Test',
        plan: TenantPlan.GROWTH,
        status: TenantStatus.ACTIVE,
      },
    });
    tenantId = tenant.id;

    const pwd = await bcrypt.hash('Test2026!', 10);
    const user = await prisma.user.create({
      data: {
        email: `doc-${stamp}@kamaia.dev`,
        passwordHash: pwd,
        firstName: 'Doc',
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

  it('1. Upload documento (base64) → 201 + metadata', async () => {
    const conteudoTexto = 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS\n\nEntre as partes...';
    const base64 = Buffer.from(conteudoTexto, 'utf-8').toString('base64');

    const res = await request(app.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({
        nome: 'contrato-teste.txt',
        mimeType: 'text/plain',
        tamanhoBytes: Buffer.byteLength(conteudoTexto, 'utf-8'),
        contentBase64: base64,
        metadata: { source: 'e2e-test' },
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.nome).toBe('contrato-teste.txt');
    expect(res.body.mimeType).toBe('text/plain');
    expect(res.body.storageType).toBeDefined();
    expect(res.body.storageKey).toBeDefined();
    docId = res.body.id;
  });

  it('2. List documentos do tenant', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/documents')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].id).toBe(docId);
  });

  it('3. GET /documents/:id retorna url + mimeType + nome', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(res.status).toBe(200);
    expect(res.body.url).toBeDefined();
    expect(res.body.mimeType).toBe('text/plain');
    expect(res.body.nome).toBe('contrato-teste.txt');
  });

  it('4. DELETE soft (deletedAt definido)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(res.status).toBe(200);

    const inDb = await prisma.document.findUnique({ where: { id: docId } });
    expect(inDb!.deletedAt).not.toBeNull();
  });

  it('5. Documento soft-deleted desaparece do list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/documents')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(res.body.data.find((d: { id: string }) => d.id === docId)).toBeUndefined();
  });
});
