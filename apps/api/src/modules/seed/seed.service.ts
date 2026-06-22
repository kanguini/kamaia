import { Injectable, Logger } from '@nestjs/common';
import { Role, TenantPlan, TenantStatus } from '@kamaia/shared-types';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LEGISLACAO_SEED } from './data/legislacao';
import { TGIS_SEED } from './data/tgis';
import { TIPOS_CONTRATO_SEED } from './data/tipos-contrato';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Seed full demo state — para arrancar o produto num ambiente novo.
   * Idempotente: pode ser executado várias vezes sem duplicar.
   */
  async seedAll() {
    await this.seedTGIS();
    await this.seedTiposContrato();
    await this.seedLegislacao();
    await this.seedDemoTenant();
    return { ok: true };
  }

  async seedTGIS() {
    this.logger.log('Seeding TGIS verbas...');
    for (const v of TGIS_SEED) {
      await this.prisma.tGISVerba.upsert({
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
        update: {
          descricao: v.descricao,
          tipoTaxa: v.tipoTaxa,
          taxaValor: v.taxaValor,
          taxaUnidade: v.taxaUnidade,
          referenciaLegal: v.referenciaLegal,
        },
      });
    }
    this.logger.log(`Seeded ${TGIS_SEED.length} TGIS verbas`);
  }

  async seedTiposContrato() {
    this.logger.log('Seeding TipoContrato (global catalog)...');
    // findFirst+create/update em vez de upsert: o compound unique
    // (tenantId, codigo) tem tenantId nullable e Postgres trata NULL
    // como distinto, impedindo upsert idempotente.
    for (const t of TIPOS_CONTRATO_SEED) {
      const existing = await this.prisma.tipoContrato.findFirst({
        where: { tenantId: null, codigo: t.codigo },
      });
      const data = {
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
      };
      if (existing) {
        await this.prisma.tipoContrato.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await this.prisma.tipoContrato.create({
          data: { tenantId: null, ...data },
        });
      }
    }
    this.logger.log(`Seeded ${TIPOS_CONTRATO_SEED.length} TipoContrato`);
  }

  async seedLegislacao() {
    this.logger.log('Seeding LegislationDocument catalog...');
    for (const l of LEGISLACAO_SEED) {
      await this.prisma.legislationDocument.upsert({
        where: { codigo: l.codigo },
        create: {
          codigo: l.codigo,
          titulo: l.titulo,
          diploma: l.diploma,
          publicacao: l.publicacao ? new Date(l.publicacao) : undefined,
          emVigorDesde: l.emVigorDesde ? new Date(l.emVigorDesde) : undefined,
          url: l.url,
        },
        update: {
          titulo: l.titulo,
          diploma: l.diploma,
          publicacao: l.publicacao ? new Date(l.publicacao) : undefined,
          emVigorDesde: l.emVigorDesde ? new Date(l.emVigorDesde) : undefined,
        },
      });
    }
    this.logger.log(`Seeded ${LEGISLACAO_SEED.length} LegislationDocument`);
  }

  /**
   * Cria tenant demo + 3 utilizadores com Memberships.
   * Skip se já existir.
   */
  async seedDemoTenant() {
    const slug = 'kamaia-demo';
    const existing = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      this.logger.log('Demo tenant já existe — skip.');
      return existing;
    }

    this.logger.log('Creating demo tenant + users...');
    const passwordHash = await bcrypt.hash('Kamaia2026!', 12);

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug,
          nome: 'Kamaia Demo',
          nif: '5000000000',
          plan: TenantPlan.GROWTH,
          status: TenantStatus.ACTIVE,
          email: 'demo@kamaia.dev',
        },
      });

      const admin = await tx.user.create({
        data: {
          email: 'admin@kamaia.dev',
          passwordHash,
          firstName: 'Admin',
          lastName: 'Demo',
        },
      });
      await tx.membership.create({
        data: {
          userId: admin.id,
          tenantId: tenant.id,
          role: Role.ADMIN,
          isDefault: true,
          acceptedAt: new Date(),
        },
      });

      const legal = await tx.user.create({
        data: {
          email: 'legal@kamaia.dev',
          passwordHash,
          firstName: 'Legal',
          lastName: 'Lead',
        },
      });
      await tx.membership.create({
        data: {
          userId: legal.id,
          tenantId: tenant.id,
          role: Role.LEGAL_LEAD,
          isDefault: true,
          acceptedAt: new Date(),
        },
      });

      const manager = await tx.user.create({
        data: {
          email: 'manager@kamaia.dev',
          passwordHash,
          firstName: 'Contract',
          lastName: 'Manager',
        },
      });
      await tx.membership.create({
        data: {
          userId: manager.id,
          tenantId: tenant.id,
          role: Role.CONTRACT_MANAGER,
          isDefault: true,
          acceptedAt: new Date(),
        },
      });

      // Subscription + quota
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          plan: TenantPlan.GROWTH,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
      await tx.usageQuota.create({
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

      this.logger.log(`Demo tenant created: ${tenant.id}`);
      return tenant;
    });
  }
}
