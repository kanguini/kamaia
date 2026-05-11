import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  StorageProvider,
  UploadOptions,
  DownloadHandle,
} from './storage.provider';

/**
 * Implementação do StorageProvider que escreve no filesystem do
 * contentor. Em Railway, mount-path /app/apps/api/uploads é um volume
 * persistente (configurado via dashboard).
 *
 * Vale para dev e para o sprint inicial; em produção a recomendação é
 * mudar STORAGE_DRIVER=r2 para sair do filesystem.
 */
@Injectable()
export class LocalDiskStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalDiskStorageProvider.name);
  private readonly rootDir = path.join(process.cwd(), 'uploads');

  async upload(opts: UploadOptions): Promise<{ key: string }> {
    const dir = path.join(this.rootDir, opts.gabineteId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const ext = path.extname(opts.filename);
    const safeName = `${randomUUID()}${ext}`;
    const fullPath = path.join(dir, safeName);
    fs.writeFileSync(fullPath, opts.body);
    return { key: `uploads/${opts.gabineteId}/${safeName}` };
  }

  async resolveDownload(
    key: string,
    options: { mimeType: string; originalName: string },
  ): Promise<DownloadHandle> {
    const filePath = path.join(process.cwd(), key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }
    return {
      filePath,
      mimeType: options.mimeType,
      originalName: options.originalName,
    };
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(process.cwd(), key);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err: unknown) {
      this.logger.error(
        `Failed to delete ${key}: ${(err as Error).message}`,
      );
    }
  }
}
