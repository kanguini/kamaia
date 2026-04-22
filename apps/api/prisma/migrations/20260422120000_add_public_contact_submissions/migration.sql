-- CreateTable
CREATE TABLE "public_contact_submissions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "gabinete" VARCHAR(200),
    "plan" VARCHAR(50),
    "message" TEXT NOT NULL,
    "consented_at" TIMESTAMPTZ,
    "ip_address" VARCHAR(50),
    "user_agent" VARCHAR(500),
    "email_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "email_error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_contact_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_public_contact_created" ON "public_contact_submissions"("created_at");

-- CreateIndex
CREATE INDEX "idx_public_contact_email" ON "public_contact_submissions"("email");
