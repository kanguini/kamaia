// ─────────────────────────────────────────────────────────
// Storage abstraction — Local disk vs Cloudflare R2.
//
// O documents.service consome esta interface e ignora o backend.
// Para activar R2 em produção, basta setar STORAGE_DRIVER=r2 + as
// credentials no env — a injecção no module resolve a implementação
// certa, sem refactor de callers.
//
// Porquê R2 e não disco local em produção:
//   - Documentos sobrevivem a redeploy do contentor (Railway recria
//     o filesystem; volumes mitigam parcialmente, R2 elimina).
//   - Backup automático na infra do CF.
//   - Acesso via URL pré-assinada — não precisamos de fazer stream
//     pelo nosso processo Node, libertando CPU/RAM.
// ─────────────────────────────────────────────────────────

export interface UploadOptions {
  gabineteId: string;
  filename: string; // já com extensão
  contentType: string;
  body: Buffer;
}

export interface DownloadHandle {
  // Para retro-compat com o Express streaming actual (sendFile / Stream).
  // Em local disk → caminho absoluto.
  // Em R2 → URL pré-assinada GET (~15 min validade).
  filePath?: string;
  signedUrl?: string;
  mimeType: string;
  originalName: string;
}

export interface StorageProvider {
  /** Upload do ficheiro. Retorna a chave canónica para guardar em DB. */
  upload(opts: UploadOptions): Promise<{ key: string }>;

  /** Resolve uma chave (column `fileUrl` no DB) num handle de download. */
  resolveDownload(
    key: string,
    options: { mimeType: string; originalName: string },
  ): Promise<DownloadHandle>;

  /** Apaga ficheiro permanentemente. Best-effort — não throws. */
  delete(key: string): Promise<void>;
}

/** Token de DI usado no Nest module. */
export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
