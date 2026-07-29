-- Multi-food meals (#247): nullable foodId + foods JSON text column.
-- Backfill foods from existing single-food rows so expandFoodItems() works
-- for both legacy and new shapes. SQLite requires a table rebuild to change
-- foodId nullability.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_FoodLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "time" DATETIME NOT NULL,
    "amount" REAL,
    "unitAbbr" TEXT,
    "enjoyment" TEXT,
    "hadReaction" BOOLEAN NOT NULL DEFAULT false,
    "reactionDescription" TEXT,
    "notes" TEXT,
    "feedLogId" TEXT,
    "foods" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "familyId" TEXT,
    "foodId" TEXT,
    "babyId" TEXT NOT NULL,
    "caretakerId" TEXT,
    CONSTRAINT "FoodLog_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FoodLog_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FoodLog_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FoodLog_caretakerId_fkey" FOREIGN KEY ("caretakerId") REFERENCES "Caretaker" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_FoodLog" (
    "id", "time", "amount", "unitAbbr", "enjoyment", "hadReaction", "reactionDescription",
    "notes", "feedLogId", "foods", "createdAt", "updatedAt", "deletedAt", "familyId",
    "foodId", "babyId", "caretakerId"
)
SELECT
    "id", "time", "amount", "unitAbbr", "enjoyment", "hadReaction", "reactionDescription",
    "notes", "feedLogId",
    CASE
      WHEN "foodId" IS NOT NULL THEN
        json_array(
          json_object(
            'foodId', "foodId",
            'hadReaction', CASE WHEN "hadReaction" THEN json('true') ELSE json('false') END,
            'reactionDescription', "reactionDescription"
          )
        )
      ELSE NULL
    END,
    "createdAt", "updatedAt", "deletedAt", "familyId",
    "foodId", "babyId", "caretakerId"
FROM "FoodLog";

DROP TABLE "FoodLog";
ALTER TABLE "new_FoodLog" RENAME TO "FoodLog";

CREATE INDEX "FoodLog_time_idx" ON "FoodLog"("time");
CREATE INDEX "FoodLog_foodId_idx" ON "FoodLog"("foodId");
CREATE INDEX "FoodLog_babyId_idx" ON "FoodLog"("babyId");
CREATE INDEX "FoodLog_caretakerId_idx" ON "FoodLog"("caretakerId");
CREATE INDEX "FoodLog_deletedAt_idx" ON "FoodLog"("deletedAt");
CREATE INDEX "FoodLog_familyId_idx" ON "FoodLog"("familyId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
