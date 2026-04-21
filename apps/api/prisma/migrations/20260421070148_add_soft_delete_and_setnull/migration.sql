-- AlterTable
ALTER TABLE "project_milestones" ADD COLUMN     "deleted_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "project_status_reports" ADD COLUMN     "deleted_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "task_check_items" ADD COLUMN     "deleted_at" TIMESTAMPTZ;
