import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { buildPreferencesWhere } from '@/app/api/notifications/preferences/route';

/**
 * Integration test against a real (temporary) SQLite database and the real
 * generated Prisma Client — not vi.mock, not an object-literal assertion.
 *
 * Two rounds of review found Prisma-specific query-compilation behavior
 * that a mocked or shape-only test cannot see:
 *   - a legacy row (familyId/caretakerId/accountId all null on the
 *     preference itself, discoverable only through its subscription) was
 *     invisible to its own owner because the owner filter was checked
 *     against the wrong columns;
 *   - a nested `OR: []` does not compile to "match nothing" the way a
 *     top-level one does — Prisma silently drops it, which a test that only
 *     inspects the returned object shape cannot catch.
 * Both are exercised here by actually running the query and reading real
 * results back.
 */
describe('buildPreferencesWhere — legacy row visibility (integration)', () => {
  let dbPath: string;
  let prisma: PrismaClient;

  beforeAll(async () => {
    dbPath = path.join(os.tmpdir(), `vitest-notification-preferences-${process.pid}-${Date.now()}.db`);

    const db = new Database(dbPath);
    db.exec(`
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
        "updatedAt" DATETIME NOT NULL
      );
      CREATE TABLE "NotificationPreference" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "subscriptionId" TEXT,
        "babyId" TEXT NOT NULL,
        "eventType" TEXT NOT NULL,
        "activityTypes" TEXT,
        "timerIntervalMinutes" INTEGER,
        "lastTimerNotifiedAt" DATETIME,
        "enabled" BOOLEAN NOT NULL DEFAULT 1,
        "caretakerId" TEXT,
        "accountId" TEXT,
        "familyId" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      );

      -- Two families, each with one subscription.
      INSERT INTO "PushSubscription" (id, caretakerId, familyId, endpoint, p256dh, auth, updatedAt)
        VALUES ('sub1', 'care1', 'fam1', 'https://x/1', 'p', 'a', datetime('now'));
      INSERT INTO "PushSubscription" (id, caretakerId, familyId, endpoint, p256dh, auth, updatedAt)
        VALUES ('sub2', 'care2', 'fam2', 'https://x/2', 'p', 'a', datetime('now'));

      -- Legacy preference rows: familyId/caretakerId/accountId all NULL on
      -- the row itself — exactly what a Postgres upgrade with no
      -- data-backfill step (db push only adds columns) leaves behind, and
      -- what an un-backfillable SQLite row (missing subscription at
      -- migration time) also leaves behind for family/caretaker/account.
      INSERT INTO "NotificationPreference" (id, subscriptionId, babyId, eventType, updatedAt)
        VALUES ('prefLegacy1', 'sub1', 'baby1', 'ACTIVITY_CREATED', datetime('now'));
      INSERT INTO "NotificationPreference" (id, subscriptionId, babyId, eventType, updatedAt)
        VALUES ('prefLegacy2', 'sub2', 'baby2', 'ACTIVITY_CREATED', datetime('now'));
    `);
    db.close();

    prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    for (const suffix of ['', '-journal', '-wal', '-shm']) {
      fs.rmSync(`${dbPath}${suffix}`, { force: true });
    }
  });

  it("returns a legacy row to its true owner, found through the subscription", async () => {
    const results = await prisma.notificationPreference.findMany({
      where: buildPreferencesWhere({ familyId: 'fam1', caretakerId: 'care1' }) as any,
    });
    expect(results.map((r) => r.id)).toEqual(['prefLegacy1']);
  });

  it("does not return a different family's equivalent legacy row", async () => {
    const results = await prisma.notificationPreference.findMany({
      where: buildPreferencesWhere({ familyId: 'fam2', caretakerId: 'care2' }) as any,
    });
    expect(results.map((r) => r.id)).toEqual(['prefLegacy2']);
  });

  it('fails closed (returns nothing) when the session has no owner id at all', async () => {
    const results = await prisma.notificationPreference.findMany({
      where: buildPreferencesWhere({ familyId: 'fam1' }) as any,
    });
    expect(results).toEqual([]);
  });
});
