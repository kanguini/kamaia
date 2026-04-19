# Kamaia Web — E2E (Playwright)

Suite end-to-end que complementa os testes backend (`apps/api/test/*.e2e-spec.ts`).
Corre contra uma instância real do `next dev` (levantada pelo próprio Playwright) e,
opcionalmente, contra uma API viva em `NEXT_PUBLIC_API_URL`.

## Pré-requisitos

- Node 20+
- Chromium Playwright instalado (`npx playwright install chromium`)
- API a correr em `localhost:3001` (para specs autenticadas) — `cd apps/api && npm run dev`
- Utilizador seeded (ver abaixo)

## Correr

```bash
cd apps/web

# UI pages only (sem backend): renders + validações client-side + toggles
npx playwright test auth.spec.ts --grep "render|rejects invalid|mismatched|toggle"

# Suite completa (requer API + utilizador seeded)
E2E_USER_EMAIL="tu@gabinete.ao" \
E2E_USER_PASSWORD="xxxxxxxx" \
npm run test:e2e

# UI interactiva
npm run test:e2e:ui

# Report HTML após correr
npm run test:e2e:report
```

## Variáveis de ambiente

| Var                  | Default                     | Usado em                   |
|----------------------|-----------------------------|----------------------------|
| `E2E_BASE_URL`       | `http://localhost:3000`     | `playwright.config.ts`     |
| `E2E_USER_EMAIL`     | `heldermaiato@outlook.com`  | `helpers/auth.ts → login` |
| `E2E_USER_PASSWORD`  | `test1234`                  | `helpers/auth.ts → login` |

## Specs

- **`auth.spec.ts`** (9 testes) — rendering, validação client-side, toggle mostrar/ocultar palavra-passe.
  Não requer backend para 7/9 testes.
- **`dashboard-smoke.spec.ts`** (15 testes) — smoke parametrizado: login + navega a cada página dashboard
  (Clientes, Processos, Projectos, Tarefas, Timesheets, Despesas, Agenda, Equipa, Prazos, Documentos,
  Facturas, IA Assistente, Configurações) e verifica 3 invariantes por página: HTTP status < 400,
  não redireccionou para `/login`, marcador textual visível.
