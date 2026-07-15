-- CreateTable
CREATE TABLE "Food" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "commonAllergen" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "familyId" TEXT,
    CONSTRAINT "Food_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FoodLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "time" DATETIME NOT NULL,
    "enjoyment" TEXT,
    "hadReaction" BOOLEAN NOT NULL DEFAULT false,
    "reactionDescription" TEXT,
    "notes" TEXT,
    "feedLogId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "familyId" TEXT,
    "foodId" TEXT NOT NULL,
    "babyId" TEXT NOT NULL,
    "caretakerId" TEXT,
    CONSTRAINT "FoodLog_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FoodLog_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FoodLog_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FoodLog_caretakerId_fkey" FOREIGN KEY ("caretakerId") REFERENCES "Caretaker" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Food_name_idx" ON "Food"("name");

-- CreateIndex
CREATE INDEX "Food_deletedAt_idx" ON "Food"("deletedAt");

-- CreateIndex
CREATE INDEX "Food_familyId_idx" ON "Food"("familyId");

-- CreateIndex
CREATE INDEX "FoodLog_time_idx" ON "FoodLog"("time");

-- CreateIndex
CREATE INDEX "FoodLog_foodId_idx" ON "FoodLog"("foodId");

-- CreateIndex
CREATE INDEX "FoodLog_babyId_idx" ON "FoodLog"("babyId");

-- CreateIndex
CREATE INDEX "FoodLog_caretakerId_idx" ON "FoodLog"("caretakerId");

-- CreateIndex
CREATE INDEX "FoodLog_deletedAt_idx" ON "FoodLog"("deletedAt");

-- CreateIndex
CREATE INDEX "FoodLog_familyId_idx" ON "FoodLog"("familyId");

