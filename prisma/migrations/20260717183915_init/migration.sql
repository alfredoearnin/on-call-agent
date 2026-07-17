-- CreateTable
CREATE TABLE "IngestionRun" (
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
    "error" TEXT,
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "Monitor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "service" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'Low',
    "tags" TEXT,
    "currentState" TEXT NOT NULL DEFAULT 'Unknown',
    "query" TEXT,
    "message" TEXT,
    "configHash" TEXT,
    "datadogUrl" TEXT,
    "envScope" TEXT,
    "cluster" TEXT,
    "modifiedAt" DATETIME,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MonitorConfigSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monitorId" TEXT NOT NULL,
    "runId" TEXT,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "query" TEXT,
    "message" TEXT,
    "priority" TEXT,
    "thresholds" TEXT,
    "options" TEXT,
    "hash" TEXT NOT NULL,
    CONSTRAINT "MonitorConfigSnapshot_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlertFire" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monitorId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'incident.io',
    "title" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'Low',
    "status" TEXT NOT NULL DEFAULT 'firing',
    "disposition" TEXT,
    "firingKind" TEXT,
    "firedAt" DATETIME NOT NULL,
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
    CONSTRAINT "AlertFire_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "severity" TEXT,
    "classification" TEXT NOT NULL DEFAULT 'operational',
    "service" TEXT,
    "status" TEXT,
    "openedAt" DATETIME NOT NULL,
    "resolvedAt" DATETIME,
    "url" TEXT,
    "redacted" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "TuningRecommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monitorId" TEXT,
    "monitorKey" TEXT NOT NULL,
    "monitorName" TEXT NOT NULL,
    "service" TEXT,
    "issueType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "before" TEXT NOT NULL,
    "after" TEXT NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "coveragePreserved" TEXT,
    "expectedImpact" TEXT,
    "evidence" TEXT,
    "confidence" TEXT NOT NULL DEFAULT 'low',
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "outcome" TEXT,
    "firstSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weeksSeen" INTEGER NOT NULL DEFAULT 1,
    "firesThisWeek" INTEGER NOT NULL DEFAULT 0,
    "autoResolvedPct" INTEGER,
    "nightPages" INTEGER NOT NULL DEFAULT 0,
    "lastFiredAt" DATETIME,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patchJson" TEXT,
    CONSTRAINT "TuningRecommendation_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VulnerabilitySnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "runId" TEXT,
    "total" INTEGER NOT NULL DEFAULT 0,
    "critical" INTEGER NOT NULL DEFAULT 0,
    "high" INTEGER NOT NULL DEFAULT 0,
    "scope" TEXT,
    "source" TEXT
);

-- CreateTable
CREATE TABLE "SyncSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "mode" TEXT NOT NULL DEFAULT 'manual',
    "scheduleCron" TEXT NOT NULL DEFAULT '0 8 * * *',
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastRunAt" DATETIME,
    "lastRunStatus" TEXT,
    "lastRunId" TEXT,
    "nextRunAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AppliedChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monitorId" TEXT,
    "recommendationId" TEXT,
    "targetScope" TEXT NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "beforeJson" TEXT NOT NULL,
    "afterJson" TEXT NOT NULL,
    "diffJson" TEXT,
    "operator" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "datadogResponse" TEXT,
    "error" TEXT,
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revertedAt" DATETIME,
    "revertsId" TEXT,
    CONSTRAINT "AppliedChange_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AppliedChange_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "TuningRecommendation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "IngestionRun_startedAt_idx" ON "IngestionRun"("startedAt");

-- CreateIndex
CREATE INDEX "IngestionRun_windowStart_idx" ON "IngestionRun"("windowStart");

-- CreateIndex
CREATE INDEX "Monitor_service_idx" ON "Monitor"("service");

-- CreateIndex
CREATE INDEX "MonitorConfigSnapshot_monitorId_capturedAt_idx" ON "MonitorConfigSnapshot"("monitorId", "capturedAt");

-- CreateIndex
CREATE INDEX "AlertFire_firedAt_idx" ON "AlertFire"("firedAt");

-- CreateIndex
CREATE INDEX "AlertFire_monitorId_idx" ON "AlertFire"("monitorId");

-- CreateIndex
CREATE INDEX "AlertFire_status_idx" ON "AlertFire"("status");

-- CreateIndex
CREATE INDEX "Incident_openedAt_idx" ON "Incident"("openedAt");

-- CreateIndex
CREATE INDEX "TuningRecommendation_status_idx" ON "TuningRecommendation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TuningRecommendation_monitorKey_issueType_key" ON "TuningRecommendation"("monitorKey", "issueType");

-- CreateIndex
CREATE INDEX "VulnerabilitySnapshot_capturedAt_idx" ON "VulnerabilitySnapshot"("capturedAt");

-- CreateIndex
CREATE INDEX "AppliedChange_monitorId_idx" ON "AppliedChange"("monitorId");

-- CreateIndex
CREATE INDEX "AppliedChange_appliedAt_idx" ON "AppliedChange"("appliedAt");
