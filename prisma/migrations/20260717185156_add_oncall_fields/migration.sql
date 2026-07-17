-- AlterTable
ALTER TABLE "IngestionRun" ADD COLUMN "nextPrimaryOnCall" TEXT;
ALTER TABLE "IngestionRun" ADD COLUMN "nextSecondaryOnCall" TEXT;
ALTER TABLE "IngestionRun" ADD COLUMN "primaryOnCall" TEXT;
ALTER TABLE "IngestionRun" ADD COLUMN "secondaryOnCall" TEXT;
