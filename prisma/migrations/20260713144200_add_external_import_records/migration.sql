-- CreateTable
CREATE TABLE "ExternalImportRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "sourceEntityType" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceChildId" TEXT,
    "targetEntityType" TEXT NOT NULL,
    "targetRecordId" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "familyId" TEXT NOT NULL,
    CONSTRAINT "ExternalImportRecord_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExternalImportRecord_familyId_providerId_idx" ON "ExternalImportRecord"("familyId", "providerId");

-- CreateIndex
CREATE INDEX "ExternalImportRecord_targetEntityType_targetRecordId_idx" ON "ExternalImportRecord"("targetEntityType", "targetRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalImportRecord_familyId_providerId_sourceEntityType_sourceRecordId_key" ON "ExternalImportRecord"("familyId", "providerId", "sourceEntityType", "sourceRecordId");
