/**
 * Prisma seed standalone — usado por `npx ts-node prisma/seed.ts` e `npm run seed`.
 * Espelha o SeedService mas sem subir o NestJS app.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ComplianceEngine } from '../src/modules/compliance/engine/compliance.engine';
import { DEMO_CONTRATOS, DEMO_ENTIDADES } from '../src/modules/seed/data/demo-contratos';
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

  // ─── Carteira demo ───────────────────────────────────────
  const demoTenant = await prisma.tenant.findUnique({ where: { slug } });
  if (demoTenant) {
    const existingContratos = await prisma.contrato.count({
      where: { tenantId: demoTenant.id },
    });
    if (existingContratos === 0) {
      console.log('▶ Seeding demo carteira (10 contratos)...');
      await seedDemoCarteira(demoTenant.id);
    } else {
      console.log(`  ✓ Carteira demo já existe (${existingContratos} contratos)`);
    }
  }

  console.log('\n✓ Seed completo.');
}

async function seedDemoCarteira(tenantId: string): Promise<void> {
  // SELF — entidade que representa a Kamaia Demo
  const self = await prisma.entidade.create({
    data: {
      tenantId,
      tipo: 'PESSOA_COLECTIVA',
      nome: 'Kamaia Demo Lda',
      nif: '5000000000',
      nacionalidadeCambial: 'RESIDENTE',
      sectorActividade: 'TECNOLOGIA',
    },
  });

  // Entidades-contraparte demo
  const entidades = await Promise.all(
    DEMO_ENTIDADES.map((e) =>
      prisma.entidade.create({
        data: {
          tenantId,
          tipo: e.tipo,
          nome: e.nome,
          nif: e.nif,
          nacionalidadeCambial: e.nacionalidadeCambial,
          paisResidencia: e.paisResidencia ?? 'AO',
          sectorActividade: e.sectorActividade,
        },
      }),
    ),
  );

  // Mapa código → tipoContratoId
  const tiposCatalog = await prisma.tipoContrato.findMany({
    where: { tenantId: null },
  });
  const tipoMap = new Map(tiposCatalog.map((t) => [t.codigo, t.id]));

  const engine = new ComplianceEngine();
  let criados = 0;
  let actosTotal = 0;

  for (const demo of DEMO_CONTRATOS) {
    const tipoId = tipoMap.get(demo.tipoCodigo);
    if (!tipoId) {
      console.warn(`  ⚠ TipoContrato '${demo.tipoCodigo}' não encontrado — skip ${demo.numeroInterno}`);
      continue;
    }

    const contrato = await prisma.contrato.create({
      data: {
        tenantId,
        numeroInterno: demo.numeroInterno,
        titulo: demo.titulo,
        descricao: demo.descricao,
        tipoId,
        estado: demo.estado,
        origem: 'CRIADO_INTERNAMENTE',
        valor: demo.valor,
        moeda: demo.moeda,
        valorEmAKZ: demo.valorEmAKZ,
        leiAplicavel: demo.leiAplicavel,
        foro: demo.foro,
        dataAssinatura: demo.dataAssinatura ? new Date(demo.dataAssinatura) : undefined,
        dataInicioVigencia: demo.dataInicioVigencia
          ? new Date(demo.dataInicioVigencia)
          : undefined,
        dataTermo: demo.dataTermo ? new Date(demo.dataTermo) : undefined,
        renovacaoAutomatica: demo.renovacaoAutomatica ?? false,
        janelaDenunciaDias: demo.janelaDenunciaDias,
      },
    });

    // Partes
    for (const [ordem, p] of demo.partes.entries()) {
      const entidadeId = p.entidadeIndex === 'SELF'
        ? self.id
        : entidades[p.entidadeIndex]?.id;
      if (!entidadeId) continue;
      await prisma.contratoParte.create({
        data: {
          contratoId: contrato.id,
          entidadeId,
          papel: p.papel,
          representanteNome: p.representanteNome,
          ordem,
        },
      });
    }

    // Datas-chave
    for (const d of demo.datasChave ?? []) {
      await prisma.contratoDataChave.create({
        data: {
          contratoId: contrato.id,
          tipo: d.tipo,
          data: new Date(d.data),
          descricao: d.descricao,
        },
      });
    }

    // Evento CRIADO na timeline
    await prisma.contratoEvento.create({
      data: {
        contratoId: contrato.id,
        tipo: 'CRIADO',
        resumo: `Contrato ${demo.numeroInterno} criado (seed demo)`,
        actorTipo: 'SYSTEM',
      },
    });

    // Compliance evaluation se pedido
    if (demo.avaliarCompliance) {
      const partes = await prisma.contratoParte.findMany({
        where: { contratoId: contrato.id },
        include: { entidade: true },
      });
      const tipo = tiposCatalog.find((t) => t.id === tipoId)!;
      const codigoUpper = tipo.codigo.toUpperCase();
      const tituloLower = contrato.titulo.toLowerCase();
      const actos = engine.evaluate(
        {
          contratoId: contrato.id,
          tenantId,
          tipoCodigo: tipo.codigo,
          categoria: tipo.categoria as never,
          valor: contrato.valor,
          moeda: contrato.moeda,
          valorEmAKZ: contrato.valorEmAKZ,
          partesResidentes: partes.map((p) => p.entidade.nacionalidadeCambial === 'RESIDENTE'),
          paisesResidencia: partes.map((p) => p.entidade.paisResidencia),
          leiAplicavel: contrato.leiAplicavel,
          hasObjectoImovel:
            tipo.categoria === 'IMOBILIARIO' ||
            codigoUpper.includes('IMOVEL') ||
            codigoUpper.includes('ARRENDAMENTO') ||
            tituloLower.includes('imóvel') ||
            tituloLower.includes('arrendamento'),
          hasObjectoAutomovel: codigoUpper.includes('AUTOMOVEL') || codigoUpper.includes('VEICULO'),
          hasObjectoIP: codigoUpper.includes('IP') || codigoUpper.includes('LICENCA'),
          hasObjectoSocietario:
            codigoUpper.includes('PACTO_SOCIAL') ||
            codigoUpper.includes('FUSAO') ||
            codigoUpper.includes('CISAO'),
        },
        contrato.dataAssinatura ?? new Date(),
      );

      for (const a of actos) {
        await prisma.contratoActoRegulatorio.create({
          data: {
            contratoId: contrato.id,
            tipo: a.tipo,
            tgisVerbaNumero: a.tgisVerbaNumero,
            baseTributavel: a.baseTributavel,
            valorLiquidar: a.valorLiquidar,
            prazoLimite: a.prazoLimite,
            observacoes: a.observacoes,
            detectadoAutomaticamente: true,
            regraId: a.regraId,
            regraVersao: a.regraVersao,
            referenciaLegal: a.referenciaLegal,
            disclaimer: a.disclaimer,
          },
        });
        actosTotal += 1;
      }
    }
    criados += 1;
  }

  console.log(`  ✓ ${criados} contratos demo + ${actosTotal} actos regulatórios sugeridos`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    void prisma.$disconnect();
  });
