-- CreateTable
CREATE TABLE "project_status_reports" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "week_start" TIMESTAMPTZ NOT NULL,
    "health_status" VARCHAR(10) NOT NULL DEFAULT 'GREEN',
    "budget_snapshot" INTEGER,
    "actual_spent_snapshot" INTEGER,
    "ideal_spent_snapshot" INTEGER,
    "hours_logged_minutes" INTEGER NOT NULL DEFAULT 0,
    "milestones_total" INTEGER NOT NULL DEFAULT 0,
    "milestones_completed" INTEGER NOT NULL DEFAULT 0,
    "milestones_overdue" INTEGER NOT NULL DEFAULT 0,
    "risks" JSONB,
    "summary" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "project_status_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_report_project_week" ON "project_status_reports"("project_id", "week_start" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_report_project_week" ON "project_status_reports"("project_id", "week_start");

-- AddForeignKey
ALTER TABLE "project_status_reports" ADD CONSTRAINT "project_status_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_status_reports" ADD CONSTRAINT "project_status_reports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
