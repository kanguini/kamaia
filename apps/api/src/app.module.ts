import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { UsersModule } from './modules/users/users.module';
import { GabinetesModule } from './modules/gabinetes/gabinetes.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { ProcessosModule } from './modules/processos/processos.module';
import { PrazosModule } from './modules/prazos/prazos.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { StatsModule } from './modules/stats/stats.module';
import { IaModule } from './modules/ia/ia.module';
import { TimesheetsModule } from './modules/timesheets/timesheets.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 60000, limit: 10 },
      { name: 'long', ttl: 3600000, limit: 200 },
    ]),
    PrismaModule,
    AuthModule,
    AuditModule,
    UsersModule,
    GabinetesModule,
    ClientesModule,
    ProcessosModule,
    PrazosModule,
    CalendarModule,
    DocumentsModule,
    StatsModule,
    IaModule,
    TimesheetsModule,
    ExpensesModule,
    NotificationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
