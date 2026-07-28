-- DropIndex
DROP INDEX "DeviceToken_token_key";

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_token_familyId_key" ON "DeviceToken"("token", "familyId");
