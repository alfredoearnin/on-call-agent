-- AlterTable
ALTER TABLE "Monitor" ADD COLUMN "options" TEXT;

-- CreateTable
CREATE TABLE "MonitorAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monitorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "operator" TEXT NOT NULL,
    "error" TEXT,
    "evidenceJson" TEXT,
    "resultSummary" TEXT,
    "recommendationId" TEXT,
    "cacheReadTokens" INTEGER,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "MonitorAnalysis_monitorId_requestedAt_idx" ON "MonitorAnalysis"("monitorId", "requestedAt");

-- CreateIndex
CREATE INDEX "MonitorAnalysis_status_idx" ON "MonitorAnalysis"("status");
