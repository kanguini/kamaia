# Kamaia → CLM — Relatório do pivot

**Período:** Junho 2026 (uma sessão de trabalho autónomo)
**Branch legacy preservada:** `archive/pre-clm`
**Branch viva:** `main`

## Sumário executivo

O Kamaia deixou de ser "plataforma de gestão de prática jurídica" e passou a ser **Contract Lifecycle Management (CLM) horizontal multi-sector** com **compliance angolano embebido** e **IA Q&A sobre legislação angolana**.

A fundação completa do produto está em código e commitada — 14 commits, 22 módulos backend, 19 páginas frontend, schema Prisma completo, motor de compliance com 14 regras seed em 5 categorias, marketing site reposicionado, README e memória actualizados.

## Estatísticas

| Métrica | Valor |
|---|---|
| Commits desde o pivot | 14 |
| Ficheiros alterados (vs. último commit pré-pivot) | 307 |
| Linhas inseridas | 11.876 |
| Linhas removidas | 49.275 |
| Módulos backend | 22 |
| Modelos Prisma vivos | 22 |
| Páginas web (dashboard + auth) | 19 |
| Regras de compliance seed | 14 (IS · BNA · Registos · AGT · Notário) |
| Tipos de contrato seed | 25 |
| Verbas TGIS seed | 11 (indicativas — `TBD-*`) |
| Diplomas legislativos catalogados | 13 |

## Resultado por camada

### Backend — `apps/api/`

✅ **Pronto e commitado**

- **Identidade + multi-tenancy:** `auth`, `users`, `tenants` (hierarquia AGENCY → sub-tenants), `memberships` (M:M com Role)
- **Domínio CLM:** `entidades` (contrapartes), `carteiras` (grouping opcional), `tipos-contrato` (catálogo global + custom), `templates`, `clausulas` (biblioteca)
- **Contratos:** módulo central com state machine de 17 estados + sub-recursos `versoes`, `partes`, `datas-chave`, `eventos` (timeline append-only), `negociacao` (pontos abertos), `terminacao`
- **Compliance Engine:** motor declarativo com regras versionadas em `apps/api/src/modules/compliance/engine/regras/`:
  - 5 regras de Imposto de Selo (TGIS)
  - 3 regras BNA / Lei Cambial / RJOC
  - 4 regras de Registos (Predial, Comercial, Automóvel, IAPI)
  - 1 regra AGT IRT
  - 2 regras de reconhecimento notarial
  - **Princípio:** sugere, nunca executa. Disclaimer obrigatório. Regra vigente à data do facto.
- **Infra CLM:** `importacao` (lote-based), `documents` (Local/R2), `ia` (Claude stub), `rag` (legislação)
- **Cross-cutting:** `audit`, `notifications`, `holidays`, `backup`, `seed`, `health`

### Schema Prisma — `apps/api/prisma/schema.prisma`

✅ **1.221 linhas, 22 modelos**

Inclui: `Tenant` (com hierarquia), `User`, `Membership`, `Entidade`, `Carteira`, `TipoContrato`, `TGISVerba`, `Template`, `Clausula`, `Contrato`, `ContratoVersao`, `ContratoParte`, `ContratoDataChave`, `ContratoObrigacao`, `ContratoObrigacaoInstancia`, `ContratoActoRegulatorio`, `ContratoNegociacaoPonto`, `ContratoEvento`, `ContratoTerminacao`, `ImportacaoLote`, `ImportacaoLinha`, `Document`, `AuditLog`, `AIConversation`, `AIMessage`, `LegislationDocument`, `LegislationChunk`, `Subscription`, `UsageQuota`, `Notification`, `PushSubscription`, `ApiKey`, `Webhook`, `WebhookDelivery`, `UserSession`, `EntidadeContacto`, `EntidadeDocumentoKYC`.

Notas técnicas:
- `tsvector` com config `portuguese` + GIN para FTS em `Entidade`, `Clausula`, `Contrato`
- `pgvector` para `LegislationChunk.embedding`
- Soft delete via `deletedAt` em entidades de negócio
- Hierarquia AGENCY via `Tenant.parentTenantId`
- Adendas via `Contrato.parentContratoId`

### Shared Types — `packages/shared-types/`

✅ **713 linhas**

Todos os enums + labels + state machine (`CONTRATO_TRANSITIONS`, `canTransition()`) + `Result<T>` + `JwtPayload` + `TenantContext` + `ComplianceContext`/`ComplianceActoDetectado` + `PLAN_LIMITS` + helpers de moeda/sector + feriados.

### Frontend — `apps/web/`

✅ **Reescrito, 19 páginas + workspace switcher**

Páginas no `(dashboard)`:
- `/` — KPI dashboard a partir de `/contratos/dashboard`
- `/contratos` (lista com filtros + cursor pagination) · `/contratos/novo` · `/contratos/[id]` (8 tabs)
- `/entidades` · `/entidades/[id]`
- `/carteiras`
- `/compliance` (actos pendentes agrupados por tipo)
- `/importacao`
- `/ia` (chat stub-aware)
- `/biblioteca/templates` · `/biblioteca/clausulas`
- `/configuracoes/organizacao` · `/configuracoes/equipa` · `/configuracoes/sub-tenants` (só visível em AGENCY)

Páginas no `(auth)`:
- `/login` · `/register` (onboarding cria Tenant + Membership ADMIN) · `/forgot-password` · `/reset-password`

Infra:
- Workspace switcher no topbar (lê de `GET /tenants`, persiste em `localStorage['kamaia.activeTenantId']`)
- API client envia `X-Tenant-Id` automaticamente; `noTenant: true` para `/auth/*`
- NextAuth refactorizado — sem `gabineteId`/`role` na session

### Marketing site — `apps/marketing/`

✅ **Reposicionado**

- `/` — Hero "O sistema operativo dos teus contratos" + Positioning + 4 pilares + 6 features + Compliance Callout + FAQ + CTA
- `/funcionalidades` — 12 capacidades destacadas
- `/precos` — 4 planos (Starter/Growth/Scale/Enterprise) + secção Agency dedicada
- `/sobre` — porquê construir em Angola + 4 pilares de arquitectura defensável

Componentes (`Nav`, `Footer`, `Hero`, `Reveal`, `AnimatedGradient`) mantidos — só o copy mudou.

### Documentação

✅ **README + CLAUDE.md + memória reescritos** para reflectir a nova identidade CLM.

## Decisões tomadas autonomamente

Durante a execução, com base nas respostas do utilizador às 4 decisões-chave:

1. **Sem dados em produção → drop limpo do schema.** Sem migration suave, sem preservação de IDs. Tudo na branch `archive/pre-clm`.
2. **GTM paralelo (empresas + gabinetes) → hierarquia de tenants é fundamental.** Implementada de raiz.
3. **Compliance angolano no MVP → engine declarativo central.** Não plugin, não opcional.
4. **Multi-sector horizontal → catálogo seed de 25 tipos largo.** Sem packs sectoriais inicialmente.

Decisões secundárias tomadas durante a execução:
- **Naming:** mantido "Kamaia" com tagline "Gestão de Contratos para Angola"
- **Workspace switching:** estilo Linear (dropdown no topbar, page reload no switch)
- **Edição de contratos:** upload-only no MVP, Word add-in adiado para v2
- **IA:** stub neste momento — endpoints prontos, prompt + Claude API a ser ligados quando `ANTHROPIC_API_KEY` for configurado
- **OCR:** stub no `importacao` — interface preparada, integração Tesseract/Mindee adiada
- **Worker queue:** sem BullMQ ainda — código preparado para o plugin, mas processamento síncrono no MVP

## Pendentes conhecidos (sharp edges)

### Crítico antes de produção

1. **Validar valores TGIS com curador jurídico.** Todas as verbas seed estão marcadas `TBD-*`. Sem validação, o produto pode sugerir IS errado.
2. **Confirmar limiares BNA** com aviso vigente. O código usa USD 50k (autorização) e USD 10k (registo) como placeholders.
3. **`prisma generate` precisa de correr** após o pull para que os novos modelos fiquem reflectidos no client TypeScript.
4. **Ingerir textos da legislação no RAG.** O catálogo só tem metadados (13 diplomas) — o RAG vetorial precisa dos textos chunked.

### Antes do beta com utilizadores

5. **Ligar Claude API** — substituir o stub de IA por chamadas reais com o seed legislativo como contexto.
6. **Wire BullMQ + Redis** — OCR e extracção IA precisam de assíncrono real para volume.
7. **Wire envio de notificações** — Resend (email) + Twilio (SMS) + VAPID (push). Service já escreve à `Notification` table com `status=PENDING`.
8. **Verificar API ↔ frontend contracts.** O agent frontend assumiu paths como `/compliance/actos/:id/concluir` e `/contratos/:id/compliance` — confirmar exatamente contra o backend (eu implementei `/compliance/actos/:actoId/concluir` — paths batem).
9. **Multer + upload multipart real** — `documents` aceita base64 actualmente; trocar por `FileInterceptor` quando Multer for instalado.
10. **Testes:** zero testes escritos neste pivot. Antes de produção, suite mínima para state machine + compliance engine + tenant isolation.

### Quality of life

11. **Tenant switching faz `window.location.reload()`** — visível blink. Trocar por invalidação de cache fina-grão depois.
12. **Endpoint paths podem divergir** — agent assumiu alguns paths sem ler o controller exacto. Run end-to-end happy path em dev para detectar 404s.
13. **`use-api.ts`** tem um warning pré-existente de `next lint` que não foi tocado.

## Como arrancar

```bash
cd /Users/macbook/Music/kamaia

# Instalar (se necessário re-instalar com novos packages)
npm install

# Regenerar Prisma client com novo schema
cd apps/api
npx prisma db push   # ou migrate dev em ambiente clean
npx prisma generate
npx ts-node prisma/seed.ts
cd ../..

# Arrancar tudo
npm run dev
```

Login em http://localhost:3000 com `admin@kamaia.dev / Kamaia2026!`.

## Próximos passos sugeridos (na ordem que recomendo)

1. **Validar happy path** — registar → criar contrato → adicionar parte → transitar para ASSINADO → ver actos sugeridos pelo Compliance Engine
2. **Curadoria jurídica das regras TGIS/BNA** com um advogado angolano
3. **Ingestão de legislação** — pipeline para chunked + embeddings (OpenAI ou Voyage)
4. **Claude API integration** com contexto RAG
5. **3-5 entrevistas com early adopters** (1 empresa imobiliária + 1 industrial + 1 sociedade de advogados consultiva) para validar fluxo de importação
6. **BullMQ + worker para OCR** quando houver tráfego real
7. **Suite de testes mínima** focada em isolamento multi-tenant + state machine + engine

## Arquivo

A versão pré-pivot do código vive em `archive/pre-clm` (criada antes do primeiro commit do pivot). Pode ser inspeccionada sem afectar `main`:

```bash
git checkout archive/pre-clm
```

---

**Conclusão:** A fundação está completa e coerente. A história está commitada em incrementos legíveis (14 commits). Falta o trabalho de curadoria jurídica, integração de serviços externos pagos (Claude, OCR), testes e validação com utilizadores reais. Nenhum desses pode ser feito autonomamente sem decisões tuas ou contas externas.
