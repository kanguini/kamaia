-- AlterTable: soft delete para conversas do Dr. Kamaia
ALTER TABLE "ai_conversations" ADD COLUMN "deleted_at" TIMESTAMPTZ;
