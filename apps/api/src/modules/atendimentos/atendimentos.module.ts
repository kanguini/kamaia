import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ProcessosModule } from '../processos/processos.module';
import { ClientesModule } from '../clientes/clientes.module';
import { AtendimentosController } from './atendimentos.controller';
import { AtendimentosRepository } from './atendimentos.repository';
import { AtendimentosService } from './atendimentos.service';

@Module({
  imports: [AuditModule, ProcessosModule, ClientesModule],
  controllers: [AtendimentosController],
  providers: [AtendimentosService, AtendimentosRepository],
  exports: [AtendimentosService],
})
export class AtendimentosModule {}
