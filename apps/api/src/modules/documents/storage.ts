import { Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Abstracção mínima de storage transversal.
 *
 * Implementações:
 * - `LocalDiskStorage` — escreve em `./uploads/{tenantId}/{id}-{filename}`.
 *   Adequado para dev / on-prem.
 * - `R2Storage` — stub. Em produção fará PUT/GET assinados via S3 SDK
 *   apontado para o endpoint Cloudflare R2 (S3-compatible).
 *
 * Escolha por env: `STORAGE_BACKEND=local|r2` (default: `local`).
 */
export interface DocumentStorage {
  readonly kind: 'LOCAL' | 'R2';
  put(key: string, body: Buffer, mimeType: string): Promise<void>;
  signedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
}

export class LocalDiskStorage implements DocumentStorage {
  readonly kind = 'LOCAL' as const;

  private readonly logger = new Logger(LocalDiskStorage.name);

  constructor(private readonly rootDir: string) {}

  private resolve(key: string): string {
    // Defesa contra path traversal — recusar keys que escapem ao root.
    const normalized = path.normalize(key).replace(/^([./\\])+/, '');
    return path.join(this.rootDir, normalized);
  }

  async put(key: string, body: Buffer, mimeType: string): Promise<void> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
    this.logger.debug(`PUT ${key} (${body.byteLength}B, ${mimeType})`);
  }

  async signedUrl(key: string, _expiresInSeconds = 300): Promise<string> {
    // Em dev, expomos uma URL relativa que um controller `/documents/raw`
    // pode servir. Mantém-se simples; assinatura HMAC é trivial de adicionar.
    return `/documents/raw?key=${encodeURIComponent(key)}`;
  }

  async delete(key: string): Promise<void> {
    const full = this.resolve(key);
    await fs.rm(full, { force: true });
    this.logger.debug(`DEL ${key}`);
  }
}

export class R2Storage implements DocumentStorage {
  readonly kind = 'R2' as const;

  private readonly logger = new Logger(R2Storage.name);

  constructor(
    private readonly bucket: string,
    private readonly endpoint: string,
  ) {}

  async put(key: string, body: Buffer, mimeType: string): Promise<void> {
    // STUB — em produção usar @aws-sdk/client-s3 PutObjectCommand contra
    // o endpoint R2. Mantemos o stub para a wiring de dev não falhar.
    this.logger.warn(
      `R2 STUB put ${this.bucket}/${key} (${body.byteLength}B, ${mimeType}) endpoint=${this.endpoint}`,
    );
  }

  async signedUrl(key: string, expiresInSeconds = 300): Promise<string> {
    this.logger.warn(`R2 STUB signedUrl ${this.bucket}/${key} ttl=${expiresInSeconds}s`);
    return `${this.endpoint}/${this.bucket}/${key}?stub=1`;
  }

  async delete(key: string): Promise<void> {
    this.logger.warn(`R2 STUB delete ${this.bucket}/${key}`);
  }
}

export function createStorageFromEnv(): DocumentStorage {
  const backend = (process.env.STORAGE_BACKEND ?? 'local').toLowerCase();
  if (backend === 'r2') {
    return new R2Storage(
      process.env.R2_BUCKET ?? 'kamaia',
      process.env.R2_ENDPOINT ?? 'https://r2.example.com',
    );
  }
  return new LocalDiskStorage(process.env.UPLOAD_DIR ?? './uploads');
}

export const STORAGE_TOKEN = 'DOCUMENT_STORAGE';
