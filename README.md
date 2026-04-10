# Kamaia

> Plataforma de Gestao de Pratica Juridica com Assistente IA para Angola

Kamaia e uma plataforma SaaS de gestao de pratica juridica concebida especificamente para advogados independentes e pequenos gabinetes juridicos em Angola, com arquitectura preparada para expansao PALOP.

## Funcionalidades

- **Gestao de Processos** — CRUD com timeline, transicoes de estagio, 7 tipos processuais
- **CRM de Clientes** — pesquisa, filtros, quota por plano
- **Prazos & Alertas** — sugestao legal automatica (CPC, LGT), marcacao rapida, countdown
- **Agenda & Calendario** — vistas mes/semana/dia, prazos integrados
- **Assistente IA** — chat com quota (mock, pronto para Claude API)
- **Upload de Documentos** — multipart, 50MB max, quota de storage
- **Timesheets & Rentabilidade** — registo de horas, despesas, margem de lucro
- **Alertas Reais** — Email (Resend) + SMS (Twilio) + Web Push (VAPID)
- **Multi-tenant** — gabinete isolation + RBAC (4 roles) + audit log append-only
- **Acessibilidade** — WCAG AA: keyboard nav, ARIA labels, focus trap, reduced motion

## Stack

- **Backend**: NestJS 10 + Prisma 5 + PostgreSQL 16
- **Frontend**: Next.js 14 (App Router) + NextAuth.js + Tailwind CSS
- **Monorepo**: npm workspaces + Turborepo
- **Deploy**: Railway (API + DB) + Vercel (Web)

## Estrutura do Projecto

```
kamaia/
├── apps/
│   ├── api/              # NestJS backend
│   │   ├── src/modules/  # 16 modulos (auth, processos, clientes, prazos, ...)
│   │   └── prisma/       # Schema com 20 tabelas
│   └── web/              # Next.js frontend
│       └── src/app/      # App Router pages
└── packages/
    └── shared-types/     # Enums + types partilhados
```

## Desenvolvimento Local

### Pre-requisitos
- Node.js 20+
- PostgreSQL 16 (ou Postgres.app no macOS)
- npm 10+

### Setup

```bash
# Instalar dependencias
npm install

# Copiar env template
cp apps/api/.env.example apps/api/.env

# Editar DATABASE_URL no apps/api/.env

# Aplicar schema e seed data
cd apps/api
npx prisma db push
npx ts-node prisma/seed.ts
cd ../..

# Arrancar todos os servicos
npm run dev
```

API corre em `http://localhost:3001/api`, Web em `http://localhost:3000`.

### Credenciais de Dev

| Email | Password | Role |
|-------|----------|------|
| socio@kamaia.dev | Kamaia2026! | SOCIO_GESTOR |
| advogado@kamaia.dev | Kamaia2026! | ADVOGADO_MEMBRO |
| estagiario@kamaia.dev | Kamaia2026! | ESTAGIARIO |

## Deploy

Ver [DEPLOYMENT.md](./DEPLOYMENT.md) para o guia completo de deploy em Railway + Vercel.

**Urls de producao (apos deploy):**
- Web: https://kamaia.vercel.app
- API: https://kamaia-api.up.railway.app/api

## Scripts Uteis

```bash
npm run dev        # Arranca todos os servicos
npm run build      # Build para producao
npm run test       # Testes
npm run typecheck  # Type check
npm run lint       # Linter
npm run migrate    # Prisma migrate
npm run seed       # Carregar dados de teste
```

## Arquitectura

### Multi-tenant (Gabinete Isolation)
Todas as queries de negocio incluem `gabineteId` para isolamento total. Cada advogado solo IS um gabinete de 1.

### RBAC
4 roles: `SOCIO_GESTOR` (admin), `ADVOGADO_SOLO`, `ADVOGADO_MEMBRO`, `ESTAGIARIO`. Permissoes aplicadas via guards + decorators.

### Audit Log
Tabela append-only regista todas as operacoes de escrita (CREATE, UPDATE, DELETE, LOGIN, AI_QUERY, etc).

### Result Pattern
Services nunca fazem throw — retornam `Result<T>` com `{ success, data }` ou `{ success: false, error, code }`.

## Licenca

Proprietario — Kamaia Team

---

Feito com Claude Code + Claude Opus 4.6
