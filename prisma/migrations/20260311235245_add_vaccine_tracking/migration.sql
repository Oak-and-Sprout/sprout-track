-- CreateTable
CREATE TABLE "VaccineLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "time" DATETIME NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "doseNumber" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "familyId" TEXT,
    "babyId" TEXT NOT NULL,
    "caretakerId" TEXT,
    CONSTRAINT "VaccineLog_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VaccineLog_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VaccineLog_caretakerId_fkey" FOREIGN KEY ("caretakerId") REFERENCES "Caretaker" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VaccineDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "vaccineLogId" TEXT NOT NULL,
    CONSTRAINT "VaccineDocument_vaccineLogId_fkey" FOREIGN KEY ("vaccineLogId") REFERENCES "VaccineLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContactVaccine" (
    "contactId" TEXT NOT NULL,
    "vaccineLogId" TEXT NOT NULL,

    PRIMARY KEY ("contactId", "vaccineLogId"),
    CONSTRAINT "ContactVaccine_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContactVaccine_vaccineLogId_fkey" FOREIGN KEY ("vaccineLogId") REFERENCES "VaccineLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VaccineLog_time_idx" ON "VaccineLog"("time");

-- CreateIndex
CREATE INDEX "VaccineLog_vaccineName_idx" ON "VaccineLog"("vaccineName");

-- CreateIndex
CREATE INDEX "VaccineLog_babyId_idx" ON "VaccineLog"("babyId");

-- CreateIndex
CREATE INDEX "VaccineLog_caretakerId_idx" ON "VaccineLog"("caretakerId");

-- CreateIndex
CREATE INDEX "VaccineLog_deletedAt_idx" ON "VaccineLog"("deletedAt");

-- CreateIndex
CREATE INDEX "VaccineLog_familyId_idx" ON "VaccineLog"("familyId");

-- CreateIndex
CREATE INDEX "VaccineDocument_vaccineLogId_idx" ON "VaccineDocument"("vaccineLogId");

-- CreateIndex
CREATE INDEX "ContactVaccine_contactId_idx" ON "ContactVaccine"("contactId");

-- CreateIndex
CREATE INDEX "ContactVaccine_vaccineLogId_idx" ON "ContactVaccine"("vaccineLogId");
