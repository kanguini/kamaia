import { Module } from '@nestjs/common';
import { ClausulasController } from './clausulas.controller';
import { ClausulasService } from './clausulas.service';

@Module({
  controllers: [ClausulasController],
  providers: [ClausulasService],
  exports: [ClausulasService],
})
export class ClausulasModule {}
