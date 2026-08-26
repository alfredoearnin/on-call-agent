-- CreateTable
CREATE TABLE "OwnershipDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "service" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetTeam" TEXT,
    "verdict" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "decidedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "OwnershipDecision_service_decidedAt_idx" ON "OwnershipDecision"("service", "decidedAt");

-- CreateIndex
CREATE INDEX "OwnershipDecision_decidedAt_idx" ON "OwnershipDecision"("decidedAt");
