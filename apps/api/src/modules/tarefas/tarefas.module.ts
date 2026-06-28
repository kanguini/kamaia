import { Module } from '@nestjs/common';
import { TarefasController } from './tarefas.controller';
import { TarefasService } from './tarefas.service';

@Module({
  controllers: [TarefasController],
  providers: [TarefasService],
  // Exportado para a Agenda e o agregador "O meu trabalho" reutilizarem
  // `listAbertasComPrazo`.
  exports: [TarefasService],
})
export class TarefasModule {}
