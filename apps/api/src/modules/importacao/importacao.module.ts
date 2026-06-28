import { Module } from '@nestjs/common';
import { ContratosModule } from '../contratos/contratos.module';
import { ImportacaoController } from './importacao.controller';
import { ImportacaoService } from './importacao.service';

@Module({
  // Importa ContratosModule para reutilizar ContratosService.create() —
  // o contrato importado recebe a MESMA génese (evento, audit, webhook,
  // quota, compliance) que um criado: paridade por construção.
  imports: [ContratosModule],
  controllers: [ImportacaoController],
  providers: [ImportacaoService],
  exports: [ImportacaoService],
})
export class ImportacaoModule {}
