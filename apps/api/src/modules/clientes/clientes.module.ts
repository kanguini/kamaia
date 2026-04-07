import { Module } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { ClientesRepository } from './clientes.repository';
import { ClientesController } from './clientes.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [ClientesController],
  providers: [ClientesService, ClientesRepository],
  exports: [ClientesService],
})
export class ClientesModule {}
