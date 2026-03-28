-- CreateTable
CREATE TABLE "ActiveActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playType" TEXT NOT NULL,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "currentStartTime" DATETIME,
    "sessionStartTime" DATETIME NOT NULL,
    "subCategory" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "babyId" TEXT NOT NULL,
    "familyId" TEXT,
    "caretakerId" TEXT,
    CONSTRAINT "ActiveActivity_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActiveActivity_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActiveActivity_caretakerId_fkey" FOREIGN KEY ("caretakerId") REFERENCES "Caretaker" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ActiveActivity_babyId_key" ON "ActiveActivity"("babyId");

-- CreateIndex
CREATE INDEX "ActiveActivity_babyId_idx" ON "ActiveActivity"("babyId");

-- CreateIndex
CREATE INDEX "ActiveActivity_familyId_idx" ON "ActiveActivity"("familyId");
