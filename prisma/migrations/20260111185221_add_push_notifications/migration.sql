-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT,
    "caretakerId" TEXT,
    "familyId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "userAgent" TEXT,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastFailureAt" DATETIME,
    "lastSuccessAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PushSubscription_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PushSubscription_caretakerId_fkey" FOREIGN KEY ("caretakerId") REFERENCES "Caretaker" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PushSubscription_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT NOT NULL,
    "babyId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "activityTypes" TEXT,
    "timerIntervalMinutes" INTEGER,
    "lastTimerNotifiedAt" DATETIME,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationPreference_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "PushSubscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NotificationPreference_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "activityType" TEXT,
    "babyId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "httpStatus" INTEGER,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationLog_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "PushSubscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_accountId_idx" ON "PushSubscription"("accountId");

-- CreateIndex
CREATE INDEX "PushSubscription_caretakerId_idx" ON "PushSubscription"("caretakerId");

-- CreateIndex
CREATE INDEX "PushSubscription_familyId_idx" ON "PushSubscription"("familyId");

-- CreateIndex
CREATE INDEX "PushSubscription_endpoint_idx" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_failureCount_idx" ON "PushSubscription"("failureCount");

-- CreateIndex
CREATE INDEX "NotificationPreference_subscriptionId_idx" ON "NotificationPreference"("subscriptionId");

-- CreateIndex
CREATE INDEX "NotificationPreference_babyId_idx" ON "NotificationPreference"("babyId");

-- CreateIndex
CREATE INDEX "NotificationPreference_eventType_idx" ON "NotificationPreference"("eventType");

-- CreateIndex
CREATE INDEX "NotificationPreference_enabled_idx" ON "NotificationPreference"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_subscriptionId_babyId_eventType_key" ON "NotificationPreference"("subscriptionId", "babyId", "eventType");

-- CreateIndex
CREATE INDEX "NotificationLog_subscriptionId_idx" ON "NotificationLog"("subscriptionId");

-- CreateIndex
CREATE INDEX "NotificationLog_createdAt_idx" ON "NotificationLog"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_success_idx" ON "NotificationLog"("success");
