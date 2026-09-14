-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppliedChange" (
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
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "datadogResponse" TEXT,
    "error" TEXT,
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revertedAt" DATETIME,
    "revertsId" TEXT,
    CONSTRAINT "AppliedChange_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AppliedChange_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "TuningRecommendation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AppliedChange" ("afterJson", "appliedAt", "beforeJson", "changeSummary", "datadogResponse", "diffJson", "error", "id", "monitorId", "operator", "recommendationId", "revertedAt", "revertsId", "status", "targetScope") SELECT "afterJson", "appliedAt", "beforeJson", "changeSummary", "datadogResponse", "diffJson", "error", "id", "monitorId", "operator", "recommendationId", "revertedAt", "revertsId", "status", "targetScope" FROM "AppliedChange";
DROP TABLE "AppliedChange";
ALTER TABLE "new_AppliedChange" RENAME TO "AppliedChange";
CREATE INDEX "AppliedChange_monitorId_idx" ON "AppliedChange"("monitorId");
CREATE INDEX "AppliedChange_appliedAt_idx" ON "AppliedChange"("appliedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
