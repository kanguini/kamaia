-- CreateTable
CREATE TABLE "project_templates_custom" (
    "id" UUID NOT NULL,
    "gabinete_id" UUID NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "scope_blurb" TEXT,
    "objectives_blurb" TEXT,
    "default_duration_days" INTEGER NOT NULL DEFAULT 30,
    "milestones" JSONB NOT NULL,
    "based_on_system_id" VARCHAR(60),
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "project_templates_custom_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_tplcustom_gabinete_category" ON "project_templates_custom"("gabinete_id", "category");

-- AddForeignKey
ALTER TABLE "project_templates_custom" ADD CONSTRAINT "project_templates_custom_gabinete_id_fkey" FOREIGN KEY ("gabinete_id") REFERENCES "gabinetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
