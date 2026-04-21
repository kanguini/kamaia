# Kamaia — Disaster Recovery & Backup Policy

> Dados de gabinetes jurídicos têm peso legal e regulatório. Perder dados não
> é só mau produto — em Angola pode significar responsabilidade disciplinar
> do advogado subscritor. Este documento define quais garantias damos e como.

## Objectivos

| Métrica | MVP (Sprint 0-3) | Produção |
|---|---|---|
| **RPO** (Recovery Point Objective) | 24h — dump diário | 15 min — WAL streaming |
| **RTO** (Recovery Time Objective) | 4h — restore manual | 1h — automático |
| **Retenção diária** | 30 dias | 30 dias |
| **Retenção semanal** | 12 semanas | 12 semanas |
| **Retenção mensal** | 12 meses | 7 anos (compliance OAA) |

O MVP aceita RPO de 24h porque o volume de dados é baixo e o custo de WAL
archiving não se justifica ainda. À entrada em produção comercial o salto
para WAL é obrigatório.

## Alcance

**Incluído no backup:**
- Toda a BD PostgreSQL (`pg_dump -Fc`), incluindo `pgvector` embeddings.
- Schema + dados. Object-storage (documentos, PDFs, logos) é backup separado
  via replicação do próprio provider (lifecycle rule com versioning).

**Não incluído:**
- Logs de runtime (Pino → stdout) — não têm valor de recuperação.
- Cache Redis — é efémero por contrato.
- Secrets (.env, JWT keys) — geridos separadamente via password manager.

## Componentes

### 1. Script de backup — `scripts/backup-db.sh`

Gera dump comprimido (`pg_dump -Fc -Z9`), opcionalmente cifra com AGE,
envia para bucket S3-compatível. Idempotente; falha limpa se dependências
em falta. Não apaga nada — retenção é da policy do bucket.

```bash
DATABASE_URL="postgresql://..." \
BACKUP_BUCKET="kamaia-backups" \
AWS_ACCESS_KEY_ID="..." \
AWS_SECRET_ACCESS_KEY="..." \
AWS_ENDPOINT_URL="https://s3.eu-central-003.backblazeb2.com" \
BACKUP_AGE_RECIPIENT="age1..." \
./scripts/backup-db.sh daily
```

### 2. Script de restore — `scripts/restore-db.sh`

Contraparte. Recusa-se a escrever se `TARGET_DATABASE_URL` contiver `prod`
(defesa contra erro humano). Pede confirmação interactiva.

### 3. Calendário (production)

Via cron no host ou GitHub Actions scheduled:

```
# Diário às 03:00 UTC (04:00 WAT Angola)
0 3 * * *    ./scripts/backup-db.sh daily

# Semanal domingo 03:30 UTC
30 3 * * 0   ./scripts/backup-db.sh weekly

# Mensal dia 1 às 04:00 UTC
0 4 1 * *    ./scripts/backup-db.sh monthly
```

### 4. Provider recomendado

**Default:** Backblaze B2 (`s3.eu-central-003.backblazeb2.com`).
- Latência Europa → Angola: ~120 ms, aceitável para upload noturno.
- Custo: ~$6/TB/mês, 3× mais barato que S3.
- Object Lock para retention enforcement.
- S3-compatível, cliente `aws` funciona sem mudanças.

**Alternativas drop-in** (mesma shape de variáveis):
- AWS S3 eu-central-1 (Frankfurt)
- DigitalOcean Spaces fra1
- MinIO self-hosted (se houver obrigação de data-residency Angola)

### 5. Cifragem

Dumps contêm dados pessoais (LGPD/regulamento Angola de protecção de dados)
e segredos de clientes jurídicos. Cifrar em repouso com [age](https://github.com/FiloSottile/age):

```bash
# Gerar keypair (uma vez, guardar privada offline)
age-keygen -o backup-key.txt
# Pública vai para BACKUP_AGE_RECIPIENT, privada vai para cofre.
```

A chave privada **nunca** vive no mesmo sistema que faz backups. Guardar:
- Offline (1Password / cofre físico)
- Cópia em custody com sócio gestor

## Procedimento de Restore (Runbook)

1. **Identificar o ponto.** Listar dumps do bucket:
   ```bash
   aws s3 ls s3://kamaia-backups/kamaia/daily/
   ```

2. **Criar BD de staging.** NUNCA restaurar directamente sobre produção.
   ```bash
   createdb kamaia_restore_test
   ```

3. **Restore para staging.**
   ```bash
   TARGET_DATABASE_URL="postgresql://localhost/kamaia_restore_test" \
   BACKUP_AGE_IDENTITY="$(cat backup-key.txt)" \
   ./scripts/restore-db.sh kamaia/daily/kamaia-daily-20260421T030000Z.dump.age
   ```

4. **Smoke test.** Correr a app contra a BD de staging; verificar:
   - `SELECT count(*) FROM gabinetes;` > 0
   - `SELECT count(*) FROM users WHERE deleted_at IS NULL;` coerente
   - `SELECT count(*) FROM processos;` coerente
   - Login de um utilizador conhecido

5. **Promover.** Se smoke OK, renomear BDs:
   ```sql
   ALTER DATABASE kamaia RENAME TO kamaia_broken_20260421;
   ALTER DATABASE kamaia_restore_test RENAME TO kamaia;
   ```
   Reiniciar app.

6. **Post-mortem.** Documentar em `docs/incidents/` a causa, o RPO efectivo
   observado e gap com o target.

## Testes de Restore — obrigatórios

RPO/RTO só valem se forem **testados**. Cadência mínima:

- **Mensal:** smoke test automatizado em CI — restore + `SELECT count(*)`
  em todas as tabelas de negócio.
- **Trimestral:** restore completo + checklist funcional em staging.
- **Anual:** simulação de disaster recovery real com cronómetro. Meta:
  bater o RTO declarado.

Sem estes testes, este documento é papelada inútil.

## Gaps conhecidos (MVP)

1. **pgvector embeddings re-ingestion:** o dump inclui a coluna vector, mas
   se o embedding model mudar (ex: troca Gemini → Claude), os embeddings
   antigos ficam incoerentes. Plano: versionar `model_id` na tabela de
   chunks e re-ingerir em background quando detectar mismatch.

2. **Redis não é persistido:** fila de jobs perde-se em reinício. Mitigação:
   idempotência nos jobs (já implementada em `notifications`, pendente em
   `projects-alerts`). Seguir padrão de outbox quando entrar produção.

3. **Sem replicação síncrona:** RPO 24h significa que até um dia de trabalho
   pode ser perdido. Aceitável no MVP (pouco volume); migrar para `logical
   replication` ou managed Postgres HA à entrada em produção comercial.

4. **Sem point-in-time recovery (PITR):** dumps são snapshots. Para PITR
   precisamos de WAL archiving (`archive_command` + `barman` ou RDS
   automated backups). Plano está dependente da decisão de managed vs
   self-hosted Postgres em produção.
