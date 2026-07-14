-- AlterTable
ALTER TABLE "FeedLog" ADD COLUMN "sourcePumpId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "FeedLog_sourcePumpId_key" ON "FeedLog"("sourcePumpId");
