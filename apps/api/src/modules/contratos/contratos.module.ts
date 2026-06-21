import { Module } from '@nestjs/common';
import { ComplianceModule } from '../compliance/compliance.module';
import { ContratosController } from './contratos.controller';
import { ContratosService } from './contratos.service';
import { ContratoVersoesController } from './versoes/versoes.controller';
import { ContratoVersoesService } from './versoes/versoes.service';
import { ContratoPartesController } from './partes/partes.controller';
import { ContratoPartesService } from './partes/partes.service';
import { ContratoDatasChaveController } from './datas-chave/datas-chave.controller';
import { ContratoDatasChaveService } from './datas-chave/datas-chave.service';
import { ContratoEventosController } from './eventos/eventos.controller';
import { ContratoEventosService } from './eventos/eventos.service';
import { ContratoNegociacaoController } from './negociacao/negociacao.controller';
import { ContratoNegociacaoService } from './negociacao/negociacao.service';
import { ContratoTerminacaoService } from './terminacao/terminacao.service';
import { ContratoTerminacaoController } from './terminacao/terminacao.controller';

@Module({
  imports: [ComplianceModule],
  controllers: [
    ContratosController,
    ContratoVersoesController,
    ContratoPartesController,
    ContratoDatasChaveController,
    ContratoEventosController,
    ContratoNegociacaoController,
    ContratoTerminacaoController,
  ],
  providers: [
    ContratosService,
    ContratoVersoesService,
    ContratoPartesService,
    ContratoDatasChaveService,
    ContratoEventosService,
    ContratoNegociacaoService,
    ContratoTerminacaoService,
  ],
  exports: [ContratosService],
})
export class ContratosModule {}
