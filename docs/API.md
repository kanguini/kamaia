# Kamaia CLM — API Reference

> Base URL local: `http://localhost:3001/api`
> Base URL produção: `https://kamaia-api.up.railway.app/api`

## Convenções

### Autenticação

Todos os endpoints excepto `/auth/*` exigem:

| Header | Origem | Notas |
|---|---|---|
| `Authorization: Bearer <jwt>` | Devolvido por `POST /auth/login` | TTL 24h por defeito |
| `X-Tenant-Id: <uuid>` | UUID do tenant activo | Validado contra `Membership` do user. Em modo AGENCY, sub-tenants herdam via parent. |

### Paginação

Cursor-based em todas as listagens. Resposta:

```json
{
  "data": [...],
  "nextCursor": "uuid-do-último-item-ou-null",
  "total": 50
}
```

Parâmetros: `?cursor=<uuid>&limit=50` (limit 1-100, default 50).

### Valores monetários

Sempre em `BigInt` representando centavos. O serializador converte para `string` para preservar precisão. Cliente deve aplicar `BigInt(...)` ou tratar como string até apresentar.

### Datas

ISO 8601 UTC no transporte. Conversão para WAT (UTC+1) é responsabilidade do cliente.

### Erros

```json
{
  "statusCode": 400,
  "message": "Mensagem legível em pt-AO",
  "code": "OPCIONAL_ERR_CODE"
}
```

| Código | Significado |
|---|---|
| 400 | Validação Zod falhou ou estado inválido (e.g. transição ilegal) |
| 401 | JWT ausente/expirado |
| 403 | Sem permissão no tenant ou role insuficiente |
| 404 | Recurso não existe ou não pertence ao tenant |
| 409 | Conflito (e.g. email já existe, número interno duplicado) |
| 500 | Erro interno |

---

## Auth

### `POST /auth/register`

Cria User + primeiro Tenant + Membership ADMIN. Onboarding completo.

**Body:**
```json
{
  "email": "owner@empresa.ao",
  "password": "Kamaia2026!",
  "firstName": "João",
  "lastName": "Silva",
  "phone": "+244923000000",
  "tenantName": "Acme Lda",
  "tenantNif": "5410001234"
}
```

**Resposta:** `accessToken`, `user`, `tenant`.

### `POST /auth/login`

```json
{ "email": "...", "password": "..." }
```

**Resposta:** `accessToken`, `user`, `tenants: [{id, slug, nome, plan, role, isDefault}]`.

Lockout: após 5 tentativas falhadas, conta bloqueia por 15 minutos.

---

## Users

### `GET /users/me` · `PATCH /users/me`

Perfil do user autenticado. PATCH aceita `firstName`, `lastName`, `phone`, `avatarUrl`.

---

## Tenants

### `GET /tenants`

Lista tenants onde o user tem `Membership` aceite. NÃO requer `X-Tenant-Id`.

### `GET /tenants/current`

Devolve o tenant identificado pelo `X-Tenant-Id`, com sub-tenants.

### `PATCH /tenants/current` — `Roles: ADMIN`

Actualiza `nome`, `nif`, `email`, `telefone`, `morada`, `logoUrl`.

### `GET /tenants/current/sub-tenants` — Plano `AGENCY`

Lista sub-tenants do tenant-pai. Roles: ADMIN, LEGAL_LEAD, CONTRACT_MANAGER.

### `POST /tenants/current/sub-tenants` — `Roles: ADMIN`

Cria sub-tenant + Membership ADMIN do actor no novo sub-tenant.

```json
{ "nome": "Cliente X", "nif": "...", "plan": "GROWTH" }
```

---

## Memberships

### `GET /memberships`

Lista members do tenant activo (com `user.email`).

### `POST /memberships` — `Roles: ADMIN`

Convida user. Se não existe, cria User com password null + Membership pendente.

```json
{ "email": "novo@empresa.ao", "role": "CONTRACT_MANAGER" }
```

### `PATCH /memberships/:id/role` — `Roles: ADMIN`

```json
{ "role": "LEGAL_LEAD" }
```

### `DELETE /memberships/:id` — `Roles: ADMIN`

Remove o membership (não apaga o user globalmente).

### `POST /memberships/accept`

User aceita convite pendente no tenant activo.

---

## Entidades

Contrapartes (pessoas/empresas) reutilizáveis em contratos.

### `GET /entidades?q=&tipo=&nacionalidadeCambial=&sectorActividade=&limit=&cursor=`

Search com filtros + FTS em `nome` e `nomeComercial`.

### `GET /entidades/:id`

Devolve entidade com `contactos[]` e `documentosKYC[]`.

### `POST /entidades` — `Roles: ADMIN, LEGAL_LEAD, CONTRACT_MANAGER`

```json
{
  "tipo": "PESSOA_COLECTIVA",
  "nome": "TotalEnergies Angola Lda",
  "nif": "5400000001",
  "nacionalidadeCambial": "NAO_RESIDENTE",
  "paisResidencia": "FR",
  "sectorActividade": "PETROLEO_GAS"
}
```

### `PATCH /entidades/:id` · `DELETE /entidades/:id`

Update parcial / soft-delete.

---

## Carteiras

Container opcional para agrupar contratos (deal, projecto, imóvel).

### `GET /carteiras` · `POST /carteiras` · `PATCH /carteiras/:id` · `DELETE /carteiras/:id`

CRUD simples. List inclui `_count.contratos`.

---

## Tipos de Contrato

### `GET /tipos-contrato?categoria=SERVICOS`

União do catálogo global (26 tipos seed) + tipos custom do tenant.

### `POST /tipos-contrato` — `Roles: ADMIN, LEGAL_LEAD`

Cria tipo custom do tenant. Pode override gatilhos regulatórios.

---

## Contratos

### `GET /contratos?q=&estado=&tipoId=&carteiraId=&responsavelId=&contraparteId=&expiraEm=30&orderBy=createdAt&orderDir=desc&limit=&cursor=`

Lista com filtros. `expiraEm=30` filtra contratos a vencer nos próximos N dias.

### `GET /contratos/dashboard`

```json
{
  "total": 247,
  "porEstado": { "ACTIVO": 198, "EM_NEGOCIACAO": 12, ... },
  "expiraEm30": 8,
  "expiraEm90": 23,
  "denunciaEm60": 4,
  "actosPendentes": 31
}
```

### `GET /contratos/:id`

Detalhe completo: tipo, carteira, partes (com entidade), versões, datas-chave, obrigações, actos regulatórios, pontos de negociação, terminação, parent + adendas.

### `POST /contratos`

```json
{
  "titulo": "...",
  "tipoId": "<uuid>",
  "carteiraId": "<uuid?>",
  "valor": "10000000000",
  "moeda": "USD",
  "valorEmAKZ": "8500000000000",
  "leiAplicavel": "Lei angolana",
  "foro": "Tribunal Provincial de Luanda",
  "dataAssinatura": "2026-06-22",
  "dataInicioVigencia": "2026-07-01",
  "dataTermo": "2027-06-30",
  "renovacaoAutomatica": true,
  "janelaDenunciaDias": 60
}
```

Numeração auto: `CT-{ano}-{seq:5}`. Estado inicial: `INTAKE`.

**Webhook disparado:** `contrato.criado`.

### `PATCH /contratos/:id`

Update parcial. Se alterar `tipoId`, `valor`, `moeda`, `leiAplicavel` ou `dataAssinatura`, **re-avalia compliance automaticamente**.

### `POST /contratos/:id/transicao`

```json
{ "para": "DRAFTING", "motivo": "iniciar redacção" }
```

Valida o grafo de state machine (`shared-types: canTransition`). 400 se transição ilegal.

Transições para `ASSINADO` ou `REPOSITORIO` disparam o `ComplianceEngine`.

**Webhooks disparados:** `contrato.estado_alterado` (sempre), `contrato.assinado`, `contrato.terminado` (consoante estado).

### `DELETE /contratos/:id` — `Roles: ADMIN, LEGAL_LEAD`

Soft delete (`deletedAt`).

---

## Sub-recursos de Contrato

### Versões — `/contratos/:contratoId/versoes`

`GET` lista por `ordem desc`. `POST` cria nova versão:
```json
{
  "versao": "V1.0",
  "direccao": "ENVIADO_CONTRAPARTE",
  "documentId": "<uuid?>",
  "hashSHA256": "<sha256 hex>",
  "comentario": "..."
}
```

### Partes — `/contratos/:contratoId/partes`

`GET` · `POST { entidadeId, papel, representanteNome?, representanteCargo? }` · `DELETE :parteId`.

Papéis: `PARTE_PRINCIPAL`, `CONTRAPARTE`, `GARANTE`, `TESTEMUNHA`, `NOTARIO`, `INTERVENIENTE_ACESSORIO`.

### Datas-chave — `/contratos/:contratoId/datas-chave`

`GET` · `POST { tipo, data, descricao?, alertaDias?[] }` · `PATCH :id/cumprida`.

Tipos: `ASSINATURA`, `INICIO_VIGENCIA`, `TERMO`, `RENOVACAO_AUTOMATICA`, `JANELA_DENUNCIA_INICIO`, `JANELA_DENUNCIA_FIM`, `PAGAMENTO`, `ENTREGA`, `REVISAO_PRECO`, `MILESTONE`, `GARANTIA_VALIDADE`, `SEGURO_VALIDADE`, `OUTRO`.

### Eventos — `/contratos/:contratoId/eventos`

`GET ?limit=100` lê a timeline. `POST /comentar { texto }` adiciona comentário.

### Negociação — `/contratos/:contratoId/negociacao`

`GET` lista pontos abertos ordenados por criticidade.
`POST` cria ponto:
```json
{
  "clausulaRef": "Cláusula 5.2",
  "titulo": "Limitação de responsabilidade",
  "resumo": "...",
  "posicaoNos": "12 meses",
  "posicaoContraparte": "24 meses",
  "criticidade": "ALTA"
}
```
`PATCH :pontoId` actualiza estado: `ABERTO → PROPOSTO → ACEITE | REJEITADO`.

### Terminação — `/contratos/:contratoId/terminacao`

`POST` regista terminação:
```json
{
  "tipo": "DENUNCIA_TEMPESTIVA",
  "dataEfectiva": "2026-12-31",
  "motivacao": "...",
  "obrigacoesPosTermo": { "confidencialidade": "5 anos", "naoConcorrencia": "2 anos" }
}
```
Transita o contrato para `TERMINADO`.

### Adendas — `/contratos/:contratoId/adendas`

`GET` lista adendas do contrato. `POST` cria adenda:
```json
{
  "titulo": "Adenda — extensão de prazo",
  "descricao": "...",
  "herdarPartes": true,
  "dataTermo": "2028-06-30"
}
```

Regras: contrato pai tem de estar `ACTIVO`. Pai transita para `EM_ADENDA`. Adenda começa em `DRAFTING`. Numeração `{numeroPai}-A{seq:2}`.

---

## Compliance Engine

### `GET /compliance/regras`

Lista as 20+ regras vigentes (id, versão, tipo, referenciaLegal, vigência).

### `GET /compliance/pendentes?dias=30`

Lista actos `PENDENTE` ou `EM_CURSO` com `prazoLimite` nos próximos N dias, com nome do contrato associado.

### `POST /compliance/contratos/:contratoId/avaliar`

Força nova avaliação. Idempotente: actos já detectados via regra não são duplicados.

**Webhook disparado por cada novo acto:** `acto_regulatorio.detectado`.

### `PATCH /compliance/actos/:actoId/concluir`

```json
{
  "comprovativoId": "<uuid?>",
  "observacoes": "Pago via MFK 2026-07-10",
  "custoEmAKZ": "70000000"
}
```

Marca acto como `CONCLUIDO` + dispara webhook `acto_regulatorio.concluido`.

### Regras seed (20+)

| Categoria | ID | Verba/Ref | Aplicabilidade |
|---|---|---|---|
| IS | IS_PRESTACAO_SERVICOS | Verba 23.3 (7%) | Categoria SERVICOS |
| IS | IS_ARRENDAMENTO_HABITACIONAL | Verba 2.1 (0,1%) | tipoCodigo=ARRENDAMENTO_HABITACIONAL |
| IS | IS_ARRENDAMENTO_COMERCIAL | Verba 2.2 (0,4%) | tipoCodigo=ARRENDAMENTO |
| IS | IS_MUTUO | Verba 16.1.1 (0,5%) | tipoCodigo=MUTUO |
| IS | IS_COMPRAVENDA_IMOVEL | Verba 1 (0,3%) | tipoCodigo=COMPRAVENDA_IMOVEL ou CPCV_IMOVEL |
| IS | IS_GARANTIA | Verba 10.1 (0,3%) | tipoCodigo=GARANTIA/PENHOR |
| IS | IS_TRABALHO_ISENTO | Art. 6.º n.º 3 t) | Categoria TRABALHO (sinaliza isenção) |
| IS | IS_EMPREITADA | Verba 23.3 (7%) | tipoCodigo=EMPREITADA |
| IS | IS_LICENCA_IP | Verba 23.3 (7%) | Categoria IP |
| IS | IS_FORNECIMENTO | Verba 23.3 (7%) | tipoCodigo=FORNECIMENTO/DISTRIBUICAO |
| BNA | BNA_SERVICOS_NAO_RESIDENTE | Lei Cambial + RJOC | SERVICOS + NR + ≥USD 50k |
| BNA | BNA_REGISTO_SERVICOS_PEQUENO | RJOC | SERVICOS + NR + USD 10k-50k |
| BNA | BNA_MUTUO_INTERNACIONAL | Lei Cambial | MUTUO + NR |
| Registos | REGISTO_PREDIAL | CRP | hasObjectoImovel |
| Registos | REGISTO_COMERCIAL | CRC | hasObjectoSocietario |
| Registos | REGISTO_AUTOMOVEL | RJRA | hasObjectoAutomovel |
| Registos | REGISTO_IP_IAPI | Lei PI | hasObjectoIP |
| AGT | AGT_RETENCAO_IRT_NAO_RESIDENTE | Código IRT (15%) | SERVICOS/IP + NR |
| Notário | NOTARIO_COMPRAVENDA_IMOVEL | Código Notariado | tipoCodigo=COMPRAVENDA_IMOVEL |
| Notário | NOTARIO_PACTO_SOCIAL | Código Notariado + LSC | hasObjectoSocietario |

---

## Webhooks

### `GET /webhooks` — `Roles: ADMIN, LEGAL_LEAD`

### `POST /webhooks` — `Roles: ADMIN`

```json
{
  "nome": "ERP sync",
  "url": "https://erp.empresa.ao/kamaia/hook",
  "events": ["contrato.assinado", "acto_regulatorio.detectado"]
}
```

Resposta inclui `secret` (devolvido **uma única vez**). Guardar para verificar HMAC.

### `PATCH /webhooks/:id` · `DELETE /webhooks/:id` · `GET /webhooks/:id`

### Eventos suportados

- `contrato.criado`
- `contrato.estado_alterado`
- `contrato.assinado`
- `contrato.expira_em_30_dias` · `contrato.expira_em_7_dias`
- `contrato.janela_denuncia_proxima` · `contrato.renovacao_automatica_proxima`
- `contrato.terminado`
- `acto_regulatorio.detectado`
- `acto_regulatorio.concluido`

### Formato da delivery

```http
POST /your-endpoint HTTP/1.1
Content-Type: application/json
X-Kamaia-Event: contrato.assinado
X-Kamaia-Delivery: 550e8400-e29b-41d4-a716-446655440000
X-Kamaia-Signature: sha256=<hex_digest>
User-Agent: Kamaia-Webhook/1.0

{
  "event": "contrato.assinado",
  "deliveryId": "550e8400-...",
  "timestamp": "2026-06-22T10:00:00.000Z",
  "data": { ... }
}
```

**Verificar a assinatura:**
```python
import hmac, hashlib
expected = "sha256=" + hmac.new(secret.encode(), body_bytes, hashlib.sha256).hexdigest()
assert hmac.compare_digest(expected, request.headers["x-kamaia-signature"])
```

**Retries:** Exponential backoff (1m → 5m → 15m → 1h → 6h → 24h), 6 tentativas, timeout HTTP 8s. Status final: `SUCCESS` ou `FAILED`.

---

## Importação em massa

### `POST /importacao/lotes` — Cria lote

```json
{ "nome": "Carteira legada Q2 2026" }
```

### `POST /importacao/lotes/:id/linhas` — Adiciona linha
### `POST /importacao/lotes/:id/start` — Inicia processamento
### `GET /importacao/lotes` · `GET /importacao/lotes/:id`

Estados: `EM_FILA → PROCESSANDO → CONCLUIDO`/`CONCLUIDO_COM_ERROS`/`FALHOU`.

---

## Documents

### `POST /documents` — Upload (base64 enquanto Multer não está wired)
### `GET /documents/:id` — Metadata + URL
### `DELETE /documents/:id` — Soft delete

Backends: `LOCAL` (filesystem dev) ou `R2` (S3). Selecciona via `STORAGE_BACKEND`.

---

## IA — Q&A Legislação Angolana

### `POST /ia/conversations` · `GET /ia/conversations` · `GET /ia/conversations/:id`

### `POST /ia/conversations/:id/messages`

```json
{ "conteudo": "Como liquido IS sobre arrendamento comercial?" }
```

**Comportamento:**
- Sem `ANTHROPIC_API_KEY`: resposta stub com disclaimer
- Com chave: chama Claude (default `claude-sonnet-4-5`) com:
  - System prompt PT-AO especializado em direito angolano
  - RAG context: top-6 chunks da legislação semeada
  - Histórico das últimas 10 trocas
  - Citações persistidas em `AIMessage.citacoes`

---

## RAG — Legislação

### `GET /rag/legislation` · `GET /rag/legislation/:id`

Catálogo seed: 13 diplomas (CRA, CC, CCom, LSC, CIS, CGT/LGT, LGT, LIP, Lei Cambial, Lei 22/11, Lei 3/14, CRC, CRP).

### `POST /rag/legislation` — `Roles: ADMIN, LEGAL_LEAD`

### `POST /rag/legislation/:id/chunks` — Bulk add chunks

### `POST /rag/search`

```json
{ "q": "imposto de selo arrendamento", "topK": 6, "documentId": "<uuid?>" }
```

Fallback FTS por contagem de termos enquanto embeddings não estão populados.

---

## Notifications

### `GET /notifications` · `PATCH /notifications/:id/read`

Log de notificações in-app + queue para email/SMS/push.

### `POST /notifications/test` — `Roles: ADMIN`

Cria notificações de cada tipo para o user actual (apenas DEV).

---

## Backup

### `POST /backup/export` — `Roles: ADMIN`

Devolve `application/json` inline com:
```json
{
  "summary": { "id": "...", "sizeBytes": 123456, "manifest": { "contratos": 247, ... } },
  "payload": { "meta": {...}, "tenant": {...}, "contratos": [...], ... }
}
```

Headers: `X-Kamaia-Backup-Id`, `X-Kamaia-Backup-Size`. `Content-Disposition: attachment` para download directo.

### `GET /backup/exports` — `Roles: ADMIN`

Histórico in-memory do processo (TTL = uptime).

---

## Holidays

### `GET /holidays/:year`

Feriados nacionais angolanos para o ano. Lista fixa em `shared-types`.

---

## Seed (dev only)

`POST /seed/all` · `POST /seed/tgis` · `POST /seed/tipos-contrato`. **Bloqueado em `NODE_ENV=production`**.

---

## Health

`GET /health` — Sem auth. Devolve `status`, `database`, `uptime`, `responseTime`, `environment`.

---

## Smoke test

Script reproduzível em `scripts/smoke-test.sh`. Cobre 16 checks do happy path. Uso:

```bash
bash scripts/smoke-test.sh                              # localhost
API_URL=https://kamaia-api.up.railway.app/api bash scripts/smoke-test.sh
```

---

## Variáveis de ambiente

| Var | Função | Default |
|---|---|---|
| `DATABASE_URL` | Postgres connection | `postgresql://kamaia:kamaia_dev_2024@localhost:5432/kamaia` |
| `JWT_SECRET` | HMAC secret para tokens | required prod |
| `JWT_EXPIRES_IN` | TTL token | `24h` |
| `ANTHROPIC_API_KEY` | Activa Claude | opcional (stub fallback) |
| `CLAUDE_MODEL` | Modelo a usar | `claude-sonnet-4-5-20250929` |
| `CLAUDE_MAX_TOKENS` | Limite output | `2048` |
| `SENTRY_DSN` | Telemetria | opcional |
| `STORAGE_BACKEND` | `local` ou `r2` | `local` |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` | R2 config | required se `r2` |
| `RESEND_API_KEY` | Email | opcional |
| `FRONTEND_URL` | CORS origin | `http://localhost:3000` |
| `PORT` / `APP_PORT` | API port | `3001` |
