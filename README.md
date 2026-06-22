# Kamaia CLM

> Contract Lifecycle Management para Angola & PALOP

Plataforma SaaS de gestão de contratos (CLM) horizontal, multi-sector, com **compliance angolano embebido** — Imposto de Selo, Registos públicos, BNA / Lei Cambial / RJOC, retenção AGT IRT, reconhecimento notarial — e **assistente IA sobre legislação angolana**.

## Compradores-alvo

- **Empresas** com carteira contratual (Imobiliário, Indústria, Serviços, Energia, Banca, Comércio…)
- **Sociedades de advogados** que oferecem CLM-as-a-service aos seus clientes (plano `AGENCY` com sub-tenants)

## Arquitectura

### Multi-tenancy hierárquico

```
Tenant (plan=AGENCY: "Sociedade de Advogados X")
   ├── Tenant (plan=GROWTH: "Cliente A")
   ├── Tenant (plan=STARTER: "Cliente B")
   └── Tenant (plan=GROWTH: "Cliente C")
```

- Header obrigatório `X-Tenant-Id` em todos os requests autenticados
- `TenantGuard` valida `Membership` (directa ou via tenant-pai AGENCY)
- Isolamento total de dados, pesquisa e IA entre tenants

### RBAC (6 roles, não específicas de advogado)

`ADMIN` · `LEGAL_LEAD` · `CONTRACT_MANAGER` · `BUSINESS_USER` · `VIEWER` · `EXTERNAL`

### Domínio CLM

```
Tenant ─┬─ Entidade (contrapartes)
        ├─ Carteira (grouping opcional)
        ├─ TipoContrato (catálogo global + custom)
        ├─ Template + Clausula (biblioteca por tenant)
        └─ Contrato ─┬─ ContratoVersao (timeline imutável)
                     ├─ ContratoParte → Entidade
                     ├─ ContratoDataChave (vencimento/renovação/denúncia)
                     ├─ ContratoObrigacao (periódicas)
                     ├─ ContratoActoRegulatorio (IS/Registos/BNA/AGT)
                     ├─ ContratoNegociacaoPonto
                     ├─ ContratoEvento (append-only)
                     ├─ ContratoAdenda (= Contrato com parentId)
                     └─ ContratoTerminacao
```

### Estados do contrato

```
INTAKE → DRAFTING → REV_INTERNA → REV_CLIENTE → EM_NEGOCIACAO ⇌
   → APROVACAO → PRONTO_ASSINATURA → ASSINADO → POS_ASSINATURA → ACTIVO
   → EM_DISPUTA / EM_ADENDA / EM_TERMINACAO → TERMINADO → ARQUIVADO

REPOSITORIO: entrada especial para contratos importados já assinados.
```

### Compliance Engine

Motor de regras declarativas versionadas. Cada regra tem `id`, `versao`, `referenciaLegal`, `vigenteDesde`/`vigenteAte` e funções puras `aplicaSe(ctx)` + `build(ctx)`.

**O engine sugere, nunca executa.** Cada acto requer confirmação humana com disclaimer.
**A regra vigente à data do facto tributário é a aplicável**, não a data presente.

| Categoria | Regras seed |
|---|---|
| **Imposto de Selo (TGIS)** | Prestação de serviços, arrendamento, mútuo, compra e venda de imóvel, contrato de trabalho |
| **Registos** | Predial, Comercial, Automóvel, IAPI |
| **BNA / Lei Cambial / RJOC** | Serviços com não-residente (autorização), mútuo internacional, registo cambial pequeno |
| **AGT** | Retenção IRT sobre serviços de não-residentes |
| **Notário** | Compra e venda de imóvel, pacto social |

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | NestJS 10 + Prisma 5 + PostgreSQL 16 + pgvector |
| Frontend | Next.js 14 (App Router) + NextAuth.js + Tailwind |
| Monorepo | npm workspaces + Turborepo |
| Storage | R2 (S3-compatible) + LocalDisk fallback |
| Jobs (futuro) | BullMQ + Redis |
| IA | Claude API (Q&A legislação, extracção, diff) |
| Email · SMS · Push | Resend · Twilio · VAPID |
| Observabilidade | Sentry |
| Deploy | Railway (API+DB) + Vercel (Web+Marketing) |

## Estrutura do monorepo

```
kamaia/
├── apps/
│   ├── api/              # NestJS backend
│   │   ├── src/modules/  # auth, tenants, contratos, compliance, ...
│   │   └── prisma/       # Schema CLM + seeds
│   ├── web/              # Next.js dashboard
│   └── marketing/        # Site público (kamaia.cc)
└── packages/
    └── shared-types/     # Enums + tipos + state machine
```

### Módulos backend

| Módulo | Função |
|---|---|
| `auth` | Login, register, JWT |
| `users` | Perfil |
| `tenants` | CRUD + hierarquia AGENCY |
| `memberships` | Convites + roles |
| `entidades` | Contrapartes |
| `carteiras` | Grouping opcional |
| `tipos-contrato` | Catálogo global + custom |
| `templates` · `clausulas` | Biblioteca |
| `contratos` | CRUD + state machine + sub-recursos |
| `compliance` | Engine + regras IS/BNA/Registos/AGT/Notário |
| `importacao` | Lote-based ingestion |
| `documents` | Storage (Local/R2) |
| `ia` · `rag` | Conversas + legislação indexada |
| `notifications` | Email/SMS/Push (worker stub) |
| `holidays` · `audit` · `backup` · `seed` · `health` | Infra |

## Desenvolvimento local

### Pré-requisitos

- Node.js 20+
- PostgreSQL 16 (com extensão pgvector)
- npm 10+

### Setup

```bash
npm install

cp apps/api/.env.example apps/api/.env
# Edita DATABASE_URL no apps/api/.env

cd apps/api
npx prisma db push
npx ts-node prisma/seed.ts
cd ../..

npm run dev
```

| Serviço | URL |
|---|---|
| API | http://localhost:3001/api |
| Web | http://localhost:3000 |
| Marketing | http://localhost:3002 |

### Credenciais de dev

| Email | Password | Role |
|---|---|---|
| `admin@kamaia.dev` | `Kamaia2026!` | `ADMIN` |
| `legal@kamaia.dev` | `Kamaia2026!` | `LEGAL_LEAD` |
| `manager@kamaia.dev` | `Kamaia2026!` | `CONTRACT_MANAGER` |

Tenant demo: `kamaia-demo` (plan=GROWTH).

## Comandos úteis

| Comando | Função |
|---|---|
| `npm run dev` | Arranca tudo (turbo) |
| `npm run test` | Jest |
| `npm run migrate` | `prisma migrate dev` |
| `npm run seed` | TGIS + tipos + legislação + tenant demo |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## Posicionamento

### O que o Kamaia NÃO é

- Não é um sistema de gestão de prática jurídica (litígio, processos, prazos CPC, audiências). Esse código vive na branch [`archive/pre-clm`](https://github.com/kanguini/kamaia/tree/archive/pre-clm).
- Não é um Clio / MyCase localizado.
- **Não substitui aconselhamento jurídico profissional.** As sugestões do Compliance Engine vêm com disclaimer e exigem confirmação humana.

### O que o Kamaia É

- CLM horizontal, multi-sector, alto volume (alvo 50k contratos por tenant)
- Compliance angolano embebido (não plugin) com regras versionadas
- IA Q&A sobre legislação angolana com citação ao artigo
- Hierarquia multi-tenant para gabinetes oferecerem CLM aos seus clientes

## Status

**Junho 2026 — CLM rewrite inicial.** Backend modular completo, frontend reescrito, marketing reposicionado. Pré-produção, a iterar com early adopters.

## Histórico

- **Pré-Junho 2026:** Kamaia foi concebido como plataforma de gestão de prática jurídica. Esse código vive em `archive/pre-clm`.
- **Junho 2026:** Pivot para CLM horizontal, multi-sector, com compliance angolano embebido.

## Licença

Proprietary — todos os direitos reservados.
