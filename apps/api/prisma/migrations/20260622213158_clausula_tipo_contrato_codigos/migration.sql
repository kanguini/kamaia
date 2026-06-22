-- AlterTable
ALTER TABLE "clausulas" ADD COLUMN     "tipo_contrato_codigos" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "clausulas_tipo_contrato_codigos_idx" ON "clausulas" USING GIN ("tipo_contrato_codigos");
