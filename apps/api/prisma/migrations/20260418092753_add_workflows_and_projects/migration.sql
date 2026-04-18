-- AlterTable
ALTER TABLE "processos" ADD COLUMN     "project_id" UUID,
ADD COLUMN     "workflow_id" UUID;

-- CreateTable
CREATE TABLE "workflows" (
    "id" UUID NOT NULL,
    "gabinete_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "scope" VARCHAR(20) NOT NULL,
    "applies_to" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_stages" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "key" VARCHAR(60) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "color" VARCHAR(7),
    "category" VARCHAR(60),
    "sla_hours" INTEGER,
    "allows_parallel" BOOLEAN NOT NULL DEFAULT false,
    "is_terminal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workflow_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processo_stage_instances" (
    "id" UUID NOT NULL,
    "processo_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'EM_CURSO',
    "entered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exited_at" TIMESTAMPTZ,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processo_stage_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "gabinete_id" UUID NOT NULL,
    "cliente_id" UUID,
    "workflow_id" UUID,
    "manager_id" UUID NOT NULL,
    "sponsor_id" UUID,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    "health_status" VARCHAR(10) NOT NULL DEFAULT 'GREEN',
    "scope" TEXT,
    "objectives" TEXT,
    "risks_json" JSONB,
    "start_date" TIMESTAMPTZ,
    "end_date" TIMESTAMPTZ,
    "actual_end_date" TIMESTAMPTZ,
    "budget_amount" INTEGER,
    "budget_currency" VARCHAR(3) NOT NULL DEFAULT 'AKZ',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "allocation_pct" INTEGER,
    "hourly_rate" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_milestones" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "due_date" TIMESTAMPTZ NOT NULL,
    "completed_at" TIMESTAMPTZ,
    "depends_on_id" UUID,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_workflow_gabinete_scope" ON "workflows"("gabinete_id", "scope");

-- CreateIndex
CREATE INDEX "idx_stage_workflow_position" ON "workflow_stages"("workflow_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "uq_stage_workflow_key" ON "workflow_stages"("workflow_id", "key");

-- CreateIndex
CREATE INDEX "idx_stageinst_processo_status" ON "processo_stage_instances"("processo_id", "status");

-- CreateIndex
CREATE INDEX "idx_stageinst_stage" ON "processo_stage_instances"("stage_id");

-- CreateIndex
CREATE INDEX "idx_project_gabinete_status" ON "projects"("gabinete_id", "status");

-- CreateIndex
CREATE INDEX "idx_project_gabinete_category" ON "projects"("gabinete_id", "category");

-- CreateIndex
CREATE INDEX "idx_project_gabinete_manager" ON "projects"("gabinete_id", "manager_id");

-- CreateIndex
CREATE INDEX "idx_project_gabinete_cliente" ON "projects"("gabinete_id", "cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_project_gabinete_code" ON "projects"("gabinete_id", "code");

-- CreateIndex
CREATE INDEX "idx_member_project" ON "project_members"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_member_project_user" ON "project_members"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_milestone_project_position" ON "project_milestones"("project_id", "position");

-- CreateIndex
CREATE INDEX "idx_processo_gabinete_workflow" ON "processos"("gabinete_id", "workflow_id");

-- CreateIndex
CREATE INDEX "idx_processo_gabinete_project" ON "processos"("gabinete_id", "project_id");

-- AddForeignKey
ALTER TABLE "processos" ADD CONSTRAINT "processos_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processos" ADD CONSTRAINT "processos_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_gabinete_id_fkey" FOREIGN KEY ("gabinete_id") REFERENCES "gabinetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_stages" ADD CONSTRAINT "workflow_stages_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processo_stage_instances" ADD CONSTRAINT "processo_stage_instances_processo_id_fkey" FOREIGN KEY ("processo_id") REFERENCES "processos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processo_stage_instances" ADD CONSTRAINT "processo_stage_instances_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "workflow_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_gabinete_id_fkey" FOREIGN KEY ("gabinete_id") REFERENCES "gabinetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_depends_on_id_fkey" FOREIGN KEY ("depends_on_id") REFERENCES "project_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
