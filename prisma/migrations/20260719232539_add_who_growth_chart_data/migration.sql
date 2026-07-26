-- CreateTable
CREATE TABLE "WhoWeightForAge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sex" INTEGER NOT NULL,
    "ageMonths" REAL NOT NULL,
    "l" REAL NOT NULL,
    "m" REAL NOT NULL,
    "s" REAL NOT NULL,
    "p3" REAL NOT NULL,
    "p5" REAL NOT NULL,
    "p10" REAL NOT NULL,
    "p25" REAL NOT NULL,
    "p50" REAL NOT NULL,
    "p75" REAL NOT NULL,
    "p90" REAL NOT NULL,
    "p95" REAL NOT NULL,
    "p97" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "WhoLengthForAge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sex" INTEGER NOT NULL,
    "ageMonths" REAL NOT NULL,
    "l" REAL NOT NULL,
    "m" REAL NOT NULL,
    "s" REAL NOT NULL,
    "p3" REAL NOT NULL,
    "p5" REAL NOT NULL,
    "p10" REAL NOT NULL,
    "p25" REAL NOT NULL,
    "p50" REAL NOT NULL,
    "p75" REAL NOT NULL,
    "p90" REAL NOT NULL,
    "p95" REAL NOT NULL,
    "p97" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "WhoHeadCircumferenceForAge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sex" INTEGER NOT NULL,
    "ageMonths" REAL NOT NULL,
    "l" REAL NOT NULL,
    "m" REAL NOT NULL,
    "s" REAL NOT NULL,
    "p3" REAL NOT NULL,
    "p5" REAL NOT NULL,
    "p10" REAL NOT NULL,
    "p25" REAL NOT NULL,
    "p50" REAL NOT NULL,
    "p75" REAL NOT NULL,
    "p90" REAL NOT NULL,
    "p95" REAL NOT NULL,
    "p97" REAL NOT NULL
);

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
    "bathTypeSettings" TEXT,
    "nurseryModeSettings" TEXT,
    "enableDebugTimer" BOOLEAN NOT NULL DEFAULT false,
    "enableDebugTimezone" BOOLEAN NOT NULL DEFAULT false,
    "enableBreastMilkTracking" BOOLEAN NOT NULL DEFAULT true,
    "includeSolidsInFeedTimer" BOOLEAN NOT NULL DEFAULT true,
    "photoQuotaMB" INTEGER,
    "dateFormat" TEXT NOT NULL DEFAULT 'MM/DD/YYYY',
    "timeFormat" TEXT NOT NULL DEFAULT '12h',
    "growthChartStandard" TEXT NOT NULL DEFAULT 'CDC',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "familyId" TEXT,
    CONSTRAINT "Settings_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Settings" ("activitySettings", "authType", "bathTypeSettings", "createdAt", "dateFormat", "defaultBottleUnit", "defaultHeightUnit", "defaultSolidsUnit", "defaultTempUnit", "defaultWeightUnit", "enableBreastMilkTracking", "enableDebugTimer", "enableDebugTimezone", "familyId", "familyName", "id", "includeSolidsInFeedTimer", "nurseryModeSettings", "photoQuotaMB", "securityPin", "sleepLocationSettings", "timeFormat", "updatedAt") SELECT "activitySettings", "authType", "bathTypeSettings", "createdAt", "dateFormat", "defaultBottleUnit", "defaultHeightUnit", "defaultSolidsUnit", "defaultTempUnit", "defaultWeightUnit", "enableBreastMilkTracking", "enableDebugTimer", "enableDebugTimezone", "familyId", "familyName", "id", "includeSolidsInFeedTimer", "nurseryModeSettings", "photoQuotaMB", "securityPin", "sleepLocationSettings", "timeFormat", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE INDEX "Settings_familyId_idx" ON "Settings"("familyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "WhoWeightForAge_sex_idx" ON "WhoWeightForAge"("sex");

-- CreateIndex
CREATE INDEX "WhoWeightForAge_ageMonths_idx" ON "WhoWeightForAge"("ageMonths");

-- CreateIndex
CREATE UNIQUE INDEX "WhoWeightForAge_sex_ageMonths_key" ON "WhoWeightForAge"("sex", "ageMonths");

-- CreateIndex
CREATE INDEX "WhoLengthForAge_sex_idx" ON "WhoLengthForAge"("sex");

-- CreateIndex
CREATE INDEX "WhoLengthForAge_ageMonths_idx" ON "WhoLengthForAge"("ageMonths");

-- CreateIndex
CREATE UNIQUE INDEX "WhoLengthForAge_sex_ageMonths_key" ON "WhoLengthForAge"("sex", "ageMonths");

-- CreateIndex
CREATE INDEX "WhoHeadCircumferenceForAge_sex_idx" ON "WhoHeadCircumferenceForAge"("sex");

-- CreateIndex
CREATE INDEX "WhoHeadCircumferenceForAge_ageMonths_idx" ON "WhoHeadCircumferenceForAge"("ageMonths");

-- CreateIndex
CREATE UNIQUE INDEX "WhoHeadCircumferenceForAge_sex_ageMonths_key" ON "WhoHeadCircumferenceForAge"("sex", "ageMonths");
