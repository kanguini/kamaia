import { Module } from '@nestjs/common';
import { CarteirasController } from './carteiras.controller';
import { CarteirasService } from './carteiras.service';

@Module({
  controllers: [CarteirasController],
  providers: [CarteirasService],
  exports: [CarteirasService],
})
export class CarteirasModule {}
