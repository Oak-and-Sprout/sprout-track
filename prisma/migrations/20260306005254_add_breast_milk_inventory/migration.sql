-- CreateTable
CREATE TABLE "BreastMilkAdjustment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "time" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "unitAbbr" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "familyId" TEXT,
    "babyId" TEXT NOT NULL,
    "caretakerId" TEXT,
    CONSTRAINT "BreastMilkAdjustment_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BreastMilkAdjustment_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BreastMilkAdjustment_caretakerId_fkey" FOREIGN KEY ("caretakerId") REFERENCES "Caretaker" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PumpLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "duration" INTEGER,
    "leftAmount" REAL,
    "rightAmount" REAL,
    "totalAmount" REAL,
    "unitAbbr" TEXT,
    "pumpAction" TEXT NOT NULL DEFAULT 'STORED',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "familyId" TEXT,
    "babyId" TEXT NOT NULL,
    "caretakerId" TEXT,
    CONSTRAINT "PumpLog_unitAbbr_fkey" FOREIGN KEY ("unitAbbr") REFERENCES "Unit" ("unitAbbr") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PumpLog_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PumpLog_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PumpLog_caretakerId_fkey" FOREIGN KEY ("caretakerId") REFERENCES "Caretaker" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PumpLog" ("babyId", "caretakerId", "createdAt", "deletedAt", "duration", "endTime", "familyId", "id", "leftAmount", "notes", "rightAmount", "startTime", "totalAmount", "unitAbbr", "updatedAt") SELECT "babyId", "caretakerId", "createdAt", "deletedAt", "duration", "endTime", "familyId", "id", "leftAmount", "notes", "rightAmount", "startTime", "totalAmount", "unitAbbr", "updatedAt" FROM "PumpLog";
DROP TABLE "PumpLog";
ALTER TABLE "new_PumpLog" RENAME TO "PumpLog";
CREATE INDEX "PumpLog_startTime_idx" ON "PumpLog"("startTime");
CREATE INDEX "PumpLog_endTime_idx" ON "PumpLog"("endTime");
CREATE INDEX "PumpLog_babyId_idx" ON "PumpLog"("babyId");
CREATE INDEX "PumpLog_caretakerId_idx" ON "PumpLog"("caretakerId");
CREATE INDEX "PumpLog_unitAbbr_idx" ON "PumpLog"("unitAbbr");
CREATE INDEX "PumpLog_deletedAt_idx" ON "PumpLog"("deletedAt");
CREATE INDEX "PumpLog_familyId_idx" ON "PumpLog"("familyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "BreastMilkAdjustment_time_idx" ON "BreastMilkAdjustment"("time");

-- CreateIndex
CREATE INDEX "BreastMilkAdjustment_babyId_idx" ON "BreastMilkAdjustment"("babyId");

-- CreateIndex
CREATE INDEX "BreastMilkAdjustment_caretakerId_idx" ON "BreastMilkAdjustment"("caretakerId");

-- CreateIndex
CREATE INDEX "BreastMilkAdjustment_deletedAt_idx" ON "BreastMilkAdjustment"("deletedAt");

-- CreateIndex
CREATE INDEX "BreastMilkAdjustment_familyId_idx" ON "BreastMilkAdjustment"("familyId");
