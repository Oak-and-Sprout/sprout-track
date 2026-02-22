-- AlterTable
ALTER TABLE "Account" ADD COLUMN "language" TEXT DEFAULT 'en';

-- Update existing Account records to have 'en' as default language
UPDATE "Account" SET "language" = 'en' WHERE "language" IS NULL;

-- AlterTable
ALTER TABLE "Caretaker" ADD COLUMN "language" TEXT DEFAULT 'en';

-- Update existing Caretaker records to have 'en' as default language
UPDATE "Caretaker" SET "language" = 'en' WHERE "language" IS NULL;
