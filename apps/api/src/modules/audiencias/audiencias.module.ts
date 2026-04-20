import { Module } from '@nestjs/common';
import { AudienciasController } from './audiencias.controller';
import { AudienciasService } from './audiencias.service';
import { AudienciasRepository } from './audiencias.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AudienciasController],
  providers: [AudienciasService, AudienciasRepository],
  exports: [AudienciasService],
})
export class AudienciasModule {}
