import { Module } from '@nestjs/common';
import { TarefasModule } from '../tarefas/tarefas.module';
import { AgendaController } from './agenda.controller';
import { AgendaService } from './agenda.service';

@Module({
  imports: [TarefasModule],
  controllers: [AgendaController],
  providers: [AgendaService],
  exports: [AgendaService],
})
export class AgendaModule {}
