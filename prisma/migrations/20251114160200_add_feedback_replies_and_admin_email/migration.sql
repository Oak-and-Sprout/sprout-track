-- AlterTable
ALTER TABLE "AppConfig" ADD COLUMN "adminEmail" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "familyId" TEXT,
    "accountId" TEXT,
    "caretakerId" TEXT,
    "submitterName" TEXT,
    "submitterEmail" TEXT,
    "parentId" TEXT,
    CONSTRAINT "Feedback_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Feedback_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Feedback_caretakerId_fkey" FOREIGN KEY ("caretakerId") REFERENCES "Caretaker" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Feedback_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Feedback" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Feedback" ("accountId", "caretakerId", "createdAt", "deletedAt", "familyId", "id", "message", "subject", "submittedAt", "submitterEmail", "submitterName", "updatedAt", "viewed") SELECT "accountId", "caretakerId", "createdAt", "deletedAt", "familyId", "id", "message", "subject", "submittedAt", "submitterEmail", "submitterName", "updatedAt", "viewed" FROM "Feedback";
DROP TABLE "Feedback";
ALTER TABLE "new_Feedback" RENAME TO "Feedback";
CREATE INDEX "Feedback_submittedAt_idx" ON "Feedback"("submittedAt");
CREATE INDEX "Feedback_viewed_idx" ON "Feedback"("viewed");
CREATE INDEX "Feedback_familyId_idx" ON "Feedback"("familyId");
CREATE INDEX "Feedback_accountId_idx" ON "Feedback"("accountId");
CREATE INDEX "Feedback_caretakerId_idx" ON "Feedback"("caretakerId");
CREATE INDEX "Feedback_deletedAt_idx" ON "Feedback"("deletedAt");
CREATE INDEX "Feedback_parentId_idx" ON "Feedback"("parentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
