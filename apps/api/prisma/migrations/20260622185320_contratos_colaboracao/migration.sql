-- CreateEnum
CREATE TYPE "ColaboradorTipoAcesso" AS ENUM ('LEITURA', 'COMENTARIO', 'ASSINATURA');

-- CreateEnum
CREATE TYPE "ColaboradorEstado" AS ENUM ('PENDENTE', 'ACTIVO', 'REVOGADO', 'EXPIRADO');

-- CreateEnum
CREATE TYPE "ComentarioAutorTipo" AS ENUM ('USER', 'COLABORADOR');

-- CreateEnum
CREATE TYPE "AssinaturaMetodo" AS ENUM ('DESENHADA_BROWSER', 'MANUSCRITA_DIGITALIZADA', 'CERTIFICADO_DIGITAL', 'PIN_SMS');

-- CreateEnum
CREATE TYPE "AssinaturaEstado" AS ENUM ('PENDENTE', 'ASSINADA', 'REJEITADA', 'REVOGADA');

-- AlterTable
ALTER TABLE "contrato_versoes" ADD COLUMN     "corpo_html" TEXT,
ADD COLUMN     "corpo_markdown" TEXT,
ADD COLUMN     "gerado_por_ia" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "contrato_colaboradores" (
    "id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "nome" VARCHAR(200),
    "tipo_acesso" "ColaboradorTipoAcesso" NOT NULL,
    "estado" "ColaboradorEstado" NOT NULL DEFAULT 'PENDENTE',
    "token_hash" VARCHAR(200) NOT NULL,
    "token_prefix" VARCHAR(8) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "convidado_por" UUID NOT NULL,
    "convidado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aceitou_em" TIMESTAMPTZ,
    "revogado_em" TIMESTAMPTZ,
    "ultima_actividade" TIMESTAMPTZ,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,

    CONSTRAINT "contrato_colaboradores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_comentarios" (
    "id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "versao_id" UUID,
    "clausula_ref" VARCHAR(200) NOT NULL,
    "parent_comentario_id" UUID,
    "autor_tipo" "ComentarioAutorTipo" NOT NULL,
    "autor_user_id" UUID,
    "autor_colaborador_id" UUID,
    "autor_nome" VARCHAR(200) NOT NULL,
    "texto" TEXT NOT NULL,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    "resolvido_em" TIMESTAMPTZ,
    "resolvido_por" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contrato_comentarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_assinaturas" (
    "id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "versao_id" UUID NOT NULL,
    "parte_id" UUID,
    "colaborador_id" UUID,
    "signatario_nome" VARCHAR(200) NOT NULL,
    "signatario_email" VARCHAR(200),
    "signatario_bi" VARCHAR(40),
    "cargo" VARCHAR(100),
    "metodo" "AssinaturaMetodo" NOT NULL,
    "estado" "AssinaturaEstado" NOT NULL DEFAULT 'PENDENTE',
    "imagem_base64" TEXT,
    "imagem_storage_key" VARCHAR(500),
    "hash_contrato_snapshot" VARCHAR(64) NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "geo_cidade" VARCHAR(100),
    "geo_pais" VARCHAR(2),
    "solicitada_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assinada_em" TIMESTAMPTZ,
    "revogada_em" TIMESTAMPTZ,
    "observacoes" TEXT,

    CONSTRAINT "contrato_assinaturas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contrato_colaboradores_token_hash_key" ON "contrato_colaboradores"("token_hash");

-- CreateIndex
CREATE INDEX "contrato_colaboradores_contrato_id_estado_idx" ON "contrato_colaboradores"("contrato_id", "estado");

-- CreateIndex
CREATE INDEX "contrato_colaboradores_email_idx" ON "contrato_colaboradores"("email");

-- CreateIndex
CREATE INDEX "contrato_colaboradores_expires_at_idx" ON "contrato_colaboradores"("expires_at");

-- CreateIndex
CREATE INDEX "contrato_comentarios_contrato_id_resolvido_idx" ON "contrato_comentarios"("contrato_id", "resolvido");

-- CreateIndex
CREATE INDEX "contrato_comentarios_versao_id_idx" ON "contrato_comentarios"("versao_id");

-- CreateIndex
CREATE INDEX "contrato_comentarios_clausula_ref_idx" ON "contrato_comentarios"("clausula_ref");

-- CreateIndex
CREATE INDEX "contrato_assinaturas_contrato_id_estado_idx" ON "contrato_assinaturas"("contrato_id", "estado");

-- CreateIndex
CREATE INDEX "contrato_assinaturas_versao_id_idx" ON "contrato_assinaturas"("versao_id");

-- AddForeignKey
ALTER TABLE "contrato_colaboradores" ADD CONSTRAINT "contrato_colaboradores_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_comentarios" ADD CONSTRAINT "contrato_comentarios_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_comentarios" ADD CONSTRAINT "contrato_comentarios_versao_id_fkey" FOREIGN KEY ("versao_id") REFERENCES "contrato_versoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_comentarios" ADD CONSTRAINT "contrato_comentarios_parent_comentario_id_fkey" FOREIGN KEY ("parent_comentario_id") REFERENCES "contrato_comentarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_comentarios" ADD CONSTRAINT "contrato_comentarios_autor_colaborador_id_fkey" FOREIGN KEY ("autor_colaborador_id") REFERENCES "contrato_colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_assinaturas" ADD CONSTRAINT "contrato_assinaturas_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_assinaturas" ADD CONSTRAINT "contrato_assinaturas_versao_id_fkey" FOREIGN KEY ("versao_id") REFERENCES "contrato_versoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_assinaturas" ADD CONSTRAINT "contrato_assinaturas_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "contrato_colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

