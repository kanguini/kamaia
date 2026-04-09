import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { StatsModule } from './modules/stats/stats.module';
import { IaModule } from './modules/ia/ia.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    StatsModule,
    IaModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
