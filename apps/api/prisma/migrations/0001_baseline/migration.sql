-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateTable
CREATE TABLE "gabinetes" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "nif" VARCHAR(20),
    "address" TEXT,
    "phone" VARCHAR(30),
    "email" VARCHAR(200),
    "logo_url" VARCHAR(500),
    "plan" VARCHAR(20) NOT NULL DEFAULT 'PRO_BUSINESS',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "gabinetes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "gabinete_id" UUID NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "password_hash" VARCHAR(200),
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "role" VARCHAR(30) NOT NULL,
    "oaa_number" VARCHAR(30),
    "specialty" VARCHAR(100),
    "phone" VARCHAR(30),
    "avatar_url" VARCHAR(500),
    "provider" VARCHAR(20) NOT NULL DEFAULT 'credentials',
    "provider_id" VARCHAR(200),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token" VARCHAR(500) NOT NULL,
    "user_agent" VARCHAR(500),
    "ip_address" VARCHAR(50),
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL,
    "gabinete_id" UUID NOT NULL,
    "advogado_id" UUID,
    "type" VARCHAR(20) NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "nif" VARCHAR(20),
    "email" VARCHAR(200),
    "phone" VARCHAR(30),
    "address" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processos" (
    "id" UUID NOT NULL,
    "gabinete_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "advogado_id" UUID NOT NULL,
    "processo_number" VARCHAR(30) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "type" VARCHAR(30) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    "stage" VARCHAR(100),
    "court" VARCHAR(200),
    "court_case_number" VARCHAR(50),
    "judge" VARCHAR(200),
    "opposing_party" VARCHAR(300),
    "opposing_lawyer" VARCHAR(200),
    "priority" VARCHAR(10) NOT NULL DEFAULT 'MEDIA',
    "fee_type" VARCHAR(20),
    "fee_amount" INTEGER,
    "notes" TEXT,
    "opened_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "processos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processo_events" (
    "id" UUID NOT NULL,
    "processo_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processo_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prazos" (
    "id" UUID NOT NULL,
    "gabinete_id" UUID NOT NULL,
    "processo_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "type" VARCHAR(30) NOT NULL,
    "due_date" TIMESTAMPTZ NOT NULL,
    "alert_hours_before" INTEGER NOT NULL DEFAULT 48,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    "is_urgent" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "prazos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL,
    "gabinete_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "processo_id" UUID,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "type" VARCHAR(20) NOT NULL,
    "location" VARCHAR(300),
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "reminder_minutes" INTEGER,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "gabinete_id" UUID NOT NULL,
    "processo_id" UUID,
    "uploaded_by_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "file_url" VARCHAR(500) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "gabinete_id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(30) NOT NULL,
    "entity" VARCHAR(30) NOT NULL,
    "entity_id" VARCHAR(50),
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" VARCHAR(50),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" UUID NOT NULL,
    "gabinete_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(300),
    "context" VARCHAR(20) NOT NULL DEFAULT 'GERAL',
    "context_id" UUID,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER,
    "model" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "gabinete_id" UUID NOT NULL,
    "plan" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "current_period_start" TIMESTAMPTZ NOT NULL,
    "current_period_end" TIMESTAMPTZ NOT NULL,
    "cancelled_at" TIMESTAMPTZ,
    "stripe_customer_id" VARCHAR(100),
    "stripe_subscription_id" VARCHAR(100),
    "multicaixa_ref" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_quotas" (
    "id" UUID NOT NULL,
    "gabinete_id" UUID NOT NULL,
    "ai_queries_used" INTEGER NOT NULL DEFAULT 0,
    "doc_analyses_used" INTEGER NOT NULL DEFAULT 0,
    "storage_used_bytes" BIGINT NOT NULL DEFAULT 0,
    "period_start" TIMESTAMPTZ NOT NULL,
    "period_end" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "usage_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" UUID NOT NULL,
    "gabinete_id" UUID NOT NULL,
    "processo_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "description" TEXT,
    "date" DATE NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "gabinete_id" UUID NOT NULL,
    "processo_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "gabinete_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "prazo_id" UUID,
    "type" VARCHAR(30) NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "subject" VARCHAR(300),
    "body" TEXT,
    "metadata" JSONB,
    "sent_at" TIMESTAMPTZ,
    "error_message" TEXT,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" VARCHAR(2000) NOT NULL,
    "p256dh" VARCHAR(500) NOT NULL,
    "auth" VARCHAR(500) NOT NULL,
    "user_agent" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
    "sms_only_urgent" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legislation_documents" (
    "id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "short_name" VARCHAR(50) NOT NULL,
    "reference" VARCHAR(200) NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "source_url" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legislation_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legislation_chunks" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(768),
    "token_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legislation_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gabinetes_nif_key" ON "gabinetes"("nif");

-- CreateIndex
CREATE INDEX "idx_user_gabinete" ON "users"("gabinete_id");

-- CreateIndex
CREATE INDEX "idx_user_gabinete_role" ON "users"("gabinete_id", "role");

-- CreateIndex
CREATE INDEX "idx_user_email" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_gabinete_email" ON "users"("gabinete_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_provider" ON "users"("provider", "provider_id");

-- CreateIndex
CREATE INDEX "idx_session_user" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "idx_session_token" ON "user_sessions"("refresh_token");

-- CreateIndex
CREATE INDEX "idx_cliente_gabinete" ON "clientes"("gabinete_id");

-- CreateIndex
CREATE INDEX "idx_cliente_gabinete_advogado" ON "clientes"("gabinete_id", "advogado_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_cliente_gabinete_nif" ON "clientes"("gabinete_id", "nif");

-- CreateIndex
CREATE INDEX "idx_processo_gabinete" ON "processos"("gabinete_id");

-- CreateIndex
CREATE INDEX "idx_processo_gabinete_status" ON "processos"("gabinete_id", "status");

-- CreateIndex
CREATE INDEX "idx_processo_gabinete_advogado" ON "processos"("gabinete_id", "advogado_id");

-- CreateIndex
CREATE INDEX "idx_processo_gabinete_cliente" ON "processos"("gabinete_id", "cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_processo_gabinete_number" ON "processos"("gabinete_id", "processo_number");

-- CreateIndex
CREATE INDEX "idx_evento_processo" ON "processo_events"("processo_id");

-- CreateIndex
CREATE INDEX "idx_prazo_gabinete_due" ON "prazos"("gabinete_id", "due_date");

-- CreateIndex
CREATE INDEX "idx_prazo_gabinete_status" ON "prazos"("gabinete_id", "status");

-- CreateIndex
CREATE INDEX "idx_calendar_gabinete_start" ON "calendar_events"("gabinete_id", "start_at");

-- CreateIndex
CREATE INDEX "idx_calendar_user_start" ON "calendar_events"("user_id", "start_at");

-- CreateIndex
CREATE INDEX "idx_document_gabinete" ON "documents"("gabinete_id");

-- CreateIndex
CREATE INDEX "idx_document_gabinete_processo" ON "documents"("gabinete_id", "processo_id");

-- CreateIndex
CREATE INDEX "idx_audit_gabinete" ON "audit_logs"("gabinete_id");

-- CreateIndex
CREATE INDEX "idx_audit_gabinete_entity" ON "audit_logs"("gabinete_id", "entity");

-- CreateIndex
CREATE INDEX "idx_audit_gabinete_user" ON "audit_logs"("gabinete_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_audit_created" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_ai_conv_gabinete_user" ON "ai_conversations"("gabinete_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_ai_msg_conversation" ON "ai_messages"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_gabinete_id_key" ON "subscriptions"("gabinete_id");

-- CreateIndex
CREATE UNIQUE INDEX "usage_quotas_gabinete_id_key" ON "usage_quotas"("gabinete_id");

-- CreateIndex
CREATE INDEX "idx_timeentry_gabinete_date" ON "time_entries"("gabinete_id", "date");

-- CreateIndex
CREATE INDEX "idx_timeentry_gabinete_processo" ON "time_entries"("gabinete_id", "processo_id");

-- CreateIndex
CREATE INDEX "idx_timeentry_gabinete_user" ON "time_entries"("gabinete_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_expense_gabinete_date" ON "expenses"("gabinete_id", "date");

-- CreateIndex
CREATE INDEX "idx_expense_gabinete_processo" ON "expenses"("gabinete_id", "processo_id");

-- CreateIndex
CREATE INDEX "idx_notification_user" ON "notifications"("gabinete_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_notification_prazo" ON "notifications"("prazo_id");

-- CreateIndex
CREATE INDEX "idx_notification_created" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "idx_push_user" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE INDEX "idx_legislation_category" ON "legislation_documents"("category");

-- CreateIndex
CREATE INDEX "idx_legislation_short_name" ON "legislation_documents"("short_name");

-- CreateIndex
CREATE INDEX "idx_chunk_document" ON "legislation_chunks"("document_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_gabinete_id_fkey" FOREIGN KEY ("gabinete_id") REFERENCES "gabinetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_gabinete_id_fkey" FOREIGN KEY ("gabinete_id") REFERENCES "gabinetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_advogado_id_fkey" FOREIGN KEY ("advogado_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processos" ADD CONSTRAINT "processos_gabinete_id_fkey" FOREIGN KEY ("gabinete_id") REFERENCES "gabinetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processos" ADD CONSTRAINT "processos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processos" ADD CONSTRAINT "processos_advogado_id_fkey" FOREIGN KEY ("advogado_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processo_events" ADD CONSTRAINT "processo_events_processo_id_fkey" FOREIGN KEY ("processo_id") REFERENCES "processos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processo_events" ADD CONSTRAINT "processo_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prazos" ADD CONSTRAINT "prazos_gabinete_id_fkey" FOREIGN KEY ("gabinete_id") REFERENCES "gabinetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prazos" ADD CONSTRAINT "prazos_processo_id_fkey" FOREIGN KEY ("processo_id") REFERENCES "processos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_gabinete_id_fkey" FOREIGN KEY ("gabinete_id") REFERENCES "gabinetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_processo_id_fkey" FOREIGN KEY ("processo_id") REFERENCES "processos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_gabinete_id_fkey" FOREIGN KEY ("gabinete_id") REFERENCES "gabinetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_processo_id_fkey" FOREIGN KEY ("processo_id") REFERENCES "processos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_gabinete_id_fkey" FOREIGN KEY ("gabinete_id") REFERENCES "gabinetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_gabinete_id_fkey" FOREIGN KEY ("gabinete_id") REFERENCES "gabinetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_gabinete_id_fkey" FOREIGN KEY ("gabinete_id") REFERENCES "gabinetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_quotas" ADD CONSTRAINT "usage_quotas_gabinete_id_fkey" FOREIGN KEY ("gabinete_id") REFERENCES "gabinetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_gabinete_id_fkey" FOREIGN KEY ("gabinete_id") REFERENCES "gabinetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_processo_id_fkey" FOREIGN KEY ("processo_id") REFERENCES "processos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_gabinete_id_fkey" FOREIGN KEY ("gabinete_id") REFERENCES "gabinetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_processo_id_fkey" FOREIGN KEY ("processo_id") REFERENCES "processos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_gabinete_id_fkey" FOREIGN KEY ("gabinete_id") REFERENCES "gabinetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legislation_chunks" ADD CONSTRAINT "legislation_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "legislation_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

