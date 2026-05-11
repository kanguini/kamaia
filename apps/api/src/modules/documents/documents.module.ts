import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentsRepository } from './documents.repository';
import { AuditModule } from '../audit/audit.module';
import { STORAGE_PROVIDER } from './storage/storage.provider';
import { LocalDiskStorageProvider } from './storage/local-disk.storage';
import { R2StorageProvider } from './storage/r2.storage';

// Storage driver decidido em boot tempo. Local é default — R2 é
// opt-in via env var quando as credentials forem configuradas.
const driver = (process.env.STORAGE_DRIVER || 'local').toLowerCase();

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
    }),
    AuditModule,
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    DocumentsRepository,
    LocalDiskStorageProvider,
    R2StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      useFactory: (
        local: LocalDiskStorageProvider,
        r2: R2StorageProvider,
      ) => (driver === 'r2' ? r2 : local),
      inject: [LocalDiskStorageProvider, R2StorageProvider],
    },
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
