-- AlterTable
ALTER TABLE "project_milestones" ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "start_date" TIMESTAMPTZ;
