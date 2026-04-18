-- CreateTable
CREATE TABLE "holidays" (
    "id" UUID NOT NULL,
    "gabinete_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "date" DATE NOT NULL,
    "kind" VARCHAR(20) NOT NULL DEFAULT 'NATIONAL',
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_holiday_date" ON "holidays"("date");

-- CreateIndex
CREATE INDEX "idx_holiday_gabinete" ON "holidays"("gabinete_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_holiday_gabinete_date_name" ON "holidays"("gabinete_id", "date", "name");

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_gabinete_id_fkey" FOREIGN KEY ("gabinete_id") REFERENCES "gabinetes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
