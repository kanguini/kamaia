-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "milestone_id" UUID,
ADD COLUMN     "project_id" UUID,
ADD COLUMN     "task_id" UUID;

-- AlterTable
ALTER TABLE "project_milestones" ADD COLUMN     "budget_cents" INTEGER;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "visibility" VARCHAR(20) NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "milestone_id" UUID,
ADD COLUMN     "project_id" UUID;

-- CreateIndex
CREATE INDEX "idx_document_gabinete_project" ON "documents"("gabinete_id", "project_id");

-- CreateIndex
CREATE INDEX "idx_document_gabinete_milestone" ON "documents"("gabinete_id", "milestone_id");

-- CreateIndex
CREATE INDEX "idx_document_gabinete_task" ON "documents"("gabinete_id", "task_id");

-- CreateIndex
CREATE INDEX "idx_task_project" ON "tasks"("gabinete_id", "project_id");

-- CreateIndex
CREATE INDEX "idx_task_milestone" ON "tasks"("gabinete_id", "milestone_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "project_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "project_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
