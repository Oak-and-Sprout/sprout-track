-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DiaperLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "time" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "condition" TEXT,
    "color" TEXT,
    "blowout" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "familyId" TEXT,
    "babyId" TEXT NOT NULL,
    "caretakerId" TEXT,
    CONSTRAINT "DiaperLog_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DiaperLog_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DiaperLog_caretakerId_fkey" FOREIGN KEY ("caretakerId") REFERENCES "Caretaker" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DiaperLog" ("babyId", "caretakerId", "color", "condition", "createdAt", "deletedAt", "familyId", "id", "time", "type", "updatedAt") SELECT "babyId", "caretakerId", "color", "condition", "createdAt", "deletedAt", "familyId", "id", "time", "type", "updatedAt" FROM "DiaperLog";
DROP TABLE "DiaperLog";
ALTER TABLE "new_DiaperLog" RENAME TO "DiaperLog";
CREATE INDEX "DiaperLog_time_idx" ON "DiaperLog"("time");
CREATE INDEX "DiaperLog_babyId_idx" ON "DiaperLog"("babyId");
CREATE INDEX "DiaperLog_caretakerId_idx" ON "DiaperLog"("caretakerId");
CREATE INDEX "DiaperLog_deletedAt_idx" ON "DiaperLog"("deletedAt");
CREATE INDEX "DiaperLog_familyId_idx" ON "DiaperLog"("familyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
