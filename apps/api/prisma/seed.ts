/**
 * Prisma seed standalone — usado por `npx ts-node prisma/seed.ts` e `npm run seed`.
 * Espelha o SeedService mas sem subir o NestJS app.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { LEGISLACAO_SEED } from '../src/modules/seed/data/legislacao';
import { TGIS_SEED } from '../src/modules/seed/data/tgis';
import { TIPOS_CONTRATO_SEED } from '../src/modules/seed/data/tipos-contrato';

const prisma = new PrismaClient();

async function main() {
  console.log('▶ Seeding TGIS verbas...');
  for (const v of TGIS_SEED) {
    await prisma.tGISVerba.upsert({
      where: { numero: v.numero },
      create: {
        numero: v.numero,
        descricao: v.descricao,
        tipoTaxa: v.tipoTaxa,
        taxaValor: v.taxaValor,
        taxaUnidade: v.taxaUnidade,
        baseRegra: v.baseRegra as object | undefined,
        responsavelLiquidacao: v.responsavelLiquidacao,
        referenciaLegal: v.referenciaLegal,
        vigenteDesde: new Date(v.vigenteDesde),
        vigenteAte: v.vigenteAte ? new Date(v.vigenteAte) : undefined,
      },
      update: {},
    });
  }
  console.log(`  ✓ ${TGIS_SEED.length} verbas`);

  console.log('▶ Seeding TipoContrato (catálogo global)...');
  // findFirst+create em vez de upsert porque o compound unique
  // (tenantId, codigo) tem tenantId nullable e Postgres trata NULL como
  // distinto em índices únicos — upsert dispara constraint violation.
  for (const t of TIPOS_CONTRATO_SEED) {
    const existing = await prisma.tipoContrato.findFirst({
      where: { tenantId: null, codigo: t.codigo },
    });
    if (!existing) {
      await prisma.tipoContrato.create({
        data: {
          tenantId: null,
          codigo: t.codigo,
          nome: t.nome,
          categoria: t.categoria,
          descricao: t.descricao,
          tgisVerbaNumero: t.tgisVerbaNumero,
          requerNotario: t.requerNotario ?? false,
          registosRequeridos: t.registosRequeridos ?? [],
          gatilhoBNA: t.gatilhoBNA as object | undefined,
          retencaoIRTpadrao: t.retencaoIRTpadrao ?? false,
          clausulasObrigatorias: t.clausulasObrigatorias ?? [],
        },
      });
    }
  }
  console.log(`  ✓ ${TIPOS_CONTRATO_SEED.length} tipos`);

  console.log('▶ Seeding LegislationDocument catalog...');
  for (const l of LEGISLACAO_SEED) {
    await prisma.legislationDocument.upsert({
      where: { codigo: l.codigo },
      create: {
        codigo: l.codigo,
        titulo: l.titulo,
        diploma: l.diploma,
        publicacao: l.publicacao ? new Date(l.publicacao) : undefined,
        emVigorDesde: l.emVigorDesde ? new Date(l.emVigorDesde) : undefined,
        url: l.url,
      },
      update: {},
    });
  }
  console.log(`  ✓ ${LEGISLACAO_SEED.length} diplomas`);

  console.log('▶ Seeding demo tenant...');
  const slug = 'kamaia-demo';
  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) {
    console.log('  ✓ Demo tenant já existe — skip.');
  } else {
    const passwordHash = await bcrypt.hash('Kamaia2026!', 12);
    const tenant = await prisma.tenant.create({
      data: {
        slug,
        nome: 'Kamaia Demo',
        nif: '5000000000',
        plan: 'GROWTH',
        status: 'ACTIVE',
        email: 'demo@kamaia.dev',
      },
    });
    for (const [email, firstName, lastName, role] of [
      ['admin@kamaia.dev', 'Admin', 'Demo', 'ADMIN'],
      ['legal@kamaia.dev', 'Legal', 'Lead', 'LEGAL_LEAD'],
      ['manager@kamaia.dev', 'Contract', 'Manager', 'CONTRACT_MANAGER'],
    ] as const) {
      const user = await prisma.user.create({
        data: { email, passwordHash, firstName, lastName },
      });
      await prisma.membership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          role,
          isDefault: true,
          acceptedAt: new Date(),
        },
      });
    }
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        plan: 'GROWTH',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });
    await prisma.usageQuota.create({
      data: {
        tenantId: tenant.id,
        contratosLimit: 2000,
        utilizadoresLimit: 10,
        storageGBLimit: 50,
        iaMessagesLimit: 1000,
        periodoInicio: now,
        periodoFim: periodEnd,
      },
    });
    console.log(`  ✓ Tenant ${tenant.id} + 3 users criados`);
  }

  console.log('\n✓ Seed completo.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    void prisma.$disconnect();
  });
