-- AlterTable
ALTER TABLE "MonitorConfigSnapshot" ADD COLUMN "actorName" TEXT;
ALTER TABLE "MonitorConfigSnapshot" ADD COLUMN "actorAt" DATETIME;

-- CreateTable
CREATE TABLE "MonitorEditNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monitorId" TEXT NOT NULL,
    "afterHash" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "MonitorEditNote_monitorId_afterHash_createdAt_idx" ON "MonitorEditNote"("monitorId", "afterHash", "createdAt");
