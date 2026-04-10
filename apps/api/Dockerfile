# ═══════════════════════════════════════════════════════════
# Kamaia API — Multi-stage Dockerfile for Railway
# ═══════════════════════════════════════════════════════════

FROM node:20-alpine AS base
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

# ── Dependencies ──────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN npm ci

# ── Builder ───────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .

# Build shared-types first (workspace dependency)
RUN cd packages/shared-types && npx tsc

# Generate Prisma client and build NestJS
RUN cd apps/api && npx prisma generate
RUN cd apps/api && npx nest build

# ── Runner (production) ───────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production

# Copy node_modules (full tree for Prisma + runtime deps)
COPY --from=builder /app/node_modules ./node_modules

# Copy shared-types package (built)
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/

# Copy API build + Prisma
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

# Uploads directory (will be mounted as volume on Railway)
RUN mkdir -p /app/apps/api/uploads

WORKDIR /app/apps/api

EXPOSE 3001

# Run migrations then start app
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node dist/main"]
