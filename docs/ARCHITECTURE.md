# Kamaia CLM — Arquitectura

> Documento técnico de referência. Para a visão de produto, ver `README.md`.

## 1. Visão sistémica

```
┌──────────────────────────────────────────────────────────────┐
│  Web (Next.js 14)              Marketing (Next.js)           │
│  apps/web                      apps/marketing                │
│  - App Router                  - kamaia.cc (estático)        │
│  - NextAuth.js                 - SEO + Open Graph            │
│  - Tailwind                    - Reescrito p/ CLM            │
└──────────┬───────────────────────────────────────────────────┘
           │ HTTPS (REST JSON)
           │ Authorization: Bearer <jwt>
           │ X-Tenant-Id: <uuid>
┌──────────▼───────────────────────────────────────────────────┐
│  API (NestJS 10)                                             │
│  apps/api                                                    │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │ Auth         │  │ Domínio CLM    │  │ Compliance      │  │
│  │ - JWT        │  │ - Contratos    │  │ - Engine        │  │
│  │ - Lockout    │  │ - Entidades    │  │ - 20+ regras    │  │
│  │ - Membership │  │ - Carteiras    │  │ - Versionadas   │  │
│  └──────────────┘  └────────────────┘  └─────────────────┘  │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │ IA + RAG     │  │ Webhooks       │  │ Notifications   │  │
│  │ - Claude API │  │ - HMAC SHA-256 │  │ - Alerts cron   │  │
│  │ - Citações   │  │ - Backoff exp. │  │ - Multi-canal   │  │
│  └──────────────┘  └────────────────┘  └─────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Cross-cutting: Audit │ TenantGuard │ Rate-limit │ Sentry│
│  └──────────────────────────────────────────────────────┘   │
└──────────┬───────────────────────────────────────────────────┘
           │
┌──────────▼───────────┐  ┌──────────────┐  ┌────────────────┐
│  PostgreSQL 16       │  │  R2 / S3     │  │  Anthropic API │
│  + pgvector          │  │  Documents   │  │  Claude        │
│  + tsvector (PT FTS) │  │  (storage)   │  │  (opcional)    │
└──────────────────────┘  └──────────────┘  └────────────────┘
```

### Stack

| Camada | Tecnologia | Justificação |
|---|---|---|
| Backend | NestJS 10 + Prisma 5 | DI maduro, módulos isolados, tipos end-to-end |
| Frontend | Next.js 14 App Router | RSC + actions, NextAuth integration |
| DB | PostgreSQL 16 | JSONB, tsvector, pgvector — sem precisar de stack adicional |
| Storage | R2 (S3-compat) | Egress 0, sem vendor lock-in |
| IA | Claude API via fetch | Sem deps; falls back to stub sem chave |
| Cron / Worker | `@nestjs/schedule` | Sem Redis até precisarmos |
| Observabilidade | Sentry | Já integrado, noop sem DSN |
| Monorepo | npm workspaces + Turborepo | Convenções padrão |

## 2. Multi-tenancy hierárquico

```
Tenant (plan=AGENCY: "Sociedade de Advogados X")
   ├── Tenant (plan=GROWTH: "Cliente A")     ← totalmente isolado
   ├── Tenant (plan=STARTER: "Cliente B")    ← totalmente isolado
   └── Tenant (plan=GROWTH: "Cliente C")     ← totalmente isolado

User ⇄ Tenant: relação M:M via Membership(role)
```

### Garantias de isolamento

Validadas pelos **9 testes em `test/tenant-isolation.e2e-spec.ts`**:

| Cenário | Esperado |
|---|---|
| user(A) ⟶ contrato de tenant B | 404 |
| user(A) ⟶ assume tenant B via header forjado | 403 |
| Sem `X-Tenant-Id` em endpoint scoped | 403 |
| POST cross-tenant | 403 |
| Sem JWT | 401 |
| user(AGENCY) ⟶ sub-tenant via parent | 200 (herda) |
| user(AGENCY) ⟶ outro tenant não-ligado | 403 |

### Implementação

```
┌────────────────────┐
│ JwtAuthGuard       │  Valida token, popula request.user
└─────────┬──────────┘
          │
┌─────────▼──────────┐
│ TenantGuard        │  Lê X-Tenant-Id, valida Membership
│                    │  (directa ou via parent AGENCY),
│                    │  popula request.tenant = {tenantId, role, plan}
└─────────┬──────────┘
          │
┌─────────▼──────────┐
│ RolesGuard         │  Confirma role suficiente
└─────────┬──────────┘
          │
┌─────────▼──────────┐
│ Controller @Tenant │  Recebe TenantContext em handler
└────────────────────┘
```

Todos os services aceitam `tenantId` como primeiro argumento e usam-no em `where` de todas as queries — não há "ambient tenant".

## 3. Estados do contrato (state machine)

```
                  ┌──────────────────────────────────────────────────┐
                  │                                                  │
INTAKE → DRAFTING → REV_INTERNA → REV_CLIENTE → EM_NEGOCIACAO ⇌      │
   │                                              │                  │
   │                                              ▼                  │
   │                              APROVACAO → PRONTO_ASSINATURA      │
   │                                              │                  │
   │                                              ▼                  │
   │                                          ASSINADO ◄── (compliance dispara aqui)
   │                                              │                  │
   │                                              ▼                  │
   │                                       POS_ASSINATURA            │
   │                                              │                  │
   │                                              ▼                  │
   │                                          ACTIVO ────────────────┤
   │                                          │ │ │                  │
   │                                          │ │ └─► EM_ADENDA ────►┤
   │                                          │ └────► EM_DISPUTA ──►│
   │                                          ▼                      │
   │                                   EM_TERMINACAO                 │
   │                                          │                      │
   │                                          ▼                      │
   ▼                                       TERMINADO ──► ARQUIVADO   │
REPOSITORIO ──► ACTIVO ────────────────────────────────────────────► │
   │                                                                 │
   ▼                                                                 │
CANCELADO (absorvedor de qualquer estado pré-ASSINADO) ◄─────────────┘
```

Tabela completa em `shared-types/CONTRATO_TRANSITIONS` + `canTransition()`. **28 testes em `state-machine.spec.ts`** validam cada arco e cada transição ilegal típica.

### Modos de engajamento

A state machine suporta os 4 modos sem ramificações no código:

| Modo | Caminho |
|---|---|
| A — Drafting full | INTAKE → DRAFTING → REV_INTERNA → ... → ASSINADO |
| B — Review contraparte | INTAKE → EM_NEGOCIACAO → APROVACAO → ASSINADO |
| C — Repositório | INTAKE → REPOSITORIO → ACTIVO (import em massa) |
| D — Adenda | (sub-ciclo derivado, parentContratoId no Contrato filho) |

## 4. Compliance Engine

```
┌─────────────────────────────────────────────────────────────┐
│  ContratosService.transitar(→ ASSINADO)                     │
│  ContratosService.update(camposRelevantes)                  │
│      │                                                      │
│      ▼                                                      │
│  ComplianceService.avaliarContrato()                        │
│      │                                                      │
│      ▼                                                      │
│  buildContext(contrato) → ComplianceContext                 │
│      │  { tipoCodigo, categoria, valor, moeda,              │
│      │    partesResidentes[], hasObjectoImovel, ... }       │
│      ▼                                                      │
│  ComplianceEngine.evaluate(ctx, referenceDate)              │
│      │                                                      │
│      │  Para cada regra:                                    │
│      │    1. estaVigente(regra, refDate)?                   │
│      │    2. regra.aplicaSe(ctx)?                           │
│      │    3. regra.build(ctx) → ComplianceActoDetectado     │
│      ▼                                                      │
│  Diff vs actos já existentes (não duplicar) → novos[]       │
│      │                                                      │
│      ▼                                                      │
│  Persiste ContratoActoRegulatorio (estado=PENDENTE)         │
│  + ContratoEvento (ACTO_DETECTADO)                          │
│  + WebhookEvent (acto_regulatorio.detectado)                │
└─────────────────────────────────────────────────────────────┘
```

### Princípios

1. **Sugere, nunca executa.** Cada acto entra como `PENDENTE` e exige confirmação humana via `PATCH /compliance/actos/:id/concluir`.
2. **Regra vigente à data do facto tributário** — não a data presente. Permite que actos antigos preservem o regime aplicável à altura.
3. **Idempotente.** Re-avaliação não duplica. `regraId + contratoId` é a chave de unicidade lógica.
4. **Versionada.** `regraVersao` ('2026.1') guardada com o acto — auditoria preserva contexto temporal.
5. **Declarativa.** Cada regra é um objecto literal com `aplicaSe(ctx): boolean` + `build(ctx): partial`. Sem condicionais espalhadas por services.

### Cobertura actual

20+ regras em 5 categorias — ver `docs/API.md` ou `compliance.engine.spec.ts` (36 testes).

## 5. Audit log + Timeline imutável

Dois conceitos relacionados mas distintos:

### `AuditLog` (cross-tenant, compliance interno)

- Cada escrita relevante: `action`, `actorUserId`, `entityType`, `entityId`, `beforeData`, `afterData`, `ip`, `userAgent`.
- Append-only. Indexed por `(tenantId, createdAt)` e `(entityType, entityId)`.
- Consultado para auditoria + defesa legal.
- Modo AGENCY: log cross-tenant é a defesa do gabinete contra os seus próprios clientes.

### `ContratoEvento` (por contrato, timeline UX)

- Append-only por contrato.
- Tipos controlados (`CRIADO`, `ESTADO_ALTERADO`, `VERSAO_CRIADA`, `PARTE_ADICIONADA`, `ACTO_DETECTADO`, `ALERTA_DISPARADO`, `TERMINADO`, etc).
- `actorTipo`: `USER` | `SYSTEM` | `COMPLIANCE_ENGINE` | `IA`.
- Renderizado como timeline no detalhe do contrato.

## 6. Webhooks

```
Producer                          Worker (cron @30s)              Subscriber
─────────                         ─────────────────                ──────────
ContratosService                                                  https://...
  ↓
WebhooksService                   ┌────────────────────┐
  .enqueueEvent(                  │                    │
    tenantId,                     │  WebhookDelivery   │
    'contrato.criado',            │  - status          │
    payload                       │  - tentativas      │
  )                               │  - proximaTenta-   │
  ↓                               │    tiva            │
WebhookDelivery row               │                    │
  status=PENDING                  └────────┬───────────┘
                                           │
                                           ▼
                                  Cron tick (30s):
                                  - findMany(PENDING/RETRYING, proxima <= now)
                                  - take 25
                                  - for each:
                                    HMAC SHA-256(secret, body) ───────► POST
                                    fetch(url, 8s timeout)               X-Kamaia-*
                                                                          ↓
                                                                       200 OK?
                                                                       └─► SUCCESS
                                                                       └─► RETRYING
                                                                           backoff:
                                                                           1m→5m→15m→
                                                                           1h→6h→24h
                                                                           (6 tentativas)
                                                                           └─► FAILED
```

7 testes unitários (`webhook-delivery.spec.ts`) validam HMAC, headers, backoff exponencial, esgotamento, webhook desactivado, erros de rede.

## 7. Alerts scheduler (cron diário)

```
Cron @ 08:00 WAT
   │
   ▼
AlertsScheduler.tick()
   │
   ├─► scanDatasChave()                  scanActosRegulatorios()
   │     │                                 │
   │     ▼                                 ▼
   │   findMany(cumprida=false,         findMany(estado in PENDENTE/EM_CURSO,
   │            data in next 365d)               prazoLimite in next 30d)
   │     │                                 │
   │     ▼                                 ▼
   │   for each:                        for each:
   │     diasAteData                      diasAtePrazo
   │     check alertaDias[]               bucket = CRITICO|PROXIMO|ATRASADO
   │     idempotência via                 idempotência via
   │     ContratoEvento payload           ContratoEvento payload
   │     │                                 │
   │     ▼                                 ▼
   │   emitirAlertaDataChave()          emitirAlertaActo()
   │     - Notification IN_APP+EMAIL      - Notification IN_APP
   │     - Webhook (expira_em_X_dias,     - Webhook (acto_regulatorio.detectado)
   │       janela_denuncia_proxima,       - ContratoEvento ALERTA_DISPARADO
   │       renovacao_automatica_proxima)
   │     - ContratoEvento ALERTA_DISPARADO
   ▼
```

11 testes unitários (`alerts-scheduler.spec.ts`) validam mapping, buckets, idempotência, destinatários (dedup), eventos.

## 8. IA — Q&A legislação angolana

```
POST /ia/conversations/:id/messages
   │
   ▼
IaService.sendMessage()
   │
   ├─► historico = últimas 10 trocas
   │
   ├─► RagService.search(query, topK=6) ──► chunks legislação
   │
   ├─► ClaudeProvider.complete(
   │     historico,
   │     contextoRAG = top-6 chunks formatados
   │   )
   │     │
   │     ├─► Se ANTHROPIC_API_KEY ausente: retorna null
   │     │   └─► IaService cai para stub com disclaimer
   │     │
   │     └─► fetch(api.anthropic.com/v1/messages):
   │         - model: claude-sonnet-4-5
   │         - system: PT-AO + contexto RAG injectado
   │         - messages: historico
   │
   ▼
Persiste AIMessage com:
  - conteudo (texto + disclaimer final obrigatório)
  - modelo
  - tokensInput/Output
  - citacoes (JSON com chunks usados)
```

Disclaimer obrigatório no final de cada resposta: *"⚠ Esta resposta não substitui aconselhamento jurídico profissional."*

## 9. Importação em lote (Modo C)

```
POST /importacao/lotes               ┌─────────────────────┐
   │                                  │ ImportacaoLote      │
   ▼                                  │   estado=EM_FILA    │
ImportacaoLote criado                 └─────────────────────┘
   │
POST /importacao/lotes/:id/linhas
   │  (upload PDFs em batch)
   ▼                                  ┌─────────────────────┐
ImportacaoLinha[] (1 por ficheiro)    │ ImportacaoLinha     │
   estado=PENDENTE                    │   estado=PENDENTE   │
   │                                  └──────────┬──────────┘
POST /importacao/lotes/:id/start                 │
   │                                              ▼
   ▼                                  Pipeline assíncrona:
ImportacaoService.processar()         1. OCR (stub → text-extractable)
   │                                  2. IA extraction (stub)
   ▼                                  3. Match Entidade existente
Estados Linha:                        4. Cria Contrato + Partes
  OCR_EM_CURSO → OCR_CONCLUIDO        5. Dispara ComplianceEngine
  → EXTRACAO_EM_CURSO                 6. linha.contratoId = novo
  → EXTRACAO_CONCLUIDA                7. linha.estado = CRIADO
  → REVISAO_HUMANA (opt-in)
  → CRIADO
```

## 10. Performance e escala

Alvo declarado em `CLAUDE.md`: **50.000 contratos/tenant**, p95 < 300ms.

Validado com **1000 contratos** em `test/performance.e2e-spec.ts`:

| Operação | Real | Limite |
|---|---|---|
| Dashboard (5 agregações) | 341ms | 1500ms |
| List 50 cursor | 240ms | 1000ms |
| Search FTS-like | 108ms | 1500ms |
| Filter por data | 50ms | 1200ms |
| Full scan 20 páginas | 54ms/página | — |

### Decisões de performance

- **Cursor pagination com tuple `[campo, id]`** — sem o tiebreaker, batch inserts com mesmo `createdAt` perdiam rows. Bug apanhado pelo teste de perf, fixado em `ContratosService.list()`.
- **Índices compostos** em `(tenantId, estado)`, `(tenantId, dataTermo)`, `(tenantId, tipoId)`, `(tenantId, responsavelId)`, `(tenantId, carteiraId)`.
- **tsvector GIN** em `Entidade.searchVector`, `Clausula.searchVector`, `Contrato.searchVector` — fallback para LIKE até populado.
- **Soft delete via `deletedAt`** — todas as queries de read filtram `deletedAt: null`.
- **`take: limit + 1`** trick para detectar `hasMore` sem `COUNT(*)`.
- **`groupBy` para dashboards** em vez de N queries.

### Onde escalar quando crescer

- **Read replica** para queries pesadas (dashboard, search) — endpoint separado.
- **BullMQ + Redis** para OCR, IA extraction em massa, webhook delivery (substitui cron @30s).
- **Particionamento** de `ContratoVersao` e `AuditLog` por ano quando > 10M rows.
- **Meilisearch / Typesense** se tsvector PT ficar insuficiente acima de 1M chunks.
- **CDN** para `Document` assinados.

## 11. Modelo de dados (resumo)

22 modelos vivos. Ver `apps/api/prisma/schema.prisma` para SSOT.

```
Tenant (com parentTenantId — AGENCY)
  └── Membership (M:M com User + Role)
  └── Entidade ─── EntidadeContacto, EntidadeDocumentoKYC
  └── Carteira
  └── TipoContrato (catálogo global ou custom)
  └── Template, Clausula
  └── Contrato (núcleo)
        ├── ContratoVersao (timeline imutável de drafts + assinada)
        ├── ContratoParte (→ Entidade, com Papel)
        ├── ContratoDataChave (vencimento, renovação, denúncia, pagamento)
        ├── ContratoObrigacao ─── Instancia (periódicas)
        ├── ContratoActoRegulatorio (IS, registos, BNA, AGT, notário)
        ├── ContratoNegociacaoPonto
        ├── ContratoEvento (timeline append-only)
        ├── ContratoTerminacao (1:1)
        └── Adendas: Contrato com parentContratoId
  └── Document (R2/Local storage)
  └── ImportacaoLote ─── ImportacaoLinha
  └── AIConversation ─── AIMessage
  └── Subscription, UsageQuota
  └── Webhook ─── WebhookDelivery
  └── ApiKey
  └── Notification, PushSubscription
  └── AuditLog (append-only)

Global:
  TGISVerba (catálogo)
  LegislationDocument ─── LegislationChunk (RAG)
```

## 12. Decisões de arquitectura (ADRs implícitos)

| Decisão | Razão |
|---|---|
| **Multi-tenant via app-level guard** (não RLS de Postgres) | Mais flexível; AGENCY herança via parent seria difícil em RLS puro. `TenantGuard` central permite override controlado. |
| **`tenantId` como FK em todas as tabelas de negócio** | Simplifica queries; performance previsível. Custo: cada migration tem de actualizar denormalização. |
| **`Result<T>` em vez de exceptions em services** | Documentado mas só parcialmente adoptado; NestJS encoraja exceptions HTTP. Decidir consistência num PR futuro. |
| **`BigInt` (centavos) para moeda** | Precisão garantida; serializado para `string` em JSON via `BigInt.prototype.toJSON` shim em `main.ts` + `test/setup.ts`. |
| **Cron `@nestjs/schedule` em vez de BullMQ inicial** | Sem dependência de Redis; suficiente para alertas diários e webhook delivery a 30s. Mover quando volume justificar. |
| **Compliance regras declarativas, não DSL externa** | TypeScript types garantem refactor seguro; menor barreira para advogados validarem (PR de uma regra é legível). |
| **Soft delete via `deletedAt`** | Auditoria forense + recuperação acidental. Custo: queries têm de filtrar sempre. |
| **State machine em código (não tabela de DB)** | Validação determinística e refactorable; o universo de estados é fechado e raramente muda. |
| **Webhook secret server-generated, devolvido 1x** | Pattern de GitHub/Stripe; reduz risco de leak. |
| **Sem RLS PostgreSQL hoje** | Considerar como defesa em profundidade futura. `prisma.withTenant()` já tem ganchos. |

## 13. Testes

| Suite | Ficheiros | Testes | Cobertura |
|---|---|---|---|
| Unit | `state-machine.spec`, `compliance.engine.spec`, `webhook-delivery.spec`, `alerts-scheduler.spec` | 82 | State machine, engine de regras, worker, scheduler |
| E2E | `tenant-isolation`, `adendas`, `lifecycle`, `performance` | 31 | Multi-tenancy, adendas, ciclo completo, perf @ 1000 |
| Smoke | `scripts/smoke-test.sh` | 16 checks HTTP | Happy path completo |

**113 testes verde no total.**

## 14. Convenções de código

- TypeScript `strict`, `noImplicitAny`, `noUnusedLocals`.
- ESLint sem warnings (excepto 1 pré-existente em `use-api.ts`).
- Zod em todos os DTOs de input.
- Cursor pagination com tuple ordering.
- Audit log em todas as escritas.
- `ContratoEvento` em todas as mudanças visíveis ao utilizador.
- `tenantId` como primeiro argumento dos services.
- `actorUserId` como segundo argumento quando há escrita.
- Comentários em pt-AO quando descrevem regulação local; inglês para código puro.

## 15. Roadmap técnico (curto prazo)

Não está incluído mas pronto para fazer quando aprovado:

- **OCR real** com `pdf-parse` (precisa npm install)
- **Word add-in** para edição directa
- **Embeddings reais** para o RAG (OpenAI ou Voyage AI)
- **BullMQ + Redis** quando workload justificar
- **Particionamento** de tabelas append-only por ano
- **Read replica** para queries de dashboard
- **WebSocket / SSE** para notifications IN_APP em tempo real
- **Magic link** para `EXTERNAL` role (colaboradores convidados para contratos específicos)
- **DocuSign / Yousign** integração para assinatura electrónica qualificada
- **Conservatórias** — integração com Guiché Único (registo comercial)
- **AGT submission** automática via API (quando AGT a disponibilizar)
