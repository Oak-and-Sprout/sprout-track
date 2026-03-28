-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Family" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "setupStage" INTEGER NOT NULL DEFAULT 0,
    "accountId" TEXT
);
INSERT INTO "new_Family" ("accountId", "createdAt", "id", "isActive", "name", "slug", "updatedAt") SELECT "accountId", "createdAt", "id", "isActive", "name", "slug", "updatedAt" FROM "Family";
DROP TABLE "Family";
ALTER TABLE "new_Family" RENAME TO "Family";
CREATE UNIQUE INDEX "Family_slug_key" ON "Family"("slug");
CREATE UNIQUE INDEX "Family_accountId_key" ON "Family"("accountId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Backfill: Families with active babies are fully set up
UPDATE "Family" SET "setupStage" = 3
  WHERE "id" IN (SELECT DISTINCT "familyId" FROM "Baby" WHERE "inactive" = 0 AND "familyId" IS NOT NULL);

-- Backfill: Families that exist but have no active babies are at stage 1 (family created)
UPDATE "Family" SET "setupStage" = 1
  WHERE "setupStage" = 0
  AND "id" NOT IN (SELECT DISTINCT "familyId" FROM "Baby" WHERE "inactive" = 0 AND "familyId" IS NOT NULL);
