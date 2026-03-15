/*
  Warnings:

  - You are about to drop the column `location` on the `PlayLog` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlayLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "duration" INTEGER,
    "type" TEXT NOT NULL,
    "notes" TEXT,
    "activities" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "familyId" TEXT,
    "babyId" TEXT NOT NULL,
    "caretakerId" TEXT,
    CONSTRAINT "PlayLog_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlayLog_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayLog_caretakerId_fkey" FOREIGN KEY ("caretakerId") REFERENCES "Caretaker" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PlayLog" ("activities", "babyId", "caretakerId", "createdAt", "deletedAt", "duration", "endTime", "familyId", "id", "startTime", "type", "updatedAt") SELECT "activities", "babyId", "caretakerId", "createdAt", "deletedAt", "duration", "endTime", "familyId", "id", "startTime", "type", "updatedAt" FROM "PlayLog";
DROP TABLE "PlayLog";
ALTER TABLE "new_PlayLog" RENAME TO "PlayLog";
CREATE INDEX "PlayLog_startTime_idx" ON "PlayLog"("startTime");
CREATE INDEX "PlayLog_endTime_idx" ON "PlayLog"("endTime");
CREATE INDEX "PlayLog_babyId_idx" ON "PlayLog"("babyId");
CREATE INDEX "PlayLog_caretakerId_idx" ON "PlayLog"("caretakerId");
CREATE INDEX "PlayLog_deletedAt_idx" ON "PlayLog"("deletedAt");
CREATE INDEX "PlayLog_familyId_idx" ON "PlayLog"("familyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
