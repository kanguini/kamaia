import { Module } from '@nestjs/common';
import { ComplianceModule } from '../compliance/compliance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { ContratoAdendasController } from './adendas/adendas.controller';
import { ContratoAdendasService } from './adendas/adendas.service';
import { ContratoAssinaturasController } from './assinaturas/assinaturas.controller';
import { ContratoAssinaturasService } from './assinaturas/assinaturas.service';
import { ContratoColaboradoresController } from './colaboradores/colaboradores.controller';
import { ContratoColaboradoresService } from './colaboradores/colaboradores.service';
import { ContratoPublicoController } from './colaboradores/public.controller';
import { ContratoComentariosController } from './comentarios/comentarios.controller';
import { ContratoComentariosService } from './comentarios/comentarios.service';
import { ContratosController } from './contratos.controller';
import { ContratosService } from './contratos.service';
import { ContratoDatasChaveController } from './datas-chave/datas-chave.controller';
import { ContratoDatasChaveService } from './datas-chave/datas-chave.service';
import { ContratoEventosController } from './eventos/eventos.controller';
import { ContratoEventosService } from './eventos/eventos.service';
import { ContratoNegociacaoController } from './negociacao/negociacao.controller';
import { ContratoNegociacaoService } from './negociacao/negociacao.service';
import { ContratoObrigacoesController } from './obrigacoes/obrigacoes.controller';
import { ContratoObrigacoesService } from './obrigacoes/obrigacoes.service';
import { ContratoPartesController } from './partes/partes.controller';
import { ContratoPartesService } from './partes/partes.service';
import { ContratoTerminacaoController } from './terminacao/terminacao.controller';
import { ContratoTerminacaoService } from './terminacao/terminacao.service';
import { ContratoVersoesController } from './versoes/versoes.controller';
import { ContratoVersoesService } from './versoes/versoes.service';
import {
  ContratoPdfController,
  ContratoPdfPublicController,
} from './pdf/pdf.controller';
import { ContratoPdfService } from './pdf/pdf.service';
import { RenovacaoController } from './renovacao/renovacao.controller';
import { RenovacaoEngineService } from './renovacao/renovacao.service';

@Module({
  imports: [ComplianceModule, WebhooksModule, NotificationsModule],
  controllers: [
    ContratosController,
    ContratoVersoesController,
    ContratoPartesController,
    ContratoDatasChaveController,
    ContratoEventosController,
    ContratoNegociacaoController,
    ContratoObrigacoesController,
    ContratoTerminacaoController,
    ContratoAdendasController,
    ContratoColaboradoresController,
    ContratoComentariosController,
    ContratoAssinaturasController,
    ContratoPublicoController,
    ContratoPdfController,
    ContratoPdfPublicController,
    RenovacaoController,
  ],
  providers: [
    ContratosService,
    ContratoVersoesService,
    ContratoPartesService,
    ContratoDatasChaveService,
    ContratoEventosService,
    ContratoNegociacaoService,
    ContratoObrigacoesService,
    ContratoTerminacaoService,
    ContratoAdendasService,
    ContratoColaboradoresService,
    ContratoComentariosService,
    ContratoAssinaturasService,
    ContratoPdfService,
    RenovacaoEngineService,
  ],
  exports: [ContratosService, RenovacaoEngineService],
})
export class ContratosModule {}
