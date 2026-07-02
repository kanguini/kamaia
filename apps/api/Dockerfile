# ═══════════════════════════════════════════════════════════
# Kamaia API — Multi-stage Dockerfile for Railway
# ═══════════════════════════════════════════════════════════

FROM node:20-alpine AS base
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

# ── Dependencies ──────────────────────────────────────────
# npm workspaces hoists everything to root /app/node_modules
FROM base AS deps
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN npm ci

# ── Builder ───────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build shared-types first (workspace dependency consumed by @kamaia/api)
RUN cd packages/shared-types && npx tsc

# Generate Prisma client and build NestJS
RUN cd apps/api && npx prisma generate
RUN cd apps/api && npx nest build

# ── Production deps (sem devDependencies) ─────────────────
# Auditoria: copiar o node_modules do builder levava jest/eslint/
# @nestjs/cli para produção — imagem inflada + superfície de supply
# chain. `prisma` vive em dependencies (o entrypoint corre
# `prisma migrate deploy` em runtime).
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN npm ci --omit=dev

# ── Runner (production) ───────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production

# node_modules de produção + Prisma client gerado (o generate escreve
# em node_modules/.prisma no builder — tem de vir de lá).
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy root package.json so workspace resolution still works
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./

# Copy shared-types package (built)
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/

# Copy API build + Prisma schema + entrypoint
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/entrypoint.sh ./apps/api/entrypoint.sh
RUN chmod +x /app/apps/api/entrypoint.sh

# Uploads directory (Railway volume mount point)
RUN mkdir -p /app/apps/api/uploads

# Auditoria: nunca correr como root — a API processa ficheiros hostis
# (pdf-parse/tesseract/mammoth); um RCE não pode dar root no container.
RUN chown -R node:node /app/apps/api/uploads
USER node

WORKDIR /app/apps/api

EXPOSE 3001

# Entrypoint script handles prisma migrate deploy + app start with logging
CMD ["./entrypoint.sh"]
