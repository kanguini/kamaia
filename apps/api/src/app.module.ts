import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SentryModule, SentryGlobalFilter } from '@sentry/nestjs/setup';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { EntidadesModule } from './modules/entidades/entidades.module';
import { CarteirasModule } from './modules/carteiras/carteiras.module';
import { TiposContratoModule } from './modules/tipos-contrato/tipos-contrato.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { ClausulasModule } from './modules/clausulas/clausulas.module';
import { ContratosModule } from './modules/contratos/contratos.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { ImportacaoModule } from './modules/importacao/importacao.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { IaModule } from './modules/ia/ia.module';
import { RagModule } from './modules/rag/rag.module';
import { LegislacaoModule } from './modules/legislacao/legislacao.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AgendaModule } from './modules/agenda/agenda.module';
import { TarefasModule } from './modules/tarefas/tarefas.module';
import { HealthModule } from './modules/health/health.module';
import { HolidaysModule } from './modules/holidays/holidays.module';
import { BackupModule } from './modules/backup/backup.module';
import { SeedModule } from './modules/seed/seed.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { MailModule } from './modules/mail/mail.module';
import { CustomFieldsModule } from './modules/custom-fields/custom-fields.module';
import { BillingModule } from './modules/billing/billing.module';

@Module({
  imports: [
    // Sentry SDK — noop quando SENTRY_DSN não está definido.
    SentryModule.forRoot(),
    // validateEnv: hard-fail no arranque em produção se faltarem
    // DATABASE_URL/JWT_SECRET/FRONTEND_URL (ver env.validation.ts).
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot(
      process.env.NODE_ENV === 'test'
        ? [
            { name: 'short', ttl: 60000, limit: 10_000 },
            { name: 'long', ttl: 3600000, limit: 100_000 },
          ]
        : [
            // Backstop global anti-abuso POR IP (com trust proxy no
            // main.ts). Um dashboard data-heavy dispara 4-6 requests em
            // paralelo por página — 10/min real causava 429 em uso normal.
            // Os endpoints sensíveis (login, register, forgot) têm
            // throttles dedicados mais apertados no AuthController.
            { name: 'short', ttl: 60000, limit: 120 },
            { name: 'long', ttl: 3600000, limit: 3000 },
          ],
    ),
    // Infra
    PrismaModule,
    HealthModule,
    AuditModule,
    HolidaysModule,
    BackupModule,
    // Auth + tenancy
    AuthModule,
    UsersModule,
    TenantsModule,
    MembershipsModule,
    // Domínio CLM
    EntidadesModule,
    CarteirasModule,
    TiposContratoModule,
    TemplatesModule,
    ClausulasModule,
    ContratosModule,
    ComplianceModule,
    CustomFieldsModule,
    BillingModule,
    ImportacaoModule,
    DocumentsModule,
    // IA
    IaModule,
    RagModule,
    LegislacaoModule,
    // Cross-cutting
    NotificationsModule,
    AgendaModule,
    TarefasModule,
    WebhooksModule,
    MailModule,
    SeedModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
