# Changelog

Todas as mudanças notáveis ao Kamaia. Formato baseado em [Keep a Changelog](https://keepachangelog.com/), versionamento semântico.

A partir de Junho 2026 o produto foi reposicionado de "Plataforma de Gestão de Prática Jurídica" para **Contract Lifecycle Management (CLM)**. O código pré-pivot vive na branch [`archive/pre-clm`](https://github.com/kanguini/kamaia/tree/archive/pre-clm).

## [Unreleased]

### Adicionado
- Frontend: `/alertas` — painel unificado de vencimentos próximos, janelas de denúncia e actos regulatórios pendentes
- Frontend: `/configuracoes/webhooks` — gestão de subscrições com revelação one-shot do secret HMAC e histórico de entregas
- Performance test escalado para **10.000 contratos** (1k → 10k) com validação dos 5 cenários críticos
- Tabela comparativa de escala 1k vs 10k em `ARCHITECTURE.md`

### Corrigido
- (nenhum)

## [0.2.0] — 2026-06-22 — CLM rewrite

Reposicionamento completo do produto. 23 commits.

### Adicionado

**Domínio CLM**
- 22 modelos Prisma: `Tenant`, `Membership`, `Entidade`, `Carteira`, `TipoContrato`, `Template`, `Clausula`, `Contrato` + sub-recursos, `TGISVerba`, `LegislationDocument`, etc.
- State machine do contrato com 17 estados + 4 modos de engajamento (drafting full, review contraparte, repositório, adenda)
- Compliance Engine declarativo com 20+ regras versionadas:
  - **IS / TGIS** (Decreto Legislativo Presidencial n.º 3/14): verbas 1, 2.1, 2.2, 10.1, 16.1.1, 23.3 com taxas reais
  - **BNA / Lei Cambial / RJOC**: autorização e registo de operações cambiais
  - **Registos**: Predial, Comercial, Automóvel, IAPI
  - **AGT**: retenção IRT 15% sobre serviços de não-residentes
  - **Notário**: compra e venda de imóvel, pacto social
- Adendas com herança de partes e numeração `{pai}-A{seq:2}`
- Importação em lote com OCR + extracção IA stub

**Multi-tenancy hierárquico**
- Plano `AGENCY` com sub-tenants para sociedades de advogados
- `TenantGuard` valida `Membership` directa ou herança via tenant-pai
- Header `X-Tenant-Id` obrigatório em endpoints scoped

**RBAC com 6 roles**
- `ADMIN`, `LEGAL_LEAD`, `CONTRACT_MANAGER`, `BUSINESS_USER`, `VIEWER`, `EXTERNAL`

**Integração IA**
- `ClaudeProvider` com fetch nativo (zero deps adicionais)
- Fallback gracioso quando `ANTHROPIC_API_KEY` ausente
- RAG context injection com chunks de legislação angolana
- 13 diplomas-âncora catalogados (CRA, CC, CCom, LSC, CIS, Lei Cambial, LGT, Lei 22/11, Lei 3/14, etc.)

**Webhooks**
- 10 eventos catalogados (`contrato.criado`, `contrato.assinado`, `acto_regulatorio.detectado`, etc.)
- HMAC SHA-256 sobre body com header `X-Kamaia-Signature`
- Worker cron @30s com backoff exponencial (1m → 24h, 6 tentativas)
- Wire-up automático em `ContratosService`, `ComplianceService`, `ContratoTerminacaoService`

**AlertsScheduler**
- Cron diário (default 08:00 WAT) varre datas-chave + actos pendentes
- Notifications IN_APP + EMAIL para responsável + ADMINs (dedup)
- Webhooks `contrato.expira_em_{30,7}_dias`, `janela_denuncia_proxima`, `renovacao_automatica_proxima`
- Idempotência via `ContratoEvento.payload`

**Backup**
- Export JSON completo por tenant (18 entidades agregadas)
- BigInt-safe serialization
- Manifest com contagens + audit log

**Frontend**
- 19 páginas Next.js 14 reescritas para CLM
- Workspace switcher tipo Linear (multi-tenant)
- Auth refeito (NextAuth sem `gabineteId`)
- Páginas críticas: `/contratos`, `/entidades`, `/carteiras`, `/compliance`, `/alertas`, `/importacao`, `/ia`, `/configuracoes/{organizacao,equipa,webhooks,sub-tenants}`

**Marketing**
- `kamaia.cc` reposicionado: homepage + funcionalidades + preços + sobre

**Documentação**
- `README.md` reescrito
- `docs/API.md` (614 linhas — 80+ endpoints)
- `docs/ARCHITECTURE.md` (462 linhas — diagramas + 13 ADRs)
- `PIVOT_REPORT.md` (sumário do reposicionamento)
- `CLAUDE.md` (regras de engenharia)

**Testes**
- **113 testes verde** (82 unit + 31 E2E)
- Unit: state machine (28), compliance engine (36), webhook worker (7), alerts scheduler (11)
- E2E: tenant isolation (9), adendas (6), lifecycle completo (11), performance (5 @ 1k contratos, agora 6 @ 10k)
- Smoke test reproduzível em `scripts/smoke-test.sh` — 16 checks HTTP

**CI/CD**
- GitHub Actions com 4 jobs paralelos (unit / e2e / smoke / web)
- Postgres + pgvector como service
- Migration baseline única em `migrations/20260622125445_initial_clm`

### Corrigido (bugs apanhados pelos próprios testes)

- BigInt JSON serialization: shim global em `main.ts` + `test/setup.ts` para evitar `TypeError: Do not know how to serialize a BigInt`
- `gerarNumero()` race condition + colisão com numeração seed (retry-loop de 10 tentativas)
- Cursor pagination perdia rows quando `createdAt` tinha duplicados — fix: tuple `[campo, id]` em `ContratosService.list()`
- `ContratoTerminacaoService.registar()` não disparava webhook `contrato.terminado` (actualizava estado directamente)
- TGIS verbas eram placeholders `TBD-*` — substituídas por verbas reais com referência legal
- IRT retenção subiu de 6,5% para 15% (Reforma Tributária)

### Arquivado (legacy pré-pivot)

Removidos do `main` e preservados em `archive/pre-clm`:
- 13 módulos NestJS (atendimentos, audiencias, billing, calendar, clientes, expenses, gabinetes, invoices, portal, prazos, processos, projects, tasks, team, timesheets, tramitacoes, workflows, reports, stats, public-contacts)
- 21 modelos Prisma legacy
- 24 páginas frontend de gestão de prática jurídica
- 20 testes E2E do legacy
- 15 migrations legacy

## [Pré-Junho 2026] — Kamaia (legal practice management)

Branch [`archive/pre-clm`](https://github.com/kanguini/kamaia/tree/archive/pre-clm) preserva o histórico:

- Sprint 0: Auth + RBAC + Gabinete
- Sprint 1: Processos + IA + Prazos (em curso à altura)
- Auditoria P0/P1/P2 (4 brechas de segurança fechadas)
- Sentry wired
- Account lockout
- R2 storage abstraction
- Invoices em basis-points

Última versão funcional do produto pré-pivot: commit `cdab02c`.
