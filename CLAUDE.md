# KAMAIA — Contract Lifecycle Management (CLM) para Angola

## Identidade do Projecto

- **Produto:** Kamaia — plataforma SaaS de gestão de contratos (CLM)
- **Mercado:** Angola → PALOP
- **Posicionamento:** *"O sistema operativo dos contratos da tua organização"*
- **Comprador-alvo:**
  - **Empresas** com carteira de contratos (Imobiliário, Indústria, Serviços, Energia, Banca, Retail)
  - **Sociedades de Advogados** que oferecem CLM-as-a-service aos seus clientes (modo `AGENCY` com sub-tenants)
- **Diferenciador defensável:** Localização profunda em Angola — Imposto de Selo (TGIS) automático, registos públicos, BNA/Lei Cambial, retenção AGT, biblioteca de cláusulas PT-AO, IA Q&A sobre legislação angolana

## Fase actual

- **CLM rewrite (Junho 2026)** — pivot de software jurídico de prática para CLM horizontal
- Branch `archive/pre-clm` preserva o código anterior (legal practice management)

## Arquitectura — Regras Absolutas

### Multi-tenancy hierárquico
- **`Tenant`** é a unidade de isolamento (renomeado de `Gabinete`)
- Tenants podem ter `parentTenantId` para o modo `AGENCY` (sociedade de advogados → tenants dos seus clientes)
- `tenantId` obrigatório em **TODAS** as tabelas de negócio
- Todas as queries de repositório incluem `WHERE tenantId = ?`
- `Membership` (M:M entre `User` e `Tenant`) com `Role` por tenant
- Header obrigatório `X-Tenant-Id` em todos os requests autenticados, validado contra `Membership`

### RBAC (6 roles, não específicas de advogado)
- `ADMIN` — gere o tenant
- `LEGAL_LEAD` — aprova templates, cláusulas; revê contratos críticos
- `CONTRACT_MANAGER` — cria, edita, negoceia, encaminha
- `BUSINESS_USER` — solicita contratos, comenta, vê os seus
- `VIEWER` — read-only
- `EXTERNAL` — escopo restrito a contratos específicos

### Padrões obrigatórios
- **Audit log:** TODAS as escritas geram registo em `audit_log` (append-only)
- **Soft delete:** nunca DELETE físico em dados de negócio
- **Result<T> pattern:** services nunca fazem `throw` em lógica de negócio
- **TypeScript strict mode:** sem `any` implícito
- **Zod:** validação em todos os endpoints (`ParseZodPipe`)
- **Cursor-based pagination:** nunca offset
- **Moeda:** valores monetários armazenados em `BigInt` (centavos). Nunca floats.
- **Datas:** UTC no backend → WAT (UTC+1) no frontend
- **Timeline imutável por contrato:** `ContratoEvento` é append-only
- **Compliance engine declarativo:** regras versionadas em `apps/api/src/modules/compliance/regras/`, nunca lógica solta em services

### Performance / volume
- Alvo: **50.000 contratos por tenant** sem degradação perceptível
- Full-text search: Postgres `tsvector` com configuração `portuguese`, índices GIN
- Job queue: BullMQ + Redis para OCR, extracção IA, notificações em massa
- Outbox pattern para eventos de domínio (timeline + webhooks fiáveis)

## Domínio CLM

### Entidades-chave
| Entidade | Papel |
|---|---|
| `Tenant` | Organização (empresa ou cliente de um gabinete-revendedor) |
| `Membership` | Associação User ↔ Tenant com Role |
| `Entidade` | Contraparte (qualquer parte de um contrato — pessoa singular ou colectiva) |
| `Carteira` | Container opcional (deal, projecto, imóvel) que agrupa contratos |
| `TipoContrato` | Catálogo de tipos com gatilhos regulatórios padrão |
| `Contrato` | Unidade central |
| `ContratoVersao` | Histórico imutável de versões (draft + assinada) |
| `ContratoParte` | Quem assina, em que papel |
| `ContratoDataChave` | Vencimento, renovação, denúncia, pagamento, entrega |
| `ContratoObrigacao` | Obrigações periódicas/contínuas |
| `ContratoActoRegulatorio` | IS, registos, BNA, AGT — compliance angolano |
| `ContratoNegociacaoPonto` | Pontos abertos na negociação |
| `ContratoEvento` | Timeline append-only |
| `Template` / `Clausula` | Biblioteca por tenant |
| `ImportacaoLote` | Importação em massa de carteira legada |
| `TGISVerba` | Catálogo da Tabela Geral do Imposto de Selo (versionado) |

### Estados do contrato
```
INTAKE → DRAFTING → REV_INTERNA → REV_CLIENTE → EM_NEGOCIACAO ⇌
   → APROVACAO → PRONTO_ASSINATURA → ASSINADO → POS_ASSINATURA → ACTIVO
   → EM_DISPUTA / EM_ADENDA / EM_TERMINACAO → TERMINADO → ARQUIVADO

REPOSITORIO: entrada especial para importação em massa (contratos pré-existentes assinados)
```

### Modos de engajamento
- **Modo A — Drafting full:** redacção interna (intake → assinatura)
- **Modo B — Review da contraparte:** minuta recebida, entra em `EM_NEGOCIACAO`
- **Modo C — Custódia/Repositório:** importação em massa, entra em `ACTIVO`
- **Modo D — Renovação/Adenda:** sub-ciclo derivado do contrato pai

## Compliance Engine Angolano

Regras declarativas versionadas, nunca embebidas em services. Cada regra:
- Tem `id`, `referenciaLegal`, `vigenteDesde`/`vigenteAte`
- Função `aplicaSe(contrato): boolean`
- Produz `ContratoActoRegulatorio` com `detectadoAutomaticamente=true`

**Princípio de segurança:** o engine **sugere**, nunca executa. Cada acto entra como `PENDENTE`, requer confirmação humana, e tem disclaimer visível. A lei vigente à data do facto tributário (não a data presente) é a aplicável.

### Categorias cobertas no MVP
- **Imposto de Selo (TGIS)** — cálculo por verba + tipo + valor
- **Registos públicos** — Comercial, Predial, Automóvel, IAPI
- **BNA / Lei Cambial / RJOC** — operações com não-residentes
- **AGT** — retenção na fonte IRT sobre serviços de não-residentes
- **Reconhecimento notarial** — quando obrigatório por lei

## Stack

- **Backend:** NestJS 10 + Prisma 5 + PostgreSQL 16 + pgvector + Redis + BullMQ
- **Frontend:** Next.js 14 (App Router) + NextAuth.js + Tailwind CSS
- **Monorepo:** npm workspaces + Turborepo
- **Deploy:** Railway (API + DB + Redis) + Vercel (Web + Marketing)
- **IA:** Claude API (Q&A legislação, extracção, diff inteligente)
- **Email:** Resend
- **Storage:** R2 (S3-compatible)
- **Observabilidade:** Sentry

## Comandos Úteis

- `npm run dev` — inicia todos os serviços (turbo)
- `npm run test` — jest
- `npm run migrate` — `prisma migrate dev`
- `npm run seed` — dados de teste (TGIS, TipoContrato, tenants demo)
- `npm run lint` — eslint
- `npm run typecheck` — `tsc --noEmit`

## Regras de Desenvolvimento

- NUNCA commitar secrets — usar `.env.local` (não tracked)
- NUNCA usar floats para valores monetários — sempre `BigInt` (centavos)
- SEMPRE gerar migration para alterações de schema
- SEMPRE escrever testes para regras do `ComplianceEngine`
- SEMPRE incluir `tenantId` em queries de dados de negócio
- SEMPRE logar escritas no `audit_log`
- SEMPRE adicionar entrada em `ContratoEvento` quando o estado do contrato muda

## Ficheiros Críticos

- Schema DB: `apps/api/prisma/schema.prisma`
- Tipos partilhados: `packages/shared-types/src/index.ts`
- Tenant guard: `apps/api/src/common/guards/tenant.guard.ts`
- Compliance Engine: `apps/api/src/modules/compliance/`
- Regras versionadas: `apps/api/src/modules/compliance/regras/`
- Catálogo TGIS seed: `apps/api/prisma/seeds/tgis.ts`
- Catálogo TipoContrato seed: `apps/api/prisma/seeds/tipos-contrato.ts`

## Credenciais de Dev

- PostgreSQL: `kamaia / kamaia_dev_2024 @ localhost:5432/kamaia`
- Redis: `localhost:6379`
- Seed users:
  - `admin@kamaia.dev / Kamaia2026!` (ADMIN no tenant demo)
  - `legal@kamaia.dev / Kamaia2026!` (LEGAL_LEAD)
  - `manager@kamaia.dev / Kamaia2026!` (CONTRACT_MANAGER)

## Histórico (para contexto)

- **Pré-Junho 2026:** Kamaia foi concebido como software de gestão de prática jurídica (processos, prazos CPC, audiências, etc.). Esse código vive em `archive/pre-clm`.
- **Junho 2026:** Pivot para CLM horizontal, multi-sector, com compliance angolano embebido.
