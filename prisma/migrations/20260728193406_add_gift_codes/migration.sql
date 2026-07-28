-- CreateTable
CREATE TABLE "GiftCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "purchaserEmail" TEXT,
    "stripeSessionId" TEXT,
    "stripePaymentId" TEXT,
    "redeemedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "redeemedByAccountId" TEXT,
    CONSTRAINT "GiftCode_redeemedByAccountId_fkey" FOREIGN KEY ("redeemedByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GiftCode_code_key" ON "GiftCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCode_stripeSessionId_key" ON "GiftCode"("stripeSessionId");

-- CreateIndex
CREATE INDEX "GiftCode_redeemedByAccountId_idx" ON "GiftCode"("redeemedByAccountId");
