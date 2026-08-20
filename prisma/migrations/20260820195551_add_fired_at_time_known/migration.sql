-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AlertFire" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monitorId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'incident.io',
    "title" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'Low',
    "status" TEXT NOT NULL DEFAULT 'firing',
    "disposition" TEXT,
    "firingKind" TEXT,
    "firedAt" DATETIME NOT NULL,
    "firedAtTimeKnown" BOOLEAN NOT NULL DEFAULT true,
    "resolvedAt" DATETIME,
    "ackedBy" TEXT,
    "ackLatencySec" INTEGER,
    "escalationStatus" TEXT,
    "env" TEXT,
    "cluster" TEXT,
    "timesFired" INTEGER NOT NULL DEFAULT 1,
    "finding" TEXT,
    "redacted" BOOLEAN NOT NULL DEFAULT false,
    "firstRunId" TEXT,
    "lastRunId" TEXT,
    "weekStart" DATETIME,
    "weekEnd" DATETIME,
    CONSTRAINT "AlertFire_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AlertFire" ("ackLatencySec", "ackedBy", "cluster", "disposition", "env", "escalationStatus", "finding", "firedAt", "firingKind", "firstRunId", "id", "lastRunId", "monitorId", "priority", "redacted", "resolvedAt", "source", "status", "timesFired", "title", "weekEnd", "weekStart") SELECT "ackLatencySec", "ackedBy", "cluster", "disposition", "env", "escalationStatus", "finding", "firedAt", "firingKind", "firstRunId", "id", "lastRunId", "monitorId", "priority", "redacted", "resolvedAt", "source", "status", "timesFired", "title", "weekEnd", "weekStart" FROM "AlertFire";
DROP TABLE "AlertFire";
ALTER TABLE "new_AlertFire" RENAME TO "AlertFire";
CREATE INDEX "AlertFire_firedAt_idx" ON "AlertFire"("firedAt");
CREATE INDEX "AlertFire_monitorId_idx" ON "AlertFire"("monitorId");
CREATE INDEX "AlertFire_status_idx" ON "AlertFire"("status");
CREATE INDEX "AlertFire_weekStart_idx" ON "AlertFire"("weekStart");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
