import { Injectable, Logger } from '@nestjs/common';
import {
  StorageProvider,
  UploadOptions,
  DownloadHandle,
} from './storage.provider';

/**
 * Cloudflare R2 storage provider — STUB.
 *
 * Para activar:
 *   1) Criar bucket em https://dash.cloudflare.com/?to=/:account/r2 (free tier
 *      até 10GB + 1M Class A ops/mês, suficiente para early access).
 *   2) Gerar API token com permissões "Object Read & Write" no bucket.
 *   3) `npm install --workspace=@kamaia/api @aws-sdk/client-s3
 *      @aws-sdk/s3-request-presigner` (R2 é S3-compatible).
 *   4) Setar env:
 *        STORAGE_DRIVER=r2
 *        R2_ACCOUNT_ID=...
 *        R2_ACCESS_KEY_ID=...
 *        R2_SECRET_ACCESS_KEY=...
 *        R2_BUCKET=kamaia-documents
 *   5) Substituir os `throw new Error(...)` abaixo pela implementação real.
 *
 * Até lá, qualquer pedido com STORAGE_DRIVER=r2 falha rapidamente — é
 * deliberado, evita-se assumir silenciosamente que o ficheiro foi guardado.
 */
@Injectable()
export class R2StorageProvider implements StorageProvider {
  private readonly logger = new Logger(R2StorageProvider.name);

  constructor() {
    this.logger.warn(
      'R2StorageProvider stub — set STORAGE_DRIVER=local or implement R2 client.',
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async upload(_opts: UploadOptions): Promise<{ key: string }> {
    throw new Error(
      'R2 storage not implemented. Set STORAGE_DRIVER=local or wire R2 client.',
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async resolveDownload(
    _key: string,
    _options: { mimeType: string; originalName: string },
  ): Promise<DownloadHandle> {
    throw new Error('R2 storage not implemented.');
  }

  async delete(_key: string): Promise<void> {
    // Best-effort silent — soft-delete em DB resolve mesmo se objecto persiste.
    this.logger.warn('R2 delete stub — no-op.');
  }
}
