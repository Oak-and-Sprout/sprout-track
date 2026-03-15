-- CreateTable
CREATE TABLE "ActiveBreastFeed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activeSide" TEXT NOT NULL,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "leftDuration" INTEGER NOT NULL DEFAULT 0,
    "rightDuration" INTEGER NOT NULL DEFAULT 0,
    "currentSideStartTime" DATETIME,
    "sessionStartTime" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "babyId" TEXT NOT NULL,
    "familyId" TEXT,
    "caretakerId" TEXT,
    CONSTRAINT "ActiveBreastFeed_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActiveBreastFeed_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActiveBreastFeed_caretakerId_fkey" FOREIGN KEY ("caretakerId") REFERENCES "Caretaker" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ActiveBreastFeed_babyId_key" ON "ActiveBreastFeed"("babyId");

-- CreateIndex
CREATE INDEX "ActiveBreastFeed_babyId_idx" ON "ActiveBreastFeed"("babyId");

-- CreateIndex
CREATE INDEX "ActiveBreastFeed_familyId_idx" ON "ActiveBreastFeed"("familyId");
