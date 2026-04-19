# Plano de desenvolvimento — Site Kamaia

**Companheiro do PRD** (`site-prd.md`).
**Duração:** 4 sprints de 1 semana.
**Entregável final:** `kamaia.ao` em produção com lead capture e analytics.

---

## Regras do jogo

- **1 commit por sub-tarefa** — diffs pequenos, reviewable, deploy incremental
- **Deploys desde o Sprint 0** — cada sprint deve terminar com push em produção (mesmo se parcial). Nada de "big bang" no final
- **Cada sprint tem Acceptance Criteria** objectivo: se o AC não é satisfeito, rola para o sprint seguinte (não adiamos o launch por perfeccionismo)
- **Pair com Helder em decisões de produto** — conteúdo, preços, testemunhos — e solo em execução técnica
- **Conteúdo pode ser placeholder até Sprint 3** — estrutura + design entram primeiro; copy final no polimento

## Dependências externas (user, não Claude)

Estas bloqueiam/permitem tarefas específicas. **Devem começar no dia 1**, em paralelo com o Sprint 0:

| Item | Responsável | Prazo | Bloqueia |
|---|---|---|---|
| Comprar domínio `kamaia.ao` (+ `.com` backup) | Helder | Sprint 0 | Deploy final Sprint 3 |
| Validar preços com 3 advogados | Helder | Sprint 0–1 | /precos Sprint 2 |
| Obter 2–3 testemunhos de advogados piloto | Helder | Sprint 1–2 | Social proof Sprint 2 |
| Criar projecto Vercel separado + subdomínio | Helder | Sprint 0 | Primeiro preview deploy |
| Conta Resend API key (ou reusar a da app) | Helder | Sprint 2 | Formulário /contacto |
| Conta Plausible Analytics | Helder | Sprint 3 | Tracking de conversão |
| Logo variações (square 512 + OG image 1200×630) | Helder ou design | Sprint 3 | Redes sociais |

---

## Sprint 0 — Fundação

**Objectivo:** infraestrutura pronta para escrever conteúdo. Zero conteúdo real.

### Tarefas técnicas (Claude)
- [x] Criar `apps/marketing/` como nova app no monorepo
- [x] `package.json` com Next.js 14 + Tailwind + TypeScript + framer-motion
- [x] `tailwind.config.ts` alinhado com tokens `--k2-*`
- [x] `src/styles/globals.css` importa os mesmos tokens da app (dark-first)
- [x] `src/app/layout.tsx` — shell mínimo (html, body, Inter font)
- [x] `src/app/page.tsx` — "Em breve" placeholder com logo e slogan
- [x] `src/components/Logo.tsx` — duplicado leve do wordmark da app
- [x] `src/components/AnimatedGradient.tsx` — extract do degradê animado da auth
- [x] `tsconfig.json` + `tsconfig.base.json` extend
- [x] `.gitignore`, `.env.example`, `README.md`
- [x] Script Playwright: `apps/marketing/scripts/capture-screenshots.ts` — faz login na app, navega pelas 10 páginas, salva PNGs 2x
- [x] Verificação: `npm run dev` na raiz arranca a marketing app em `:3002` sem quebrar a web (`:3000`) nem api (`:3001`)

### Acceptance Criteria Sprint 0
- [x] `npm run dev` no root levanta 3 apps simultâneos
- [x] `http://localhost:3002` mostra "Kamaia · Em breve" com o wordmark + degradê animado
- [x] `npm run typecheck` passa em toda a monorepo
- [x] Commit push em `main` com deploy preview Vercel funcional

### Tarefas paralelas (Helder)
- [ ] Comprar `kamaia.ao` (registrar.ao ou equivalente). Backup: `kamaia.com`
- [ ] Criar projecto Vercel "kamaia-site" apontando para `apps/marketing`
- [ ] Apontar `kamaia.ao` (temporariamente um subdomínio `preview.kamaia.ao` enquanto aguarda .ao)
- [ ] Abrir conversa com 3 advogados de referência sobre preços (template email em anexo abaixo)

---

## Sprint 1 — Home + Funcionalidades

**Objectivo:** página inicial navegável com estrutura final. Conteúdo ainda pode ser "Lorem ipsum pt-AO" em algumas secções.

### Tarefas técnicas
- [ ] `Nav.tsx` — logo + links (Funcionalidades, Preços, Sobre, Contacto) + toggle theme + "Entrar" / "Começar grátis"
- [ ] `Footer.tsx` — links + ano + política/termos stub
- [ ] Home hero:
  - H1 + sub-headline do PRD
  - 2 CTAs
  - Screenshot dashboard (já capturado Sprint 0) com ligeiro ângulo 3D
  - `AnimatedGradient` como background
- [ ] Secção "Problema → Solução" (3 cards em grid)
- [ ] Secção "Funcionalidades em destaque" (6 cards, 2×3 em desktop, 1 coluna em mobile)
- [ ] Secção "Feito para Angola" (AKZ, feriados, OAA, WAT)
- [ ] Secção social proof placeholder (cards vazios com estrutura)
- [ ] CTA final + footer
- [ ] `/funcionalidades/page.tsx` — deep dive alternado esquerda/direita com screenshots
- [ ] MDX setup para `src/content/*.mdx`
- [ ] Scroll reveals leves com framer-motion (`useInView`)

### Acceptance Criteria Sprint 1
- [ ] `/` renderiza todas as 8 secções sem erros
- [ ] `/funcionalidades` com 9 módulos
- [ ] Responsive: desktop, tablet, mobile
- [ ] Lighthouse Performance ≥ 90 no mobile (ainda não 95 — conteúdo de imagem vai crescer)
- [ ] Deploy preview Vercel aprovado por Helder

### Tarefas paralelas
- [ ] Helder decide tom de voz final (revê 2–3 parágrafos do hero)
- [ ] Iniciar captura dos testemunhos (ligações / visitas)

---

## Sprint 2 — Conversão

**Objectivo:** site capta leads reais.

### Tarefas técnicas
- [ ] `/precos/page.tsx` com tabela comparativa (4 planos do PRD)
  - Variante alternativa "esconder preços + CTA 'falar com vendas'" feature-flagged via env
- [ ] `/contacto/page.tsx`:
  - Formulário com Zod validation (nome, email, telefone, gabinete, mensagem)
  - Server action → Resend → email para Helder
  - Confirmação visual + redirect para obrigado
  - WhatsApp click-to-chat button
  - Link "Agendar demo" → Calendly (URL configurable via env)
- [ ] Componente `Faq` — accordion com perguntas do PRD
- [ ] Social proof final:
  - Se ≥ 2 testemunhos: secção com 3 cards
  - Se < 2: secção "Aviso de early adopter" com lista de 3 gabinetes piloto
- [ ] Tracking: `?utm_source=site&utm_medium=hero_cta` etc nos CTAs → `app.kamaia.ao/register`
- [ ] OG / Twitter meta tags por página via `generateMetadata`

### Acceptance Criteria Sprint 2
- [ ] Formulário envia email real para Helder (teste end-to-end)
- [ ] CTAs "Começar grátis" navegam para `app.kamaia.ao/register?plan=X&utm_*`
- [ ] Preços visíveis OU "Falar com vendas" — ambas funcionam (decisão de Helder)
- [ ] Testemunhos reais ou placeholder assumido — não mentir

### Tarefas paralelas
- [ ] Helder finaliza preços
- [ ] Helder revê política de privacidade (se necessário, contratar advogado especialista)

---

## Sprint 3 — Polimento + launch

**Objectivo:** produção. Domínio, SEO, performance, analytics.

### Tarefas técnicas
- [ ] `/sobre/page.tsx` — missão, fundador, stack, dados
- [ ] `/politica-privacidade/page.tsx` — LGPD + Lei 22/11 Angola
- [ ] `/termos/page.tsx` — termos de serviço
- [ ] SEO:
  - `sitemap.ts` dinâmico
  - `robots.ts`
  - Metadata global (title template, description, OG image 1200×630)
  - JSON-LD `Organization` + `SoftwareApplication`
- [ ] 404 page
- [ ] Analytics Plausible (self-hosted ou cloud)
- [ ] Performance audit:
  - Lighthouse Performance ≥ 95
  - `<Image>` optimizations (priority, sizes)
  - `next/font` para Inter
  - Tree-shake framer-motion (importar apenas o que se usa)
- [ ] Cross-browser testes:
  - Chrome / Firefox / Safari desktop
  - iOS Safari + Android Chrome
- [ ] Smoke tests Playwright (replicar padrão do `apps/web/e2e`):
  - Home renderiza
  - Formulário de contacto submete
  - CTAs têm hrefs correctos
- [ ] Configurar domínio final em Vercel (DNS, HTTPS, redirects)
- [ ] 301s: `www.kamaia.ao` → `kamaia.ao`, `kamaia.com` → `kamaia.ao`

### Acceptance Criteria Sprint 3
- [ ] `kamaia.ao` serve o site em HTTPS
- [ ] Lighthouse ≥ 95 em Performance, SEO, Accessibility, Best Practices
- [ ] Sitemap visível em `/sitemap.xml`
- [ ] Plausible a receber pageviews
- [ ] Formulário de contacto funciona em produção
- [ ] Smoke tests verdes em CI

### Launch
- [ ] Soft launch (24h) — enviar link a 10 contactos seleccionados, recolher feedback
- [ ] Fix fast-follow issues (tipografia, typos, bugs mobile)
- [ ] Hard launch:
  - Post LinkedIn (Helder)
  - Post Instagram + Facebook
  - Email announcement para lista de contactos
  - Anuncio aos advogados já clientes do gabinete

---

## Métricas de sucesso (pós-launch)

Reverificar mensalmente:

- **Tráfego:** 500 uniques / mês (Q1), 1500 (Q2)
- **Conversão:** 3% → trial, 1% → demo
- **SEO:** top 10 Google para "software advocacia angola", "gestão processos jurídicos angola"
- **Performance:** Lighthouse ≥ 95 em auditoria mensal

## Anexo A — Template email para validação de preços

```
Assunto: 5 minutos do seu tempo — validação de preço Kamaia

Caro Dr. X,

Estou a finalizar o lançamento do Kamaia, a plataforma de gestão
jurídica que testámos no vosso gabinete. Antes de anunciar
publicamente, gostaria da sua opinião honesta sobre os planos
de preço.

Posso enviar uma tabela e fazer 3 perguntas por email? São
5 minutos.

Obrigado,
Helder Maiato
```

## Anexo B — Estrutura de commits

```
docs(marketing): <mudança> — para qualquer edição do PRD / plano
feat(marketing): <mudança> — novas features na app
fix(marketing): <mudança> — bugs
chore(marketing): <mudança> — deps, configs
content(marketing): <mudança> — só conteúdo MDX (permite edição fast-track)
```

---

*Versão 1. Revisões em `docs/marketing/development-plan-vN.md`.*
