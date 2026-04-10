# Kamaia — Guia de Deploy

Este documento descreve como fazer deploy da Kamaia em producao usando **Railway** (API + PostgreSQL) e **Vercel** (Frontend).

## Pre-requisitos

- Conta GitHub (para o repo do codigo)
- Conta Railway (https://railway.app) — plano Hobby ~$5/mes apos trial
- Conta Vercel (https://vercel.com) — gratuito para projectos pessoais
- CLI tools:
  - `railway` — `curl -fsSL https://railway.app/install.sh | sh`
  - `vercel` — `npm i -g vercel`

---

## Passo 1 — GitHub

Se ainda nao tiveres o codigo no GitHub:

```bash
cd /path/to/kamaia
git remote add origin https://github.com/<user>/kamaia.git
git branch -M main
git push -u origin main
```

---

## Passo 2 — Railway (API + PostgreSQL)

### 2.1 Login e inicializacao

```bash
railway login
cd /path/to/kamaia
railway init
# Escolher "Empty Project" e dar um nome (ex: "kamaia-api")
```

### 2.2 Adicionar PostgreSQL

```bash
railway add
# Escolher "PostgreSQL"
```

Railway cria automaticamente a variavel `DATABASE_URL`.

### 2.3 Configurar variaveis de ambiente

No dashboard Railway → Service → Variables, adicionar:

```
JWT_SECRET=<gerar com: openssl rand -base64 32>
JWT_REFRESH_SECRET=<gerar com: openssl rand -base64 32>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
APP_ENV=production
FRONTEND_URL=https://<kamaia>.vercel.app

# Notifications (opcional — funcionam em dry-run mode sem keys)
RESEND_API_KEY=
RESEND_FROM_EMAIL=Kamaia <alerts@kamaia.ao>
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
VAPID_PUBLIC_KEY=<npx web-push generate-vapid-keys>
VAPID_PRIVATE_KEY=<npx web-push generate-vapid-keys>
VAPID_SUBJECT=mailto:alerts@kamaia.ao
```

### 2.4 Configurar volume persistente (uploads)

No dashboard Railway → Service → Settings → Volumes:
- Mount path: `/app/apps/api/uploads`
- Size: 1 GB (ou mais conforme necessario)

### 2.5 Deploy

```bash
railway up
```

Railway vai detectar o `railway.toml` e construir com o `apps/api/Dockerfile`.

### 2.6 Seed data (opcional)

Apos primeiro deploy:

```bash
railway run sh -c "cd apps/api && npx ts-node prisma/seed.ts"
```

### 2.7 Gerar dominio publico

No dashboard Railway → Service → Settings → Networking → "Generate Domain". Fica algo como `kamaia-api.up.railway.app`.

Verificar health:
```bash
curl https://kamaia-api.up.railway.app/api/health
```

---

## Passo 3 — Vercel (Web)

### 3.1 Login e deploy inicial

```bash
cd /path/to/kamaia
vercel login
vercel
```

Quando pedir:
- Link to existing project? **No**
- Project name: **kamaia**
- Framework: **Next.js** (auto-detectado)
- Root directory: `apps/web`

### 3.2 Configurar variaveis de ambiente

No dashboard Vercel → Project → Settings → Environment Variables:

```
NEXT_PUBLIC_API_URL=https://kamaia-api.up.railway.app/api
NEXTAUTH_URL=https://kamaia.vercel.app
NEXTAUTH_SECRET=<openssl rand -base64 32>

# Google OAuth (opcional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Aplicar a **Production** e **Preview**.

### 3.3 Promote to production

```bash
vercel --prod
```

### 3.4 Actualizar Railway com URL Vercel

No dashboard Railway, actualizar `FRONTEND_URL=https://kamaia.vercel.app` e redeploy.

---

## Passo 4 — Verificacao

1. Aceder `https://kamaia.vercel.app/login`
2. Login com `socio@kamaia.dev` / `Kamaia2026!` (se correu seed)
3. Verificar dashboard carrega com stats
4. Navegar para `/processos`, `/clientes`, `/agenda`, etc
5. Testar: criar processo, criar prazo, upload de documento
6. `curl https://kamaia-api.up.railway.app/api/health` → `{"status":"ok"}`

---

## Troubleshooting

### API nao arranca no Railway
- Verificar logs: `railway logs`
- Verificar DATABASE_URL definida (automatico mas confirmar)
- Verificar que o health check `/api/health` responde em 100s

### Build falha (Dockerfile)
- Verificar que `packages/shared-types/dist/` existe no build stage
- Reconstruir localmente: `docker build -f apps/api/Dockerfile -t kamaia-api .`

### NextAuth erro em producao
- `NEXTAUTH_URL` tem que coincidir com o dominio Vercel exacto (inclui https://)
- `NEXTAUTH_SECRET` obrigatorio em producao (nao pode ser vazio)

### CORS errors
- `FRONTEND_URL` no Railway tem que ser o dominio Vercel exacto
- Suporta multiplos origins separados por virgula: `https://kamaia.vercel.app,https://preview.vercel.app`

### Upload de documentos nao persiste
- Verificar que o volume foi montado em `/app/apps/api/uploads` no Railway
- Redeploy apos mount

---

## Custos Estimados

- **Railway Hobby**: $5/mes (inclui PostgreSQL + 500h exec)
- **Vercel Hobby**: Gratuito (limites: 100 GB bandwidth/mes)
- **Resend**: 100 emails/dia gratis
- **Twilio**: ~$0.05/SMS (apos credito inicial)

**Total inicial**: ~$5-10/mes

---

## Dominio Custom (opcional)

### Vercel
Settings → Domains → Add → Configurar DNS CNAME

### Railway
Settings → Networking → Custom Domain → Configurar DNS CNAME

Apos configurar, actualizar env vars:
- `NEXTAUTH_URL=https://app.kamaia.ao`
- `FRONTEND_URL=https://app.kamaia.ao`
- `NEXT_PUBLIC_API_URL=https://api.kamaia.ao/api`

---

## Backups

Railway PostgreSQL faz backups automaticos (depende do plano). Para backups manuais:

```bash
railway run pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

---

## CI/CD

O repo ja tem GitHub Actions configurado (`.github/workflows/ci.yml`) que corre:
- Lint
- Typecheck
- Tests

Railway e Vercel fazem auto-deploy em push para `main` quando conectados ao repo GitHub.
