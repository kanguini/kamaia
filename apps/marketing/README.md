# Kamaia — Marketing site

Next.js 14 App Router site público em `kamaia.ao`. Separado da aplicação
autenticada (`apps/web`) para optimizar SEO, bundle e deploy independente.

## Desenvolvimento

```bash
# A partir da raiz do monorepo
npm install

# Apenas esta app
npm run dev --workspace=@kamaia/marketing
# → http://localhost:3002

# Todas as apps (web:3000 + api:3001 + marketing:3002)
npm run dev
```

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Next dev server em `:3002` |
| `npm run build` | Production build |
| `npm run start` | Serve build localmente |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `next lint` |
| `npm run capture-screens` | Playwright → extrai screenshots da app real para `public/screens/` |

## Estrutura

```
apps/marketing/
├── src/
│   ├── app/              # Routes (App Router)
│   ├── components/       # Logo, AnimatedGradient, Nav, etc.
│   ├── content/          # MDX content (Sprint 1+)
│   └── styles/
│       └── globals.css   # Kamaia 2.0 tokens
├── public/
│   └── screens/          # Capturas reais da app (Playwright)
├── scripts/
│   └── capture-screenshots.ts
└── next.config.js
```

## Variáveis de ambiente

Copia `.env.example` → `.env.local`. Campos:

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Destino dos CTAs "Começar grátis" / "Entrar" |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL (SEO) |
| `RESEND_API_KEY` | Server action de contacto (Sprint 2+) |
| `CONTACT_NOTIFY_EMAIL` | Email de destino dos contactos |
| `SCREENS_*` | Credenciais usadas pelo `capture-screens` |

## Roadmap

Ver `/docs/marketing/development-plan.md` para o plano completo em 4 sprints.

- ✅ Sprint 0 — bootstrap + landing placeholder
- ⏳ Sprint 1 — home completa + /funcionalidades
- ⏳ Sprint 2 — /precos + /contacto + conversão
- ⏳ Sprint 3 — polimento + launch
