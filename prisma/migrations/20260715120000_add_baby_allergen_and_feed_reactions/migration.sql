-- CreateTable
CREATE TABLE "BabyAllergen" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "allergenType" TEXT NOT NULL DEFAULT 'FOOD',
    "reactionDescription" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "familyId" TEXT,
    "babyId" TEXT NOT NULL,
    "caretakerId" TEXT,
    CONSTRAINT "BabyAllergen_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BabyAllergen_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BabyAllergen_caretakerId_fkey" FOREIGN KEY ("caretakerId") REFERENCES "Caretaker" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FeedLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "time" DATETIME NOT NULL,
    "startTime" DATETIME,
    "endTime" DATETIME,
    "feedDuration" INTEGER,
    "type" TEXT NOT NULL,
    "amount" REAL,
    "unitAbbr" TEXT,
    "side" TEXT,
    "food" TEXT,
    "notes" TEXT,
    "hadReaction" BOOLEAN NOT NULL DEFAULT false,
    "reactionDescription" TEXT,
    "bottleType" TEXT,
    "breastMilkAmount" REAL,
    "sessionId" TEXT,
    "sourcePumpId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "familyId" TEXT,
    "babyId" TEXT NOT NULL,
    "caretakerId" TEXT,
    CONSTRAINT "FeedLog_unitAbbr_fkey" FOREIGN KEY ("unitAbbr") REFERENCES "Unit" ("unitAbbr") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FeedLog_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FeedLog_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeedLog_caretakerId_fkey" FOREIGN KEY ("caretakerId") REFERENCES "Caretaker" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FeedLog" ("amount", "babyId", "bottleType", "breastMilkAmount", "caretakerId", "createdAt", "deletedAt", "endTime", "familyId", "feedDuration", "food", "id", "notes", "sessionId", "side", "sourcePumpId", "startTime", "time", "type", "unitAbbr", "updatedAt") SELECT "amount", "babyId", "bottleType", "breastMilkAmount", "caretakerId", "createdAt", "deletedAt", "endTime", "familyId", "feedDuration", "food", "id", "notes", "sessionId", "side", "sourcePumpId", "startTime", "time", "type", "unitAbbr", "updatedAt" FROM "FeedLog";
DROP TABLE "FeedLog";
ALTER TABLE "new_FeedLog" RENAME TO "FeedLog";
CREATE UNIQUE INDEX "FeedLog_sourcePumpId_key" ON "FeedLog"("sourcePumpId");
CREATE INDEX "FeedLog_time_idx" ON "FeedLog"("time");
CREATE INDEX "FeedLog_startTime_idx" ON "FeedLog"("startTime");
CREATE INDEX "FeedLog_endTime_idx" ON "FeedLog"("endTime");
CREATE INDEX "FeedLog_babyId_idx" ON "FeedLog"("babyId");
CREATE INDEX "FeedLog_caretakerId_idx" ON "FeedLog"("caretakerId");
CREATE INDEX "FeedLog_unitAbbr_idx" ON "FeedLog"("unitAbbr");
CREATE INDEX "FeedLog_deletedAt_idx" ON "FeedLog"("deletedAt");
CREATE INDEX "FeedLog_familyId_idx" ON "FeedLog"("familyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "BabyAllergen_name_idx" ON "BabyAllergen"("name");

-- CreateIndex
CREATE INDEX "BabyAllergen_babyId_idx" ON "BabyAllergen"("babyId");

-- CreateIndex
CREATE INDEX "BabyAllergen_caretakerId_idx" ON "BabyAllergen"("caretakerId");

-- CreateIndex
CREATE INDEX "BabyAllergen_deletedAt_idx" ON "BabyAllergen"("deletedAt");

-- CreateIndex
CREATE INDEX "BabyAllergen_familyId_idx" ON "BabyAllergen"("familyId");

