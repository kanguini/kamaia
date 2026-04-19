# PRD — Site de Promoção Kamaia

**Estado:** Draft v1
**Autor:** Helder Maiato + Claude
**Última revisão:** 2026-04-19
**Alvo de lançamento:** 4 semanas após aprovação

---

## 1. Contexto & problema

Kamaia é uma aplicação SaaS de **gestão jurídica inteligente** para advogados e gabinetes em Angola. O produto está em produção (Vercel + Railway) e tem já utilizador real (`heldermaiato@outlook.com`, gabinete "GMS Advogados"). A aplicação cobre processos, prazos, clientes, projectos, timesheets, despesas, facturas, agenda, documentos e assistente IA.

**O problema:** não existe presença web pública. Hoje o produto só é acessível por quem já tem conta. Para escalar precisamos de:

1. Um ponto de entrada público que **explique** o que é o Kamaia
2. Um canal de **aquisição** — conversão de visitantes em trials / contactos
3. Uma peça de **prova social e confiança** — o direito envolve dados sensíveis; os advogados precisam de razões para confiar
4. Uma **vitrina** do produto — hoje não há forma de ver o produto sem se inscrever
5. Um canal de **SEO** para termos como "software advocacia Angola", "gestão de processos jurídicos", "legal tech Luanda"

## 2. Objectivos

### Primário
Lançar em 4 semanas um site público em `kamaia.ao` (ou `kamaia.co.ao` / `.com`) que:

- Acolhe 500 visitas únicas/mês no primeiro trimestre
- Converte ≥ 3% em trial signups (~15 trials/mês)
- Converte ≥ 1% em pedidos de demo (5/mês)

### Secundário
- Estabelecer a identidade visual Kamaia 2.0 como marca no mercado angolano
- Material para redes sociais (LinkedIn, Instagram, Facebook) extraído do site
- Base SEO indexável para termos jurídico-tecnológicos em português de Angola

### Não-objectivo (fora de scope v1)
- Blog completo / CMS (ver Fase 2)
- Portal do cliente público (ver Fase 2)
- Documentação técnica / API docs (ver Fase 3)
- Internacionalização para outros países (PALOP vem em 2026 Q3)

## 3. Audiência-alvo

**ICP primário** — Advogado solo ou sócio de gabinete de 2–10 advogados em Angola.

- Idade 28–55, maioritariamente Luanda + Benguela + Huambo
- Pratica com processos físicos + Excel + WhatsApp para prazos
- Dor #1: perder prazos processuais ou duplicar trabalho
- Dor #2: facturar horas reais — muitas não são cobradas
- Dor #3: não ter visibilidade financeira do gabinete

**Compradores** (quem assina) — Sócio-gestor ou advogado solo. Decisão rápida para solo; 1–2 semanas para gabinetes.

**Utilizadores** (quem usa diariamente) — Todos os advogados + 1 secretário/a. O secretário gere prazos e documentos; os advogados registam horas e editam processos.

**Personas detalhadas** — ver `/docs/marketing/personas.md` (a criar em follow-up).

## 4. Mensagens-chave

**Headline principal:**
> Gestão jurídica inteligente. Pessoas, Processos e Tecnologia.

(Alinhado com o slogan já usado no login.)

**Sub-headline:**
> A plataforma feita para advogados angolanos. Processos, prazos, timesheets e facturação num só lugar. Com assistente IA que redige peças.

**Provas / diferenciadores:**
1. **Feito para Angola** — AKZ, feriados angolanos, dias úteis, OAA, WAT timezone
2. **Alertas de prazo automáticos** — email + SMS + push antes dos prazos processuais
3. **IA Assistente jurídica** — redacção de peças, resumos de processos, pesquisa jurisprudencial (Gemini-powered)
4. **Multi-tenant com RLS** — isolamento total de dados entre gabinetes; ninguém vê processos de outros gabinetes
5. **Conforme ARSEG/Direito Angolano** — dados em território compatível, audit log append-only
6. **Portal do cliente** — cliente acede aos seus processos sem ter de telefonar

**Call-to-actions:**
- **Primário:** "Começar grátis" → regista trial 14 dias
- **Secundário:** "Ver demo" → agenda demo com Helder
- **Tertiário:** "Entrar" → login para quem já tem conta

## 5. Estrutura do site (sitemap)

```
/                      Home (landing page)
/funcionalidades       Funcionalidades detalhadas
/precos                Planos & preços
/sobre                 Quem somos
/contacto              Formulário + WhatsApp
/politica-privacidade  LGPD + Lei 22/11 protecção de dados Angola
/termos                Termos de serviço

# Externos (já existem):
app.kamaia.ao/login    →  login da app real
app.kamaia.ao/register →  registo da app real
```

### 5.1 Home — hero + 5 secções

**Ordem de scroll:**

1. **Hero band** (above the fold)
   - Logo Kamaia no topo-esquerda
   - H1 headline
   - Sub-headline
   - CTA primário (Começar grátis) + secundário (Ver demo)
   - Visual: screenshot do dashboard real (dark mode, com dados demo realistas), flutuando num ligeiro ângulo 3D
   - Background: o mesmo degradê animado azul↔preto com ruído que usamos na página de auth (reusar componente)

2. **Problema → Solução** (3 cards)
   - "Perco prazos processuais" → "Alertas automáticos 7d / 3d / 1d antes"
   - "Não facturo todas as horas" → "Timer + timesheets integrados nas facturas"
   - "Cliente liga a pedir updates" → "Portal do cliente com visibilidade 24/7"

3. **Funcionalidades em destaque** (6 cards 2×3)
   - Processos com workflows customizáveis
   - Prazos com dias úteis angolanos
   - Clientes + Portal
   - Facturação AKZ
   - Timesheets + Despesas
   - IA Assistente

4. **"Feito para Angola"** (secção de diferenciação)
   - Bandeira estilizada + mapa
   - Lista: AKZ · Feriados públicos · Horário de Luanda · OAA · Dados em território · Audiente ARSEG-compliance
   - Screenshot de uma factura real emitida em AKZ

5. **Social proof / testemunhos**
   - 3 testemunhos de advogados (a obter — ver Fase pre-launch)
   - Logos de gabinetes-piloto

6. **Preços** (teaser com 3 planos, link para /precos)

7. **FAQ** (4–6 perguntas)
   - Os meus dados estão seguros?
   - Quanto custa?
   - Quanto tempo leva a aprender?
   - Posso importar dados do Excel?
   - Funciona offline?
   - Há versão móvel?

8. **CTA final + footer**

### 5.2 /funcionalidades — deep dive

Uma secção alternada esquerda-direita por módulo (texto dum lado, screenshot do outro):

1. **Dashboard executivo** — capacidade, facturação, calendário
2. **Processos** — workflows, fases, timeline, anexos
3. **Prazos** — dias úteis angolanos, alertas multi-canal
4. **Clientes + Portal** — CRM leve, acesso do cliente
5. **Facturação** — agregação de timesheets, PDF profissional
6. **Timesheets + Despesas** — timer, aprovação, relatórios
7. **Agenda** — sincronização com Google Calendar (roadmap)
8. **Documentos** — upload, versionamento, associação a processos
9. **IA Assistente** — peças, resumos, pesquisa

Cada secção: H2 + lede + 3–4 bullets + screenshot + link "Saber mais" (ancora na home).

### 5.3 /precos — tabela comparativa

Estrutura da tabela já existe no backend (`SubscriptionPlan` enum). Planos públicos:

| Plano | Preço | Utilizadores | Processos | Storage | IA queries |
|---|---|---|---|---|---|
| **Trial** | Gratis 14d | Até 3 | Ilimitado | 1 GB | 50 |
| **Solo** | ~15.000 AKZ/mês | 1 | 100 activos | 5 GB | 200 |
| **Gabinete** | ~45.000 AKZ/mês | Até 10 | Ilimitado | 50 GB | 1.000 |
| **Pro Business** | sob consulta | Ilimitado | Ilimitado | 500 GB | Ilimitado |

**Nota sobre preços:** os valores acima são placeholders; precisa validação comercial antes do launch. Ver item 10 (riscos).

CTAs:
- Trial / Solo: "Começar agora" → `app.kamaia.ao/register?plan=SOLO`
- Gabinete / Pro: "Falar com vendas" → `/contacto?plan=GABINETE`

### 5.4 /sobre — ~1 página

- Missão: "Tecnologia jurídica acessível para profissionais angolanos"
- Fundador: Helder Maiato (sócio-gestor GMS Advogados)
- Valores: transparência de dados, privacidade, conformidade local
- Stack / onde estão alojados os dados (importante para confiança)

### 5.5 /contacto — formulário + canais directos

- Formulário: nome, email, telefone, gabinete, mensagem
- WhatsApp directo (ícone + número)
- Email público (`hello@kamaia.ao` ou similar)
- Morada do gabinete (Luanda)
- Botão "Agendar demo" → Calendly ou form customizado

## 6. Design direction

### 6.1 Identidade visual
Reutilizar o token set **Kamaia 2.0** já construído (`--k2-*`):

- **Cores:**
  - Dark default: bg `#000`, text `#fff`, accent `#4A7DFF`
  - Light secundário: bg `#fff`, text `#000`, accent `#2952D9`
- **Tipografia:** Inter (já em uso) + JetBrains Mono para números
- **Logo:** o wordmark SVG já existente em `apps/web/src/components/ui/logo.tsx`
- **Elementos gráficos:**
  - Degradê animado azul↔preto com ruído (SVG turbulence) — já implementado
  - Dots de status (semáforos good/warn/bad)
  - Ícones Lucide

### 6.2 Tom visual
- **Minimalista** — muito whitespace, poucos cards, tipografia como protagonista
- **Sério com um acento de confiança** — não é um SaaS "fun"; é infraestrutura para profissionais
- **Dark-first** — a maioria do site em dark; light como alternativa no toggle
- **Micro-animações discretas** — scroll reveals, hover arrows (como já temos nas listas), nada de parallax agressivo

### 6.3 Content tone
- Português de Portugal / Angola (**ç** e não "facturar" em vez de "faturar")
- Segunda pessoa do singular ("tu") — já é o padrão da app
- Jargão jurídico quando necessário (prazos, peças, processos) — o público é técnico
- Zero inglês gratuito (evitar "workflow", "dashboard" em headers — usar "fluxo", "painel")

## 7. Stack técnico

### 7.1 Decisão: nova app Next.js separada OU rota pública na app actual?

**Recomendação: nova app separada** `apps/marketing/` dentro do mesmo monorepo.

**Porquê:**
- Separação de concerns: marketing é SEO-first, tem pre-render estático, não precisa de autenticação. A app real é SPA autenticada.
- Tamanho do bundle: o site de marketing não quer arrastar `next-auth`, `prisma client`, etc.
- Deploy independente: marketing pode ser editado sem afectar a app em produção.
- SEO: usa `generateMetadata`, Open Graph, sitemap.xml, robots.txt — tudo próprio do site público.
- Domínio: `kamaia.ao` aponta para marketing; `app.kamaia.ao` aponta para a Vercel app actual.

**Stack:**
- **Next.js 14 App Router** (igual à app)
- **TypeScript strict**
- **Tailwind** + custom CSS variables Kamaia 2.0
- **framer-motion** para scroll reveals (leve)
- **Vercel** — deploy automático, subdomínio separado
- **Resend** — formulário de contacto → email para Helder
- **Plausible ou Umami** — analytics (GDPR/LGPD-friendly, sem cookies)

### 7.2 Conteúdo
Todo o texto em **MDX files** dentro de `apps/marketing/src/content/` para permitir edição sem deploy manual. Estrutura:

```
apps/marketing/src/content/
  home.mdx
  funcionalidades/
    dashboard.mdx
    processos.mdx
    prazos.mdx
    ...
  faq.mdx
  testimonials.json
```

### 7.3 Imagens & screenshots
- Screenshots reais da app (dark mode) — capturados com Playwright headless contra demo account
- Guardar em `apps/marketing/public/screens/` com versões 1x + 2x (retina)
- Alternativa: Figma export para os mockups mais polidos (hero)

## 8. Plano de execução

### Sprint 0 — Fundação (semana 1)
- [ ] Comprar domínio `kamaia.ao` (e `.com` como backup)
- [ ] Decidir e validar preços dos planos com advogados de referência (3 conversas)
- [ ] Extrair 8–10 screenshots reais da app (Playwright script)
- [ ] Bootstrap `apps/marketing/` com Next.js + Tailwind + tokens Kamaia 2.0
- [ ] Configurar Vercel project separado + subdomínio

### Sprint 1 — Home + Funcionalidades (semana 2)
- [ ] Hero + animated gradient (reusar componente auth)
- [ ] Secção Problema→Solução
- [ ] 6 feature cards
- [ ] Secção "Feito para Angola"
- [ ] Deep dive /funcionalidades

### Sprint 2 — Conversão (semana 3)
- [ ] /precos com tabela comparativa
- [ ] /contacto com formulário → Resend email para Helder
- [ ] FAQ
- [ ] Social proof (3 testemunhos a serem obtidos em paralelo)
- [ ] CTAs para `app.kamaia.ao/register?plan=X`

### Sprint 3 — Polimento + launch (semana 4)
- [ ] /sobre + /política-privacidade + /termos
- [ ] SEO: metadata, Open Graph, sitemap, robots.txt
- [ ] Analytics (Plausible)
- [ ] 404 page
- [ ] Lighthouse audit (target: ≥ 95 em todas as categorias)
- [ ] Testes em Safari + Chrome + Firefox + mobile real
- [ ] Soft launch para 10 contactos
- [ ] Launch oficial em LinkedIn + Instagram

## 9. Métricas de sucesso

**Vaidade (tracking desde dia 1):**
- Visitas únicas/mês
- Bounce rate
- Tempo médio na página
- Páginas por sessão

**Negócio (dashboard Plausible + tracking manual):**
- Trials iniciados (`/register?utm_source=site`)
- Demos agendadas (formulário ou Calendly)
- Taxa de conversão visitante → trial (target: 3%)
- Taxa trial → pago (target: 25%; já é responsabilidade da app, não do site)

**Qualidade (Lighthouse, mensal):**
- Performance ≥ 95
- SEO ≥ 95
- Accessibility ≥ 95
- Best Practices ≥ 95

## 10. Riscos & mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Preços ainda não validados | Alto — conversão quebra com preço errado | Conversar com 3 advogados reais antes de publicar; se incerto, esconder preços e forçar "contacto" na v1 |
| Falta testemunhos reais | Médio — social proof fraca | Usar só 1–2 testemunhos reais; reduzir a secção; substituir por "aviso de early adopter" |
| Screenshots da app desactualizadas em 1 mês | Baixo | Script Playwright corre mensalmente e actualiza |
| Dados sensíveis na política de privacidade | Alto legal | Contratar advogado especialista (ironia não intencional) em protecção de dados para rever texto |
| Aplicativo crasha durante demo | Alto — confiança perdida | Pre-flight checks antes de cada link "ver demo" apontando para o dashboard; plano B: gravação de screen |
| Domínio `.ao` demora 2+ semanas | Alto | Lançar primeiro em `.com` ou `.co.ao` subdominado e migrar depois |
| SEO em português de Angola | Médio | Palavras-chave específicas: "advogado Luanda software", "gestão processos jurídicos Angola", "OAA sistema" |

## 11. Open questions

1. **Nome de domínio final** — `.ao`, `.co.ao`, `.com`? Helder decide.
2. **Logo adicional precisa?** — só o wordmark, ou precisamos favicon detalhado + variações para redes sociais?
3. **Política de preços** — mostrar? esconder? tabela vs. "a partir de"?
4. **Vídeo demo** — valha um teaser de 60s no hero? Complexidade vs. impacto.
5. **Blog v2** — MDX mantém-se ou migramos para Notion/Sanity quando escalar?
6. **Formulário de contacto** — ficam emails em inbox do Helder ou integração com CRM (HubSpot Free)?
7. **WhatsApp Business** — botão "WhatsApp" no /contacto precisa número oficial diferente do pessoal?
8. **Internacionalização futura** — devemos desenhar o site já i18n-ready para PALOP (Moçambique, Cabo Verde) em Q3 2026?

## 12. Ficheiros & convenções

```
apps/marketing/
  package.json            (standalone)
  next.config.js
  tailwind.config.ts
  src/
    app/
      layout.tsx          (dark + wordmark + nav)
      page.tsx            (home)
      funcionalidades/
        page.tsx
      precos/page.tsx
      sobre/page.tsx
      contacto/
        page.tsx
        action.ts         (server action → Resend)
      politica-privacidade/page.tsx
      termos/page.tsx
    components/
      AnimatedGradient.tsx (reusar da auth)
      Logo.tsx             (importar de packages/shared-ui?)
      Hero.tsx
      FeatureCard.tsx
      PricingTable.tsx
      Faq.tsx
      Footer.tsx
      Nav.tsx
    content/
      home.mdx
      faq.mdx
      testimonials.json
    styles/globals.css    (importar tokens Kamaia 2.0)
  public/
    screens/
      dashboard-dark.png
      processos-dark.png
      ...
    og/
      default.png         (1200×630 OG image)
```

## 13. Decisões já tomadas

- ✅ Usar identidade Kamaia 2.0 existente (tokens, logo, slogan)
- ✅ Tratamento por "tu" + português de Angola
- ✅ App separada no monorepo (`apps/marketing/`)
- ✅ Dark-first com toggle light
- ✅ Next.js 14 App Router

## 14. Próximos passos (acção)

1. **Helder** aprova / rejeita este PRD (comentários em-linha)
2. **Helder** decide domínio + política de preços
3. **Helder** obtém 2–3 testemunhos de advogados piloto
4. **Claude + Helder** Sprint 0 — bootstrap da app em paralelo com as decisões acima

---

*Fim do PRD v1. Versões revistas ficam em `docs/marketing/site-prd-vN.md`.*
