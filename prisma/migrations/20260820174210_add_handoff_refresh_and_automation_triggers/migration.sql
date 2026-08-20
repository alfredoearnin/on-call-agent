-- AlterTable
ALTER TABLE "IngestionRun" ADD COLUMN "handoffRefreshedAt" DATETIME;
ALTER TABLE "IngestionRun" ADD COLUMN "handoffRefreshedText" TEXT;

-- CreateTable
CREATE TABLE "AutomationTrigger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "automationKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'triggered',
    "httpStatus" INTEGER,
    "error" TEXT,
    "operator" TEXT NOT NULL,
    "staleWarning" BOOLEAN NOT NULL DEFAULT false,
    "precededById" TEXT,
    "triggeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "AutomationTrigger_automationKey_triggeredAt_idx" ON "AutomationTrigger"("automationKey", "triggeredAt");

-- CreateIndex
CREATE INDEX "AutomationTrigger_triggeredAt_idx" ON "AutomationTrigger"("triggeredAt");
