# Document storage abstraction

O `documents.service.ts` consome o token `STORAGE_PROVIDER` injectado
pelo `DocumentsModule`. A escolha do driver é feita em boot via env
`STORAGE_DRIVER`:

- `local` (default) — `LocalDiskStorageProvider`. Escreve em
  `${process.cwd()}/uploads/${gabineteId}/${uuid}.ext`. Em produção
  Railway o caminho `/app/apps/api/uploads` é um volume persistente.
- `r2` — `R2StorageProvider`. **Stub.** Faz throw em todas as
  operações até ser implementado.

## Migrar para R2

1. Bucket Cloudflare R2:
   - https://dash.cloudflare.com/?to=/:account/r2
   - "Create bucket" → nome `kamaia-documents` (ou outro), região "Auto"
     (R2 não tem regiões públicas como S3)

2. API token com permissões "Object Read & Write" no bucket:
   - "Manage R2 API Tokens" → "Create API Token"
   - Permission: Object Read & Write
   - Specify bucket: `kamaia-documents`
   - Copiar Account ID, Access Key ID, Secret Access Key.

3. Instalar SDK no monorepo:
   ```
   npm install --workspace=@kamaia/api \
     @aws-sdk/client-s3 \
     @aws-sdk/s3-request-presigner
   ```

4. Substituir o stub `r2.storage.ts`:
   - Construir client com endpoint `https://${accountId}.r2.cloudflarestorage.com`
   - `upload` → `PutObjectCommand` com `Bucket`, `Key=${gabineteId}/${uuid}.ext`, `Body`, `ContentType`
   - `resolveDownload` → `getSignedUrl(client, GetObjectCommand, { expiresIn: 900 })`
   - `delete` → `DeleteObjectCommand`

5. Setar env em Railway:
   ```
   STORAGE_DRIVER=r2
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET=kamaia-documents
   ```

6. **Migração de ficheiros existentes** — copiar `apps/api/uploads/*`
   do volume Railway para R2 antes de remover o volume. Script:
   ```
   railway run bash -lc "tar czf /tmp/uploads.tgz uploads"
   # download local, descompactar, e usar rclone/cli S3 com endpoint R2
   # para sincronizar para o bucket.
   ```

## Vantagens R2 vs Volume

| | Volume Railway | R2 |
|---|---|---|
| Sobrevive a recreate | ✅ (5GB free) | ✅ (10GB free) |
| Backup | manual | automático |
| Acesso público | ❌ (passa pelo API) | ✅ via signed URL (libera CPU/RAM da API) |
| Custo egress | grátis até quota | grátis em R2 |
| Replication | none | CF edge (latency global) |

Para qualquer escala > beta privado, R2 é o caminho.
