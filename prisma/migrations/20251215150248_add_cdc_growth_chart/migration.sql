-- CreateTable
CREATE TABLE "CdcWeightForAge" (
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
CREATE TABLE "CdcLengthForAge" (
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
CREATE TABLE "CdcHeadCircumferenceForAge" (
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

-- CreateIndex
CREATE INDEX "CdcWeightForAge_sex_idx" ON "CdcWeightForAge"("sex");

-- CreateIndex
CREATE INDEX "CdcWeightForAge_ageMonths_idx" ON "CdcWeightForAge"("ageMonths");

-- CreateIndex
CREATE UNIQUE INDEX "CdcWeightForAge_sex_ageMonths_key" ON "CdcWeightForAge"("sex", "ageMonths");

-- CreateIndex
CREATE INDEX "CdcLengthForAge_sex_idx" ON "CdcLengthForAge"("sex");

-- CreateIndex
CREATE INDEX "CdcLengthForAge_ageMonths_idx" ON "CdcLengthForAge"("ageMonths");

-- CreateIndex
CREATE UNIQUE INDEX "CdcLengthForAge_sex_ageMonths_key" ON "CdcLengthForAge"("sex", "ageMonths");

-- CreateIndex
CREATE INDEX "CdcHeadCircumferenceForAge_sex_idx" ON "CdcHeadCircumferenceForAge"("sex");

-- CreateIndex
CREATE INDEX "CdcHeadCircumferenceForAge_ageMonths_idx" ON "CdcHeadCircumferenceForAge"("ageMonths");

-- CreateIndex
CREATE UNIQUE INDEX "CdcHeadCircumferenceForAge_sex_ageMonths_key" ON "CdcHeadCircumferenceForAge"("sex", "ageMonths");
