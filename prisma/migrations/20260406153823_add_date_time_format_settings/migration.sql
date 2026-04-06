-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyName" TEXT NOT NULL DEFAULT 'My Family',
    "securityPin" TEXT NOT NULL DEFAULT '111222',
    "authType" TEXT,
    "defaultBottleUnit" TEXT NOT NULL DEFAULT 'OZ',
    "defaultSolidsUnit" TEXT NOT NULL DEFAULT 'TBSP',
    "defaultHeightUnit" TEXT NOT NULL DEFAULT 'IN',
    "defaultWeightUnit" TEXT NOT NULL DEFAULT 'LB',
    "defaultTempUnit" TEXT NOT NULL DEFAULT 'F',
    "activitySettings" TEXT,
    "sleepLocationSettings" TEXT,
    "nurseryModeSettings" TEXT,
    "enableDebugTimer" BOOLEAN NOT NULL DEFAULT false,
    "enableDebugTimezone" BOOLEAN NOT NULL DEFAULT false,
    "enableBreastMilkTracking" BOOLEAN NOT NULL DEFAULT true,
    "includeSolidsInFeedTimer" BOOLEAN NOT NULL DEFAULT true,
    "dateFormat" TEXT NOT NULL DEFAULT 'MM/DD/YYYY',
    "timeFormat" TEXT NOT NULL DEFAULT '12h',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "familyId" TEXT,
    CONSTRAINT "Settings_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Settings" ("activitySettings", "authType", "createdAt", "defaultBottleUnit", "defaultHeightUnit", "defaultSolidsUnit", "defaultTempUnit", "defaultWeightUnit", "enableBreastMilkTracking", "enableDebugTimer", "enableDebugTimezone", "familyId", "familyName", "id", "includeSolidsInFeedTimer", "nurseryModeSettings", "securityPin", "sleepLocationSettings", "updatedAt") SELECT "activitySettings", "authType", "createdAt", "defaultBottleUnit", "defaultHeightUnit", "defaultSolidsUnit", "defaultTempUnit", "defaultWeightUnit", "enableBreastMilkTracking", "enableDebugTimer", "enableDebugTimezone", "familyId", "familyName", "id", "includeSolidsInFeedTimer", "nurseryModeSettings", "securityPin", "sleepLocationSettings", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE INDEX "Settings_familyId_idx" ON "Settings"("familyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
