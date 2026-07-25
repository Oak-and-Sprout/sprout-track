-- Decouple NotificationPreference from PushSubscription so a native-only user
-- (registers a DeviceToken, has no PushSubscription because WKWebView/Android
-- System WebView cannot register one) can still own preferences.
--
-- subscriptionId becomes nullable; caretakerId/accountId/familyId move onto
-- the preference row directly. familyId is nullable (not required): a
-- required column with no default cannot be added by `prisma db push` to a
-- Postgres table that already has rows, and `db push` (not this migrations
-- folder) is how docker-startup.sh deploys Postgres. Existing rows are
-- backfilled from their PushSubscription so current (web) users see no
-- behavior change.
--
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_NotificationPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT,
    "babyId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "activityTypes" TEXT,
    "timerIntervalMinutes" INTEGER,
    "lastTimerNotifiedAt" DATETIME,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "caretakerId" TEXT,
    "accountId" TEXT,
    "familyId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationPreference_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "PushSubscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NotificationPreference_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NotificationPreference_caretakerId_fkey" FOREIGN KEY ("caretakerId") REFERENCES "Caretaker" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NotificationPreference_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NotificationPreference_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Backfill owner columns for every existing row from its PushSubscription.
-- LEFT JOIN (not INNER JOIN): the FK guarantees subscriptionId was non-null,
-- not that the parent row is still live — a restore that temporarily
-- disables FK enforcement (db-backup.ts) can leave a dangling reference even
-- though normal writes can't produce one. An INNER JOIN would silently drop
-- those rows entirely; LEFT JOIN preserves every row. familyId additionally
-- falls back to the preference's own Baby (Baby.familyId is itself
-- nullable, so this can still leave familyId null for a genuinely orphaned
-- baby — that's acceptable, not fatal, now that the column is nullable).
-- caretakerId/accountId have no fallback source when the subscription is
-- missing; they stay NULL for that row rather than being fabricated.
INSERT INTO "new_NotificationPreference"
    ("id", "subscriptionId", "babyId", "eventType", "activityTypes", "timerIntervalMinutes",
     "lastTimerNotifiedAt", "enabled", "caretakerId", "accountId", "familyId", "createdAt", "updatedAt")
SELECT
    np."id", np."subscriptionId", np."babyId", np."eventType", np."activityTypes", np."timerIntervalMinutes",
    np."lastTimerNotifiedAt", np."enabled", ps."caretakerId", ps."accountId",
    COALESCE(ps."familyId", b."familyId"), np."createdAt", np."updatedAt"
FROM "NotificationPreference" np
LEFT JOIN "PushSubscription" ps ON ps."id" = np."subscriptionId"
LEFT JOIN "Baby" b ON b."id" = np."babyId";

DROP TABLE "NotificationPreference";
ALTER TABLE "new_NotificationPreference" RENAME TO "NotificationPreference";

-- CreateIndex
CREATE INDEX "NotificationPreference_subscriptionId_idx" ON "NotificationPreference"("subscriptionId");

-- CreateIndex
CREATE INDEX "NotificationPreference_babyId_idx" ON "NotificationPreference"("babyId");

-- CreateIndex
CREATE INDEX "NotificationPreference_eventType_idx" ON "NotificationPreference"("eventType");

-- CreateIndex
CREATE INDEX "NotificationPreference_enabled_idx" ON "NotificationPreference"("enabled");

-- CreateIndex
CREATE INDEX "NotificationPreference_caretakerId_idx" ON "NotificationPreference"("caretakerId");

-- CreateIndex
CREATE INDEX "NotificationPreference_accountId_idx" ON "NotificationPreference"("accountId");

-- CreateIndex
CREATE INDEX "NotificationPreference_familyId_idx" ON "NotificationPreference"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_subscriptionId_babyId_eventType_key" ON "NotificationPreference"("subscriptionId", "babyId", "eventType");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
