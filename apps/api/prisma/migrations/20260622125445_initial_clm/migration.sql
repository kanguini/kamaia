-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "TenantPlan" AS ENUM ('STARTER', 'GROWTH', 'SCALE', 'ENTERPRISE', 'AGENCY');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'LEGAL_LEAD', 'CONTRACT_MANAGER', 'BUSINESS_USER', 'VIEWER', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "EntidadeTipo" AS ENUM ('PESSOA_SINGULAR', 'PESSOA_COLECTIVA');

-- CreateEnum
CREATE TYPE "EntidadeNacionalidadeCambial" AS ENUM ('RESIDENTE', 'NAO_RESIDENTE');

-- CreateEnum
CREATE TYPE "ContratoEstado" AS ENUM ('INTAKE', 'DRAFTING', 'REV_INTERNA', 'REV_CLIENTE', 'EM_NEGOCIACAO', 'APROVACAO', 'PRONTO_ASSINATURA', 'ASSINADO', 'POS_ASSINATURA', 'ACTIVO', 'EM_DISPUTA', 'EM_ADENDA', 'EM_TERMINACAO', 'TERMINADO', 'ARQUIVADO', 'REPOSITORIO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ContratoOrigem" AS ENUM ('CRIADO_INTERNAMENTE', 'IMPORTADO_REPOSITORIO', 'RECEBIDO_CONTRAPARTE', 'ADENDA');

-- CreateEnum
CREATE TYPE "VersaoDireccao" AS ENUM ('INTERNA', 'ENVIADO_CLIENTE', 'RECEBIDO_CLIENTE', 'ENVIADO_CONTRAPARTE', 'RECEBIDO_CONTRAPARTE', 'ASSINADO_FINAL');

-- CreateEnum
CREATE TYPE "ExtracaoStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "PartePapel" AS ENUM ('PARTE_PRINCIPAL', 'CONTRAPARTE', 'GARANTE', 'TESTEMUNHA', 'NOTARIO', 'INTERVENIENTE_ACESSORIO');

-- CreateEnum
CREATE TYPE "DataChaveTipo" AS ENUM ('ASSINATURA', 'INICIO_VIGENCIA', 'TERMO', 'RENOVACAO_AUTOMATICA', 'JANELA_DENUNCIA_INICIO', 'JANELA_DENUNCIA_FIM', 'PAGAMENTO', 'ENTREGA', 'REVISAO_PRECO', 'MILESTONE', 'GARANTIA_VALIDADE', 'SEGURO_VALIDADE', 'OUTRO');

-- CreateEnum
CREATE TYPE "ObrigacaoTipo" AS ENUM ('PAGAMENTO_PERIODICO', 'REPORTE', 'GARANTIA_VALIDADE', 'SEGURO_VALIDADE', 'SLA', 'ENTREGA_PERIODICA', 'OUTRO');

-- CreateEnum
CREATE TYPE "ObrigacaoPeriodicidade" AS ENUM ('UNICA', 'MENSAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "ObrigacaoInstanciaEstado" AS ENUM ('PENDENTE', 'CUMPRIDA', 'ATRASADA', 'DISPENSADA');

-- CreateEnum
CREATE TYPE "ActoRegulatorioTipo" AS ENUM ('IMPOSTO_SELO', 'REGISTO_COMERCIAL', 'REGISTO_PREDIAL', 'REGISTO_AUTOMOVEL', 'REGISTO_IP_IAPI', 'BNA_AUTORIZACAO', 'BNA_REGISTO', 'AGT_RETENCAO_IRT', 'AGT_OUTRO', 'RECONHECIMENTO_NOTARIAL', 'TRADUCAO_JURAMENTADA', 'SECTORIAL_OUTRO');

-- CreateEnum
CREATE TYPE "ActoEstado" AS ENUM ('NAO_APLICAVEL', 'PENDENTE', 'EM_CURSO', 'CONCLUIDO', 'DISPENSADO', 'FALHOU', 'EXPIRADO');

-- CreateEnum
CREATE TYPE "NegociacaoPontoEstado" AS ENUM ('ABERTO', 'PROPOSTO', 'CONTRA_PROPOSTO', 'ACEITE', 'REJEITADO', 'RETIRADO');

-- CreateEnum
CREATE TYPE "NegociacaoPontoCriticidade" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "TerminacaoTipo" AS ENUM ('NATURAL', 'DENUNCIA_TEMPESTIVA', 'RESOLUCAO_INCUMPRIMENTO', 'REVOGACAO_MUTUA', 'FORCA_MAIOR', 'CADUCIDADE', 'OUTRO');

-- CreateEnum
CREATE TYPE "LoteEstado" AS ENUM ('EM_FILA', 'PROCESSANDO', 'CONCLUIDO', 'CONCLUIDO_COM_ERROS', 'FALHOU', 'CANCELADO');

-- CreateEnum
CREATE TYPE "LinhaEstado" AS ENUM ('PENDENTE', 'OCR_EM_CURSO', 'OCR_CONCLUIDO', 'EXTRACAO_EM_CURSO', 'EXTRACAO_CONCLUIDA', 'REVISAO_HUMANA', 'CRIADO', 'FALHOU', 'IGNORADO');

-- CreateEnum
CREATE TYPE "DocumentStorageType" AS ENUM ('LOCAL', 'R2', 'S3');

-- CreateEnum
CREATE TYPE "AIMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'RETRYING');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "nif" VARCHAR(20),
    "email" VARCHAR(200),
    "telefone" VARCHAR(30),
    "morada" JSONB,
    "logo_url" VARCHAR(500),
    "plan" "TenantPlan" NOT NULL DEFAULT 'STARTER',
    "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
    "parent_tenant_id" UUID,
    "country" VARCHAR(2) NOT NULL DEFAULT 'AO',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'pt-AO',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Africa/Luanda',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "password_hash" VARCHAR(200),
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(30),
    "avatar_url" VARCHAR(500),
    "provider" VARCHAR(20) NOT NULL DEFAULT 'credentials',
    "provider_id" VARCHAR(200),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "email_verified_at" TIMESTAMPTZ,
    "last_login_at" TIMESTAMPTZ,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "invited_by" UUID,
    "invited_at" TIMESTAMPTZ,
    "accepted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(200) NOT NULL,
    "user_agent" TEXT,
    "ip_address" VARCHAR(45),
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entidades" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tipo" "EntidadeTipo" NOT NULL,
    "nome" VARCHAR(300) NOT NULL,
    "nome_comercial" VARCHAR(300),
    "nif" VARCHAR(20),
    "numero_bi" VARCHAR(30),
    "matricula_rc" VARCHAR(50),
    "nacionalidade_cambial" "EntidadeNacionalidadeCambial" NOT NULL DEFAULT 'RESIDENTE',
    "sector_actividade" VARCHAR(100),
    "morada" JSONB,
    "pais_residencia" VARCHAR(2) NOT NULL DEFAULT 'AO',
    "observacoes" TEXT,
    "search_vector" tsvector,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "entidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entidade_contactos" (
    "id" UUID NOT NULL,
    "entidade_id" UUID NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "cargo" VARCHAR(100),
    "email" VARCHAR(200),
    "telefone" VARCHAR(30),
    "is_principal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entidade_contactos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entidade_documentos_kyc" (
    "id" UUID NOT NULL,
    "entidade_id" UUID NOT NULL,
    "tipo" VARCHAR(60) NOT NULL,
    "numero" VARCHAR(100),
    "emitido_em" DATE,
    "valido_ate" DATE,
    "document_id" UUID,
    "observacoes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entidade_documentos_kyc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carteiras" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "descricao" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "carteiras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_contrato" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "codigo" VARCHAR(80) NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "categoria" VARCHAR(60) NOT NULL,
    "descricao" TEXT,
    "tgis_verba_numero" VARCHAR(20),
    "requer_notario" BOOLEAN NOT NULL DEFAULT false,
    "registos_requeridos" TEXT[],
    "gatilho_bna" JSONB,
    "retencao_irt_padrao" BOOLEAN NOT NULL DEFAULT false,
    "clausulas_obrigatorias" TEXT[],
    "template_padrao_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tipos_contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tgis_verbas" (
    "numero" VARCHAR(20) NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo_taxa" VARCHAR(20) NOT NULL,
    "taxa_valor" VARCHAR(100) NOT NULL,
    "taxa_unidade" VARCHAR(20),
    "base_regra" JSONB,
    "responsavel_liquidacao" VARCHAR(60),
    "referencia_legal" TEXT NOT NULL,
    "vigente_desde" DATE NOT NULL,
    "vigente_ate" DATE,

    CONSTRAINT "tgis_verbas_pkey" PRIMARY KEY ("numero")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tipo_id" UUID NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "descricao" TEXT,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "conteudo" TEXT NOT NULL,
    "metadata" JSONB,
    "idiomas" TEXT[] DEFAULT ARRAY['pt-AO']::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by" UUID,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clausulas" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "categoria" VARCHAR(60) NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "conteudo" TEXT NOT NULL,
    "lei_aplicavel_art" VARCHAR(300),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "idioma" VARCHAR(10) NOT NULL DEFAULT 'pt-AO',
    "uso_count" INTEGER NOT NULL DEFAULT 0,
    "origem_contrato_id" UUID,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "search_vector" tsvector,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "clausulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "numero_interno" VARCHAR(50) NOT NULL,
    "titulo" VARCHAR(300) NOT NULL,
    "descricao" TEXT,
    "tipo_id" UUID NOT NULL,
    "carteira_id" UUID,
    "parent_contrato_id" UUID,
    "estado" "ContratoEstado" NOT NULL DEFAULT 'INTAKE',
    "origem" "ContratoOrigem" NOT NULL,
    "modo_engajamento" VARCHAR(20),
    "valor" BIGINT,
    "moeda" VARCHAR(3),
    "valor_em_akz" BIGINT,
    "taxa_cambio" DECIMAL(18,6),
    "lei_aplicavel" VARCHAR(100),
    "foro" VARCHAR(200),
    "data_assinatura" DATE,
    "data_inicio_vigencia" DATE,
    "data_termo" DATE,
    "renovacao_automatica" BOOLEAN NOT NULL DEFAULT false,
    "janela_denuncia_dias" INTEGER,
    "prazo_indeterminado" BOOLEAN NOT NULL DEFAULT false,
    "override_notario" BOOLEAN,
    "override_registos" TEXT[],
    "responsavel_id" UUID,
    "search_vector" tsvector,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_versoes" (
    "id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "versao" VARCHAR(20) NOT NULL,
    "ordem" INTEGER NOT NULL,
    "direccao" "VersaoDireccao" NOT NULL,
    "document_id" UUID,
    "hash_sha256" VARCHAR(64),
    "selo_temporal" TIMESTAMPTZ,
    "comentario" TEXT,
    "criado_por" UUID NOT NULL,
    "extracao" JSONB,
    "extracao_status" "ExtracaoStatus",
    "extracao_confianca" DECIMAL(5,4),
    "extracao_em" TIMESTAMPTZ,
    "diff_vs_anterior_id" UUID,
    "diff_resumo" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contrato_versoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_partes" (
    "id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "entidade_id" UUID NOT NULL,
    "papel" "PartePapel" NOT NULL,
    "representante_nome" VARCHAR(200),
    "representante_cargo" VARCHAR(100),
    "representante_bi" VARCHAR(30),
    "procuracao_document_id" UUID,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contrato_partes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_datas_chave" (
    "id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "tipo" "DataChaveTipo" NOT NULL,
    "data" DATE NOT NULL,
    "descricao" TEXT,
    "alerta_dias" INTEGER[] DEFAULT ARRAY[90, 30, 7]::INTEGER[],
    "cumprida" BOOLEAN NOT NULL DEFAULT false,
    "cumprida_em" TIMESTAMPTZ,
    "cumprida_por" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contrato_datas_chave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_obrigacoes" (
    "id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "parte_responsavel_id" UUID NOT NULL,
    "tipo" "ObrigacaoTipo" NOT NULL,
    "descricao" TEXT NOT NULL,
    "periodicidade" "ObrigacaoPeriodicidade" NOT NULL,
    "proxima_data" DATE,
    "ultima_data" DATE,
    "valor_esperado" BIGINT,
    "moeda" VARCHAR(3),
    "alerta_dias" INTEGER[] DEFAULT ARRAY[15, 5]::INTEGER[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contrato_obrigacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_obrigacao_instancias" (
    "id" UUID NOT NULL,
    "obrigacao_id" UUID NOT NULL,
    "data_prevista" DATE NOT NULL,
    "data_real" DATE,
    "estado" "ObrigacaoInstanciaEstado" NOT NULL DEFAULT 'PENDENTE',
    "valor_real" BIGINT,
    "comprovativo_id" UUID,
    "observacoes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contrato_obrigacao_instancias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_actos_regulatorios" (
    "id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "tipo" "ActoRegulatorioTipo" NOT NULL,
    "tgis_verba_numero" VARCHAR(20),
    "base_tributavel" BIGINT,
    "base_moeda" VARCHAR(3),
    "valor_liquidar" BIGINT,
    "registo_entidade" VARCHAR(100),
    "registo_referencia" VARCHAR(200),
    "prazo_limite" DATE,
    "estado" "ActoEstado" NOT NULL DEFAULT 'PENDENTE',
    "concluido_em" TIMESTAMPTZ,
    "comprovativo_id" UUID,
    "responsavel_id" UUID,
    "observacoes" TEXT,
    "custo_em_akz" BIGINT,
    "detectado_automaticamente" BOOLEAN NOT NULL DEFAULT false,
    "regra_id" VARCHAR(80),
    "regra_versao" VARCHAR(20),
    "referencia_legal" TEXT,
    "disclaimer" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contrato_actos_regulatorios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_negociacao_pontos" (
    "id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "clausula_ref" VARCHAR(200) NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "resumo" TEXT NOT NULL,
    "posicao_nos" TEXT,
    "posicao_contraparte" TEXT,
    "acordo_final" TEXT,
    "estado" "NegociacaoPontoEstado" NOT NULL DEFAULT 'ABERTO',
    "criticidade" "NegociacaoPontoCriticidade" NOT NULL DEFAULT 'MEDIA',
    "versao_introduzida_id" UUID,
    "versao_resolvida_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by" UUID,

    CONSTRAINT "contrato_negociacao_pontos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_eventos" (
    "id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "tipo" VARCHAR(60) NOT NULL,
    "resumo" TEXT,
    "payload" JSONB,
    "actor_user_id" UUID,
    "actor_tipo" VARCHAR(40),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contrato_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_terminacoes" (
    "id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "tipo" "TerminacaoTipo" NOT NULL,
    "data_efectiva" DATE NOT NULL,
    "motivacao" TEXT,
    "documento_id" UUID,
    "obrigacoes_pos_termo" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "contrato_terminacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importacao_lotes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "iniciado_por" UUID NOT NULL,
    "estado" "LoteEstado" NOT NULL DEFAULT 'EM_FILA',
    "total_linhas" INTEGER NOT NULL DEFAULT 0,
    "processadas" INTEGER NOT NULL DEFAULT 0,
    "falhas" INTEGER NOT NULL DEFAULT 0,
    "iniciado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluido_em" TIMESTAMPTZ,
    "resumo_erros" JSONB,

    CONSTRAINT "importacao_lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importacao_linhas" (
    "id" UUID NOT NULL,
    "lote_id" UUID NOT NULL,
    "document_id" UUID,
    "metadata_input" JSONB,
    "estado" "LinhaEstado" NOT NULL DEFAULT 'PENDENTE',
    "texto_ocr" TEXT,
    "extracao" JSONB,
    "contrato_id" UUID,
    "erros" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "importacao_linhas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contrato_id" UUID,
    "nome" VARCHAR(300) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "tamanho_bytes" BIGINT NOT NULL,
    "hash_sha256" VARCHAR(64),
    "storage_type" "DocumentStorageType" NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "actor_user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(60) NOT NULL,
    "entity_id" UUID,
    "before_data" JSONB,
    "after_data" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "contexto" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" "AIMessageRole" NOT NULL,
    "conteudo" TEXT NOT NULL,
    "citacoes" JSONB,
    "tokens_input" INTEGER,
    "tokens_output" INTEGER,
    "modelo" VARCHAR(60),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legislation_documents" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(80) NOT NULL,
    "titulo" VARCHAR(300) NOT NULL,
    "diploma" VARCHAR(200) NOT NULL,
    "publicacao" DATE,
    "em_vigor_desde" DATE,
    "em_vigor_ate" DATE,
    "url" VARCHAR(500),
    "conteudo" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "legislation_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legislation_chunks" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "artigo" VARCHAR(40),
    "trecho" TEXT NOT NULL,
    "embedding" vector(1536),
    "ordem" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legislation_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan" "TenantPlan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "trial_ends_at" TIMESTAMPTZ,
    "current_period_start" TIMESTAMPTZ NOT NULL,
    "current_period_end" TIMESTAMPTZ NOT NULL,
    "cancelled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_quotas" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contratos_limit" INTEGER NOT NULL,
    "contratos_usado" INTEGER NOT NULL DEFAULT 0,
    "utilizadores_limit" INTEGER NOT NULL,
    "utilizadores_usado" INTEGER NOT NULL DEFAULT 0,
    "storage_gb_limit" INTEGER NOT NULL,
    "storage_bytes_usado" BIGINT NOT NULL DEFAULT 0,
    "ia_messages_limit" INTEGER NOT NULL,
    "ia_messages_usado" INTEGER NOT NULL DEFAULT 0,
    "periodo_inicio" DATE NOT NULL,
    "periodo_fim" DATE NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "usage_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "tipo" VARCHAR(80) NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "conteudo" TEXT NOT NULL,
    "payload" JSONB,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "enviado_em" TIMESTAMPTZ,
    "lido_em" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "prefixo" VARCHAR(12) NOT NULL,
    "key_hash" VARCHAR(200) NOT NULL,
    "scopes" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "events" TEXT[],
    "secret" VARCHAR(200) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL,
    "webhook_id" UUID NOT NULL,
    "event" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "response_status" INTEGER,
    "response_body" TEXT,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "proxima_tentativa" TIMESTAMPTZ,
    "entregue_em" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_parent_tenant_id_idx" ON "tenants"("parent_tenant_id");

-- CreateIndex
CREATE INDEX "tenants_slug_idx" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "memberships_tenant_id_idx" ON "memberships"("tenant_id");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_tenant_id_key" ON "memberships"("user_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_token_hash_key" ON "user_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "entidades_tenant_id_idx" ON "entidades"("tenant_id");

-- CreateIndex
CREATE INDEX "entidades_tenant_id_nome_idx" ON "entidades"("tenant_id", "nome");

-- CreateIndex
CREATE INDEX "entidades_tenant_id_nif_idx" ON "entidades"("tenant_id", "nif");

-- CreateIndex
CREATE INDEX "entidades_search_vector_idx" ON "entidades" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "entidade_contactos_entidade_id_idx" ON "entidade_contactos"("entidade_id");

-- CreateIndex
CREATE INDEX "entidade_documentos_kyc_entidade_id_idx" ON "entidade_documentos_kyc"("entidade_id");

-- CreateIndex
CREATE INDEX "carteiras_tenant_id_idx" ON "carteiras"("tenant_id");

-- CreateIndex
CREATE INDEX "tipos_contrato_categoria_idx" ON "tipos_contrato"("categoria");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_contrato_tenant_id_codigo_key" ON "tipos_contrato"("tenant_id", "codigo");

-- CreateIndex
CREATE INDEX "templates_tenant_id_tipo_id_idx" ON "templates"("tenant_id", "tipo_id");

-- CreateIndex
CREATE INDEX "clausulas_tenant_id_categoria_idx" ON "clausulas"("tenant_id", "categoria");

-- CreateIndex
CREATE INDEX "clausulas_search_vector_idx" ON "clausulas" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "contratos_tenant_id_estado_idx" ON "contratos"("tenant_id", "estado");

-- CreateIndex
CREATE INDEX "contratos_tenant_id_data_termo_idx" ON "contratos"("tenant_id", "data_termo");

-- CreateIndex
CREATE INDEX "contratos_tenant_id_tipo_id_idx" ON "contratos"("tenant_id", "tipo_id");

-- CreateIndex
CREATE INDEX "contratos_tenant_id_responsavel_id_idx" ON "contratos"("tenant_id", "responsavel_id");

-- CreateIndex
CREATE INDEX "contratos_tenant_id_carteira_id_idx" ON "contratos"("tenant_id", "carteira_id");

-- CreateIndex
CREATE INDEX "contratos_parent_contrato_id_idx" ON "contratos"("parent_contrato_id");

-- CreateIndex
CREATE INDEX "contratos_search_vector_idx" ON "contratos" USING GIN ("search_vector");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_tenant_id_numero_interno_key" ON "contratos"("tenant_id", "numero_interno");

-- CreateIndex
CREATE INDEX "contrato_versoes_contrato_id_idx" ON "contrato_versoes"("contrato_id");

-- CreateIndex
CREATE UNIQUE INDEX "contrato_versoes_contrato_id_ordem_key" ON "contrato_versoes"("contrato_id", "ordem");

-- CreateIndex
CREATE INDEX "contrato_partes_contrato_id_idx" ON "contrato_partes"("contrato_id");

-- CreateIndex
CREATE INDEX "contrato_partes_entidade_id_idx" ON "contrato_partes"("entidade_id");

-- CreateIndex
CREATE INDEX "contrato_datas_chave_contrato_id_data_idx" ON "contrato_datas_chave"("contrato_id", "data");

-- CreateIndex
CREATE INDEX "contrato_datas_chave_data_cumprida_idx" ON "contrato_datas_chave"("data", "cumprida");

-- CreateIndex
CREATE INDEX "contrato_obrigacoes_contrato_id_idx" ON "contrato_obrigacoes"("contrato_id");

-- CreateIndex
CREATE INDEX "contrato_obrigacoes_proxima_data_idx" ON "contrato_obrigacoes"("proxima_data");

-- CreateIndex
CREATE INDEX "contrato_obrigacao_instancias_obrigacao_id_data_prevista_idx" ON "contrato_obrigacao_instancias"("obrigacao_id", "data_prevista");

-- CreateIndex
CREATE INDEX "contrato_obrigacao_instancias_data_prevista_estado_idx" ON "contrato_obrigacao_instancias"("data_prevista", "estado");

-- CreateIndex
CREATE INDEX "contrato_actos_regulatorios_contrato_id_estado_idx" ON "contrato_actos_regulatorios"("contrato_id", "estado");

-- CreateIndex
CREATE INDEX "contrato_actos_regulatorios_prazo_limite_estado_idx" ON "contrato_actos_regulatorios"("prazo_limite", "estado");

-- CreateIndex
CREATE INDEX "contrato_actos_regulatorios_tipo_idx" ON "contrato_actos_regulatorios"("tipo");

-- CreateIndex
CREATE INDEX "contrato_negociacao_pontos_contrato_id_estado_idx" ON "contrato_negociacao_pontos"("contrato_id", "estado");

-- CreateIndex
CREATE INDEX "contrato_eventos_contrato_id_created_at_idx" ON "contrato_eventos"("contrato_id", "created_at");

-- CreateIndex
CREATE INDEX "contrato_eventos_tipo_idx" ON "contrato_eventos"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "contrato_terminacoes_contrato_id_key" ON "contrato_terminacoes"("contrato_id");

-- CreateIndex
CREATE INDEX "importacao_lotes_tenant_id_estado_idx" ON "importacao_lotes"("tenant_id", "estado");

-- CreateIndex
CREATE INDEX "importacao_linhas_lote_id_estado_idx" ON "importacao_linhas"("lote_id", "estado");

-- CreateIndex
CREATE INDEX "documents_tenant_id_idx" ON "documents"("tenant_id");

-- CreateIndex
CREATE INDEX "documents_contrato_id_idx" ON "documents"("contrato_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "ai_conversations_tenant_id_user_id_idx" ON "ai_conversations"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "ai_messages_conversation_id_idx" ON "ai_messages"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "legislation_documents_codigo_key" ON "legislation_documents"("codigo");

-- CreateIndex
CREATE INDEX "legislation_chunks_document_id_idx" ON "legislation_chunks"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_tenant_id_key" ON "subscriptions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "usage_quotas_tenant_id_key" ON "usage_quotas"("tenant_id");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_user_id_status_idx" ON "notifications"("tenant_id", "user_id", "status");

-- CreateIndex
CREATE INDEX "notifications_status_created_at_idx" ON "notifications"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_tenant_id_idx" ON "api_keys"("tenant_id");

-- CreateIndex
CREATE INDEX "webhooks_tenant_id_idx" ON "webhooks"("tenant_id");

-- CreateIndex
CREATE INDEX "webhook_deliveries_webhook_id_status_idx" ON "webhook_deliveries"("webhook_id", "status");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_parent_tenant_id_fkey" FOREIGN KEY ("parent_tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entidades" ADD CONSTRAINT "entidades_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entidade_contactos" ADD CONSTRAINT "entidade_contactos_entidade_id_fkey" FOREIGN KEY ("entidade_id") REFERENCES "entidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entidade_documentos_kyc" ADD CONSTRAINT "entidade_documentos_kyc_entidade_id_fkey" FOREIGN KEY ("entidade_id") REFERENCES "entidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carteiras" ADD CONSTRAINT "carteiras_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipos_contrato" ADD CONSTRAINT "tipos_contrato_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_tipo_id_fkey" FOREIGN KEY ("tipo_id") REFERENCES "tipos_contrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clausulas" ADD CONSTRAINT "clausulas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_tipo_id_fkey" FOREIGN KEY ("tipo_id") REFERENCES "tipos_contrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_carteira_id_fkey" FOREIGN KEY ("carteira_id") REFERENCES "carteiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_parent_contrato_id_fkey" FOREIGN KEY ("parent_contrato_id") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_versoes" ADD CONSTRAINT "contrato_versoes_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_partes" ADD CONSTRAINT "contrato_partes_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_partes" ADD CONSTRAINT "contrato_partes_entidade_id_fkey" FOREIGN KEY ("entidade_id") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_datas_chave" ADD CONSTRAINT "contrato_datas_chave_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_obrigacoes" ADD CONSTRAINT "contrato_obrigacoes_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_obrigacoes" ADD CONSTRAINT "contrato_obrigacoes_parte_responsavel_id_fkey" FOREIGN KEY ("parte_responsavel_id") REFERENCES "contrato_partes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_obrigacao_instancias" ADD CONSTRAINT "contrato_obrigacao_instancias_obrigacao_id_fkey" FOREIGN KEY ("obrigacao_id") REFERENCES "contrato_obrigacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_actos_regulatorios" ADD CONSTRAINT "contrato_actos_regulatorios_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_negociacao_pontos" ADD CONSTRAINT "contrato_negociacao_pontos_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_eventos" ADD CONSTRAINT "contrato_eventos_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_terminacoes" ADD CONSTRAINT "contrato_terminacoes_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacao_lotes" ADD CONSTRAINT "importacao_lotes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacao_linhas" ADD CONSTRAINT "importacao_linhas_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "importacao_lotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legislation_chunks" ADD CONSTRAINT "legislation_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "legislation_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_quotas" ADD CONSTRAINT "usage_quotas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

