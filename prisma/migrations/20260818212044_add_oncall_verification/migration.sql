-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_IngestionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "windowStart" DATETIME NOT NULL,
    "windowEnd" DATETIME NOT NULL,
    "daysElapsed" REAL NOT NULL DEFAULT 0,
    "mode" TEXT NOT NULL DEFAULT 'manual',
    "trigger" TEXT NOT NULL DEFAULT 'manual_cli',
    "status" TEXT NOT NULL DEFAULT 'running',
    "datadogStatus" TEXT NOT NULL DEFAULT 'skipped',
    "incidentioStatus" TEXT NOT NULL DEFAULT 'skipped',
    "jiraStatus" TEXT NOT NULL DEFAULT 'skipped',
    "totalAlerts" INTEGER NOT NULL DEFAULT 0,
    "highAlerts" INTEGER NOT NULL DEFAULT 0,
    "lowAlerts" INTEGER NOT NULL DEFAULT 0,
    "humanAttention" INTEGER NOT NULL DEFAULT 0,
    "autoResolved" INTEGER NOT NULL DEFAULT 0,
    "incidentsCount" INTEGER NOT NULL DEFAULT 0,
    "escalationRateNum" INTEGER NOT NULL DEFAULT 0,
    "escalationRateDen" INTEGER NOT NULL DEFAULT 0,
    "activeFiring" INTEGER NOT NULL DEFAULT 0,
    "staleFiring" INTEGER NOT NULL DEFAULT 0,
    "runRateWeekly" REAL,
    "priorWeekTotal" INTEGER,
    "trend" TEXT,
    "primaryOnCall" TEXT,
    "secondaryOnCall" TEXT,
    "nextPrimaryOnCall" TEXT,
    "nextSecondaryOnCall" TEXT,
    "onCallUnverified" BOOLEAN NOT NULL DEFAULT false,
    "onCallVerifiedAsOf" TEXT,
    "error" TEXT,
    "notes" TEXT
);
INSERT INTO "new_IngestionRun" ("activeFiring", "autoResolved", "datadogStatus", "daysElapsed", "error", "escalationRateDen", "escalationRateNum", "finishedAt", "highAlerts", "humanAttention", "id", "incidentioStatus", "incidentsCount", "jiraStatus", "lowAlerts", "mode", "nextPrimaryOnCall", "nextSecondaryOnCall", "notes", "primaryOnCall", "priorWeekTotal", "runRateWeekly", "secondaryOnCall", "staleFiring", "startedAt", "status", "totalAlerts", "trend", "trigger", "windowEnd", "windowStart") SELECT "activeFiring", "autoResolved", "datadogStatus", "daysElapsed", "error", "escalationRateDen", "escalationRateNum", "finishedAt", "highAlerts", "humanAttention", "id", "incidentioStatus", "incidentsCount", "jiraStatus", "lowAlerts", "mode", "nextPrimaryOnCall", "nextSecondaryOnCall", "notes", "primaryOnCall", "priorWeekTotal", "runRateWeekly", "secondaryOnCall", "staleFiring", "startedAt", "status", "totalAlerts", "trend", "trigger", "windowEnd", "windowStart" FROM "IngestionRun";
DROP TABLE "IngestionRun";
ALTER TABLE "new_IngestionRun" RENAME TO "IngestionRun";
CREATE INDEX "IngestionRun_startedAt_idx" ON "IngestionRun"("startedAt");
CREATE INDEX "IngestionRun_windowStart_idx" ON "IngestionRun"("windowStart");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
