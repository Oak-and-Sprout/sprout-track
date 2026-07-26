-- Align the mixed-bottle value with its translation key: 'Formula\Breast' -> 'Formula/Breast'.
-- Backslash is a literal character in standard SQL string literals on both SQLite and PostgreSQL.
UPDATE "FeedLog" SET "bottleType" = 'Formula/Breast' WHERE "bottleType" = 'Formula\Breast';
