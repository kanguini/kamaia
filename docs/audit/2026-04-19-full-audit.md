# Auditoria Kamaia — Backend + Frontend

**Data:** 2026-04-19
**Commit base:** `84476d4` (pré auth 2.0 + password toggle)

## TL;DR

| Camada    | Estado             | Cobertura                                       |
|-----------|--------------------|-------------------------------------------------|
| Backend   | ✅ Saudável        | 24 suites / 87 testes — 100% passam (69s)       |
| Frontend  | ⚠️ Sem automatização até hoje | Playwright bootstrapped — 24 testes criados, 8/8 sem-backend passam |
| Infra CI  | ❌ Ausente         | Nenhum workflow GitHub Actions encontrado        |

## 1. Backend

### 1.1 Suite existente

```
Test Suites: 24 passed, 24 total
Tests:       87 passed, 87 total
Time:        69.142 s
```

Módulos cobertos (e2e):
`auth · users · tasks · projects · processos · processos-stages · timesheets · expenses ·
invoices · calendar · notifications · team · holidays · documents · workflows · clientes ·
prazos · gabinetes · ia · stats · billing · reports · portal · executive-dashboard`

### 1.2 Gaps

Módulos **sem** spec dedicada:

| Módulo   | Risco  | Nota                                                                    |
|----------|--------|-------------------------------------------------------------------------|
| `audit`  | médio  | Usado por vários serviços para append-only logs — teste deve garantir que escrever não quebra e que read respeita RLS |
| `backup` | médio  | Há uma pasta mas sem `backup.e2e-spec.ts` — o endpoint `/backup/export` merece teste de auth + output válido JSON |
| `rag`    | baixo  | Funcionalidade AI, depende de chaves externas — difícil de testar sem mocks pesados |
| `health` | baixo  | Trivial mas vale um ping de 200 OK                                      |
| `seed`   | baixo  | Endpoint de dev, não é prioritário                                      |
| `prisma` | n/a    | Módulo de infra, não expõe endpoints                                    |

### 1.3 Pontos fortes

- Padrão consistente: `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.dto.ts` com Zod
- Setup global em `test/setup.ts` com `.env.test` fallback
- Jest timeout 30s + `runInBand` evita flakes de paralelismo com a DB
- Guards em camadas (`JwtAuthGuard` → `GabineteGuard` → `RolesGuard`) consistentes em todos os controllers

### 1.4 Aviso deprecation

`ts-jest`: opção `isolatedModules` deprecated (removida em v30). Migrar para
`"isolatedModules": true` no `tsconfig.json`. Baixa prioridade.

## 2. Frontend

### 2.1 Estado antes desta auditoria

- **Zero** testes automatizados em `apps/web`
- Nenhuma dependência de test framework (Jest, Vitest, Playwright, Cypress) instalada
- Ficheiros `package.json` sem scripts `test` / `test:e2e`

### 2.2 Setup introduzido nesta auditoria

1. `@playwright/test` adicionado como devDependency em `apps/web`
2. Chromium instalado (`npx playwright install chromium`)
3. `apps/web/playwright.config.ts` — levanta `next dev` automaticamente, screenshots+videos em falhas
4. `apps/web/e2e/helpers/auth.ts` — helper partilhado `login(page)` parametrizado por env
5. Scripts em `package.json`:
   - `npm run test:e2e`
   - `npm run test:e2e:ui`
   - `npm run test:e2e:report`
6. Artifactos Playwright (`playwright-report/`, `test-results/`, `.playwright/`, `blob-report/`) adicionados ao `.gitignore`

### 2.3 Specs criados

**`e2e/auth.spec.ts`** (9 testes — 7 correm sem backend):

- Auth pages render (3)
  - login → heading, form, slogan, sem botões Google/Microsoft
  - register → 2 nomes, email, 2 passwords, nome gabinete
  - forgot-password → email + submit
- Auth validation (3)
  - login rejeita email mal-formado (validação HTML5)
  - login mostra erro com credenciais erradas **[requer API]**
  - register bloqueia passwords diferentes (Zod)
- Password show/hide toggle (2)
  - toggle único em login
  - toggles independentes em register (password + confirmar)

Resultado local: **7/7 passam** (os que não precisam de API). Média 7s/teste.

**`e2e/dashboard-smoke.spec.ts`** (15 testes — todos requerem API + utilizador seeded):

Smoke parametrizado sobre 14 módulos dashboard (`/`, `/clientes`, `/processos`, `/projectos`,
`/tarefas`, `/timesheets`, `/despesas`, `/agenda`, `/equipa`, `/prazos`, `/documentos`,
`/facturas`, `/ia-assistente`, `/configuracoes`) + 1 teste de chrome persistente.

Cada módulo verifica **3 invariantes**:
1. HTTP status < 400
2. URL não redirecciona para `/login` (sessão válida)
3. Marcador textual visível (prova que não é só o shell do layout)

### 2.4 Módulos frontend sem cobertura específica (próximos passos)

Smoke cobre "carrega". Cobertura profunda a adicionar:

| Fluxo                          | Prioridade | Nota                               |
|--------------------------------|------------|-------------------------------------|
| Criar cliente (modal/form)     | Alta       | Já há bug reportado (NIF dup)       |
| Criar processo (wizard)        | Alta       | 5 steps, validação por step         |
| Criar prazo + alerta           | Alta       | Email + SMS dispara                 |
| Upload documento               | Média      | Multipart, validação de tipo        |
| Criar factura + PDF            | Média      | Download real, checksum conteúdo    |
| Navegar de projecto → processos| Média      | Breadcrumb + detach/attach          |
| Portal do cliente (quando existe)| Baixa    | Fluxo paralelo, login diferente     |

## 3. Gaps estratégicos

### 3.1 CI/CD

**Não existe** nenhum workflow em `.github/workflows/`. Recomendações:

```yaml
# .github/workflows/ci.yml (sketch)
on: [push, pull_request]
jobs:
  backend:
    steps:
      - npm ci
      - npm run typecheck
      - npm run test:e2e   # apps/api
  frontend:
    steps:
      - npm ci
      - npm run typecheck
      - npm run lint
      - npx playwright install --with-deps chromium
      - npm run build
      # test:e2e requer infra (DB + API) — para PR simples correr só auth.spec
```

### 3.2 DB de teste

E2E backend usa a mesma `.env` de dev. Em CI seria preferível uma DB ephemeral
(Postgres service no GitHub Actions) com `prisma migrate deploy` antes dos testes.

### 3.3 Seed para E2E frontend

`dashboard-smoke.spec.ts` depende de um utilizador existente. Opções:

1. **Fixture Playwright** — `test.beforeAll` que faz `POST /auth/register` se o email não existe
2. **Seed dedicado** — `npm run seed:e2e` que garante estado reproduzível
3. **Test user permanente** — documentado no README (actual)

Preferir (1) para isolar e permitir correr em paralelo.

### 3.4 Contrato API-Web

Não há validação automática de que o frontend consome o mesmo shape que o backend
publica. `@kamaia/shared-types` existe mas nada garante que está a ser usado em
todas as `fetch` do frontend. Sugerir:

- Script que grep `fetch.*\/api\/` e confirma que o response type é importado de shared-types
- OpenAPI spec (já mencionada no CLAUDE.md do HEXA) — Kamaia não tem

## 4. Próximos passos recomendados (priorizados)

1. **[P1]** Correr `npm run test:e2e` no frontend contra API local + seeded user para validar os 15 smokes
2. **[P1]** Criar `apps/api/test/backup.e2e-spec.ts` (gap conhecido — `/backup/export` já teve bug 401)
3. **[P1]** Criar `apps/api/test/audit.e2e-spec.ts` (sensível — append-only + RLS)
4. **[P2]** Bootstrap `.github/workflows/ci.yml` com os 2 jobs acima
5. **[P2]** Adicionar fixture Playwright que cria user descartável em vez de depender de env
6. **[P3]** Escrever specs de fluxo (criar cliente/processo/prazo end-to-end)
7. **[P3]** Migrar `ts-jest isolatedModules` para tsconfig

## 5. Ficheiros alterados nesta auditoria

```
apps/web/package.json                          (scripts test:e2e*)
apps/web/playwright.config.ts                  (NEW)
apps/web/e2e/helpers/auth.ts                   (NEW)
apps/web/e2e/auth.spec.ts                      (NEW, 9 testes)
apps/web/e2e/dashboard-smoke.spec.ts           (NEW, 15 testes)
apps/web/e2e/README.md                         (NEW)
.gitignore                                     (artifactos Playwright)
docs/audit/2026-04-19-full-audit.md            (este documento)
```
