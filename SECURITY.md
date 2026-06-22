# Política de Segurança do Kamaia

> Última actualização: Junho 2026

Esta política aplica-se ao Kamaia CLM (este repositório), incluindo a API NestJS, o frontend Next.js e a infraestrutura associada.

## Reportar vulnerabilidades

**Por favor, NÃO abras issues públicas para vulnerabilidades de segurança.**

Envia o relatório para: **security@kamaia.cc** (PGP key em https://kamaia.cc/.well-known/security.txt — em breve)

O que incluir:
- Descrição da vulnerabilidade
- Passos para reproduzir
- Versão / commit afectado
- Avaliação de impacto (se possível)
- O teu nome / handle para crédito (opcional)

## Tempo de resposta

| Severidade | Resposta inicial | Patch alvo |
|---|---|---|
| Crítica (RCE, vazamento cross-tenant, auth bypass) | 24h | 7 dias |
| Alta (escalação de privilégios, dados sensíveis expostos) | 72h | 14 dias |
| Média (DoS, IDOR limitado) | 5 dias úteis | 30 dias |
| Baixa (info disclosure menor, XSS reflectido) | 10 dias úteis | 60 dias |

Trabalhamos com o reporter em coordinated disclosure: divulgação pública apenas após patch.

## Âmbito

### Em âmbito

- ✓ API HTTP (`apps/api`) — auth, RBAC, multi-tenancy, validação
- ✓ Frontend (`apps/web`, `apps/marketing`) — XSS, CSRF, secrets em código
- ✓ Compliance Engine — regras incorrectas que possam levar a sanções regulatórias
- ✓ Webhooks — verificação HMAC, replay, SSRF
- ✓ IA — prompt injection, vazamento de dados via prompts
- ✓ Schema Prisma — IDOR, missing tenantId, indices em falta com impacto de segurança
- ✓ CI/CD — secrets management, supply chain (dependências)

### Fora de âmbito

- ✗ Vulnerabilidades em código de exemplo / docs (a menos que reproduzíveis)
- ✗ Vulnerabilidades em deploys de terceiros (Railway, Vercel) — reportar directamente ao fornecedor
- ✗ Self-XSS, clickjacking de páginas estáticas, missing security headers em endpoints sem auth
- ✗ Findings de scanners automáticos sem PoC reproduzível
- ✗ Best-practice violations sem impacto explorável

## Promessas de segurança

Estas são as garantias que o produto faz explicitamente. Quebrar uma destas é, por definição, uma vulnerabilidade crítica:

### Isolamento multi-tenant

**Nenhum dado de Tenant A é acessível a um user de Tenant B** (excepto modo AGENCY: sub-tenants são acessíveis ao tenant-pai por design).

Validado em `apps/api/test/tenant-isolation.e2e-spec.ts` — 9 testes. Qualquer regressão é incidente crítico.

### Audit log append-only

**Todas as escritas relevantes são registadas em `audit_logs`** com actor, antes/depois, IP, user-agent. Falsificar ou apagar audit log requer privilégios de DBA — não é possível via API.

### Compliance Engine determinístico + versionado

**As regras de compliance são versionadas e a regra vigente à data do facto tributário é a aplicável.** Mudanças futuras às regras não alteram retroactivamente actos antigos. O engine **sugere**, nunca executa — cada acto requer confirmação humana com disclaimer visível.

### Webhook delivery autenticado

**Cada delivery é assinado com HMAC SHA-256** sobre o body, usando o `secret` da subscrição. O `secret` é gerado server-side e devolvido **uma única vez** no momento da criação — depois disso só o hash fica armazenado.

### Secrets fora do repositório

- `.env*` files no `.gitignore`
- JWT secrets, API keys, DB passwords nunca commitados
- Pre-commit hooks validam — qualquer commit com chave deve ser rotada imediatamente

### Lockout de conta

5 tentativas falhadas de login bloqueiam a conta por 15 minutos. Mitigação contra brute-force.

## Headers de segurança

A API usa `helmet()` com defaults restritivos. O frontend serve com:
- `Content-Security-Policy` configurado por NextAuth + custom middleware
- `Strict-Transport-Security` em produção
- `X-Frame-Options: DENY` (nunca embebível)
- `X-Content-Type-Options: nosniff`

## Dependências

- Renovate / Dependabot configurado para alertar sobre CVEs (a confirmar em CI)
- `npm audit` corre no CI em cada PR
- Lockfile committed (`package-lock.json`) para builds reproduzíveis
- Major upgrades requerem PR dedicado com regression testing

## Criptografia

- Bcrypt rounds=12 para passwords
- HMAC SHA-256 para webhook signatures
- TLS obrigatório em produção (Railway + Vercel forçam)
- JWT HS256 com secret de ≥256 bits em produção
- Hash SHA-256 para document content integrity
- Selo temporal em `ContratoVersao.seloTemporal` para versões assinadas

## Compliance regulatório

O Kamaia opera em conformidade com:

- **Lei n.º 22/11** (Protecção de Dados Pessoais — Angola)
- **GDPR/RGPD** (UE) — para tenants com sujeitos UE
- **Lei n.º 3/14** (anti-branqueamento) — Kamaia não é entidade financeira mas trata KYC de contrapartes corporativas

Direitos do titular de dados (Lei 22/11):
- Acesso aos seus dados pessoais
- Rectificação
- Eliminação (com excepções para audit log retido por obrigação legal de retenção fiscal de 10 anos — LGT art. 96.º)
- Portabilidade (export JSON via `POST /backup/export`)

## Histórico de incidentes

(Nenhum reportado até à data.)

## Reconhecimentos

Investigadores de segurança que reportarem vulnerabilidades válidas e seguirem responsible disclosure serão creditados aqui (com permissão).

---

*Para questões não-relacionadas com segurança, usa as issues do repositório.*
