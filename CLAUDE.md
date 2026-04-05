# KAMAIA — Plataforma de Gestao Juridica com IA

## Identidade do Projecto
- Produto: Kamaia — plataforma SaaS de gestao de pratica juridica com assistente IA
- Mercado: Angola → PALOP
- Segmento: Advogado solo / Pequeno gabinete juridico
- Stack: Next.js 14 + NestJS + PostgreSQL 16 + pgvector + Claude API
- Fase actual: SPRINT 0 — Scaffolding, Auth & Infra

## Arquitectura — Regras Absolutas
- GABINETE ISOLATION: gabineteId obrigatorio em TODAS as tabelas de negocio
- Todas as queries de repositorio incluem WHERE gabineteId = ?
- RBAC: verificacao de permissoes via guards (JwtAuthGuard + GabineteGuard + RolesGuard)
- Audit log: TODAS as accoes de escrita geram registo em audit_log (append-only)
- Soft delete SEMPRE — nunca DELETE fisico em dados de negocio
- Result<T> pattern — NUNCA throw em logica de negocio nos services

## Stack e Convencoes
- TypeScript strict mode em todo o projecto — sem any implicito
- Zod para validacao em todos os endpoints (ParseZodPipe)
- Cursor-based pagination para listas (nao offset)
- Error handling: usar Result type com ok()/err()
- Datas: sempre UTC no backend, converter para WAT (UTC+1) no frontend
- Moeda: AKZ — armazenar em inteiros (centavos), nunca floats

## Modulos
1. Auth + RBAC + Gabinete (Sprint 0) ← ACTUAL
2. Gestao de Processos (Sprint 1)
3. Assistente IA + RAG (Sprint 1)
4. Prazos & Alertas (Sprint 1)
5. Agenda & Calendario (Sprint 2)
6. CRM Clientes (Sprint 2)
7. Timesheets & Rentabilidade (Sprint 3)
8. Freemium & Billing (Sprint 3)

## Perfis de Acesso (RBAC)
- SOCIO_GESTOR: acesso total, gestao de equipa
- ADVOGADO_SOLO: acesso total aos seus dados, sem equipa
- ADVOGADO_MEMBRO: acesso aos processos atribuidos
- ESTAGIARIO: acesso restrito, supervisionado

## Comandos Uteis
- npm run dev        — inicia todos os servicos (turbo)
- npm run test       — jest com --passWithNoTests
- npm run migrate    — prisma migrate dev
- npm run seed       — dados de teste
- npm run lint       — eslint
- npm run typecheck  — tsc --noEmit

## Regras de Desenvolvimento
- NUNCA commitar secrets — usar .env.local (nao tracked)
- NUNCA usar floats para valores monetarios
- SEMPRE gerar migration para alteracoes de schema
- SEMPRE escrever testes para logica de negocio nova
- SEMPRE incluir gabineteId em queries de dados de negocio
- SEMPRE logar accoes de escrita no audit_log

## Ficheiros Criticos
- Schema DB: apps/api/prisma/schema.prisma
- Tipos partilhados: packages/shared-types/src/index.ts
- Guards RBAC: apps/api/src/common/guards/
- Auth module: apps/api/src/modules/auth/
- NextAuth config: apps/web/src/app/api/auth/[...nextauth]/route.ts
- Design system: apps/web/tailwind.config.ts
- Seed data: apps/api/prisma/seed.ts

## Credenciais de Dev
- PostgreSQL: kamaia / kamaia_dev_2024 @ localhost:5432/kamaia
- Redis: localhost:6379
- Seed users: socio@kamaia.dev / advogado@kamaia.dev / estagiario@kamaia.dev (password: Kamaia2026!)
