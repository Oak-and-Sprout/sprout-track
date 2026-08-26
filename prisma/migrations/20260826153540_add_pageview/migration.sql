-- CreateTable
CREATE TABLE "Pageview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "path" TEXT NOT NULL,
    "deviceType" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "referrerDomain" TEXT,
    "country" TEXT,
    "region" TEXT,
    "visitorHash" TEXT,
    "queryString" TEXT
);

-- CreateIndex
CREATE INDEX "Pageview_timestamp_idx" ON "Pageview"("timestamp");

-- CreateIndex
CREATE INDEX "Pageview_path_timestamp_idx" ON "Pageview"("path", "timestamp");
