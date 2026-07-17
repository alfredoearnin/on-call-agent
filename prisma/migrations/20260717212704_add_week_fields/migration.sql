-- AlterTable
ALTER TABLE "AlertFire" ADD COLUMN "weekEnd" DATETIME;
ALTER TABLE "AlertFire" ADD COLUMN "weekStart" DATETIME;

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN "weekEnd" DATETIME;
ALTER TABLE "Incident" ADD COLUMN "weekStart" DATETIME;

-- CreateIndex
CREATE INDEX "AlertFire_weekStart_idx" ON "AlertFire"("weekStart");

-- CreateIndex
CREATE INDEX "Incident_weekStart_idx" ON "Incident"("weekStart");
