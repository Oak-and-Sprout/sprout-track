-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "photoQuotaMB" INTEGER;

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "thumbStoredName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "thumbSize" INTEGER NOT NULL,
    "takenAt" DATETIME NOT NULL,
    "caption" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "babyId" TEXT NOT NULL,
    "caretakerId" TEXT,
    "milestoneId" TEXT,
    "familyId" TEXT,
    CONSTRAINT "Photo_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Photo_caretakerId_fkey" FOREIGN KEY ("caretakerId") REFERENCES "Caretaker" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Photo_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Photo_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PhotoLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "time" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "babyId" TEXT NOT NULL,
    "caretakerId" TEXT,
    "familyId" TEXT,
    CONSTRAINT "PhotoLog_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PhotoLog_caretakerId_fkey" FOREIGN KEY ("caretakerId") REFERENCES "Caretaker" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PhotoLog_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PhotoLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "photoId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhotoLink_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PhotoFavorite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "photoId" TEXT NOT NULL,
    "caretakerId" TEXT,
    "accountId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhotoFavorite_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminPass" TEXT NOT NULL,
    "rootDomain" TEXT NOT NULL,
    "enableHttps" BOOLEAN NOT NULL DEFAULT false,
    "adminEmail" TEXT,
    "enablePhotos" BOOLEAN NOT NULL DEFAULT false,
    "defaultPhotoQuotaMB" INTEGER NOT NULL DEFAULT 5120,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AppConfig" ("adminEmail", "adminPass", "enableHttps", "id", "rootDomain", "updatedAt") SELECT "adminEmail", "adminPass", "enableHttps", "id", "rootDomain", "updatedAt" FROM "AppConfig";
DROP TABLE "AppConfig";
ALTER TABLE "new_AppConfig" RENAME TO "AppConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Photo_familyId_idx" ON "Photo"("familyId");

-- CreateIndex
CREATE INDEX "Photo_babyId_idx" ON "Photo"("babyId");

-- CreateIndex
CREATE INDEX "Photo_takenAt_idx" ON "Photo"("takenAt");

-- CreateIndex
CREATE INDEX "Photo_deletedAt_idx" ON "Photo"("deletedAt");

-- CreateIndex
CREATE INDEX "Photo_milestoneId_idx" ON "Photo"("milestoneId");

-- CreateIndex
CREATE INDEX "PhotoLog_familyId_idx" ON "PhotoLog"("familyId");

-- CreateIndex
CREATE INDEX "PhotoLog_babyId_idx" ON "PhotoLog"("babyId");

-- CreateIndex
CREATE INDEX "PhotoLog_time_idx" ON "PhotoLog"("time");

-- CreateIndex
CREATE INDEX "PhotoLog_deletedAt_idx" ON "PhotoLog"("deletedAt");

-- CreateIndex
CREATE INDEX "PhotoLink_activityType_activityId_idx" ON "PhotoLink"("activityType", "activityId");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoLink_photoId_activityType_activityId_key" ON "PhotoLink"("photoId", "activityType", "activityId");

-- CreateIndex
CREATE INDEX "PhotoFavorite_photoId_idx" ON "PhotoFavorite"("photoId");

-- CreateIndex
CREATE INDEX "PhotoFavorite_caretakerId_idx" ON "PhotoFavorite"("caretakerId");

-- CreateIndex
CREATE INDEX "PhotoFavorite_accountId_idx" ON "PhotoFavorite"("accountId");
