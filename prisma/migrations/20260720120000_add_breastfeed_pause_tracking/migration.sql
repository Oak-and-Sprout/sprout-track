-- AlterTable
ALTER TABLE "ActiveBreastFeed" ADD COLUMN "pauseDuration" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ActiveBreastFeed" ADD COLUMN "pausedAt" DATETIME;

-- AlterTable
ALTER TABLE "ActiveBreastFeed" ADD COLUMN "firstSide" TEXT;

-- AlterTable
ALTER TABLE "FeedLog" ADD COLUMN "pauseDuration" INTEGER;
