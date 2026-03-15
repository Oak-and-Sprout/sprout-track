-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Medicine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "typicalDoseSize" REAL,
    "unitAbbr" TEXT,
    "doseMinTime" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isSupplement" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "familyId" TEXT,
    CONSTRAINT "Medicine_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Medicine_unitAbbr_fkey" FOREIGN KEY ("unitAbbr") REFERENCES "Unit" ("unitAbbr") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Medicine" ("active", "createdAt", "deletedAt", "doseMinTime", "familyId", "id", "name", "notes", "typicalDoseSize", "unitAbbr", "updatedAt") SELECT "active", "createdAt", "deletedAt", "doseMinTime", "familyId", "id", "name", "notes", "typicalDoseSize", "unitAbbr", "updatedAt" FROM "Medicine";
DROP TABLE "Medicine";
ALTER TABLE "new_Medicine" RENAME TO "Medicine";
CREATE INDEX "Medicine_name_idx" ON "Medicine"("name");
CREATE INDEX "Medicine_active_idx" ON "Medicine"("active");
CREATE INDEX "Medicine_isSupplement_idx" ON "Medicine"("isSupplement");
CREATE INDEX "Medicine_unitAbbr_idx" ON "Medicine"("unitAbbr");
CREATE INDEX "Medicine_deletedAt_idx" ON "Medicine"("deletedAt");
CREATE INDEX "Medicine_familyId_idx" ON "Medicine"("familyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
