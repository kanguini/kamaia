import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { createStorageFromEnv, STORAGE_TOKEN } from './storage';

@Module({
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    {
      provide: STORAGE_TOKEN,
      useFactory: () => createStorageFromEnv(),
    },
  ],
  exports: [DocumentsService, STORAGE_TOKEN],
})
export class DocumentsModule {}
