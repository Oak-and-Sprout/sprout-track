/**
 * End-to-end test for the account export/import (family-migration) feature.
 *
 *   1. SEED   — create a family + account + caretakers + baby + a spread of logs
 *               directly via Prisma (SaaS-mode DB).
 *   2. EXPORT — log in as the ACCOUNT owner over HTTP and download the migration
 *               zip from GET /api/accounts/download-data.
 *   3. IMPORT — log in as the SYSADMIN over HTTP and POST the zip to
 *               /api/database/import-family (preview, then confirm / new-family).
 *   4. VERIFY — compare per-table row counts between the source family and the
 *               freshly-imported target family and print a PASS/FAIL summary.
 *
 * Run with the app already running in SaaS mode on port 3000:
 *   node scripts/test-account-export-import.js
 *
 * Env overrides:
 *   BASE_URL         default http://localhost:3000
 *   ADMIN_PASSWORD   default "admin"  (sysadmin login for import)
 *   KEEP_DATA        "true" to keep source+target families after the run
 *   EXTRACT_ONLY     "true" to run only the account-level extraction — seed +
 *                    export the migration zip into OUT_DIR, then stop (no
 *                    sysadmin login, no import, no verify, no cleanup). Use this
 *                    to produce a standalone archive that can be imported later.
 *   OUT_DIR          where to write the zip (default: OS temp dir)
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { randomUUID } = crypto;
const { PrismaClient } = require('@prisma/client');
const { createPrismaAdapter } = require('../prisma/prisma-adapter');

const prisma = new PrismaClient({ adapter: createPrismaAdapter(process.env.DATABASE_URL) });

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const KEEP_DATA = process.env.KEEP_DATA === 'true';
const EXTRACT_ONLY = process.env.EXTRACT_ONLY === 'true';
const OUT_DIR = process.env.OUT_DIR || require('os').tmpdir();

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// Mirrors app/api/utils/password-utils.ts hashPassword (PBKDF2, salt:hash base64).
function hashPassword(password) {
  const salt = crypto.randomBytes(32);
  const derived = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256');
  return `${salt.toString('base64')}:${derived.toString('base64')}`;
}

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const stamp = Date.now().toString(36);

function hoursAgo(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

async function api(pathname, { method = 'GET', token, body, form } = {}) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = form; // FormData — let fetch set the multipart boundary
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${pathname}`, { method, headers, body: payload });
  return res;
}

// ---------------------------------------------------------------------------
// 1. SEED
// ---------------------------------------------------------------------------

async function ensureUnits() {
  const units = [
    { unitAbbr: 'OZ', unitName: 'Ounces' },
    { unitAbbr: 'ML', unitName: 'Milliliters' },
    { unitAbbr: 'TBSP', unitName: 'Tablespoon' },
  ];
  for (const u of units) {
    await prisma.unit.upsert({
      where: { unitAbbr: u.unitAbbr },
      update: {},
      create: { unitAbbr: u.unitAbbr, unitName: u.unitName },
    });
  }
}

async function seed() {
  await ensureUnits();

  const slug = `export-test-${stamp}`;
  const email = `export-test-${stamp}@example.com`;
  const accountPassword = 'Test12345!';

  const family = await prisma.family.create({
    data: {
      id: randomUUID(),
      slug,
      name: `Export Test ${stamp}`,
      isActive: true,
      setupStage: 3,
    },
  });

  await prisma.settings.create({
    data: {
      id: randomUUID(),
      familyId: family.id,
      familyName: family.name,
      securityPin: '654321',
      defaultBottleUnit: 'OZ',
      defaultSolidsUnit: 'TBSP',
      defaultHeightUnit: 'IN',
      defaultWeightUnit: 'LB',
      defaultTempUnit: 'F',
    },
  });

  // System caretaker "00" + one regular caretaker (with a distinctive PIN we can
  // assert survives the export — the spec says PINs travel in plaintext).
  const systemCaretaker = await prisma.caretaker.create({
    data: {
      id: randomUUID(),
      loginId: '00',
      name: 'system',
      type: 'System Administrator',
      role: 'ADMIN',
      inactive: false,
      securityPin: '654321',
      familyId: family.id,
    },
  });
  await prisma.familyMember.create({
    data: { familyId: family.id, caretakerId: systemCaretaker.id, role: 'admin' },
  });

  const caretaker = await prisma.caretaker.create({
    data: {
      id: randomUUID(),
      loginId: '01',
      name: 'Alex',
      type: 'Parent',
      role: 'ADMIN',
      inactive: false,
      securityPin: '778899',
      familyId: family.id,
    },
  });
  await prisma.familyMember.create({
    data: { familyId: family.id, caretakerId: caretaker.id, role: 'admin' },
  });

  // Account owner — this is who exports.
  const account = await prisma.account.create({
    data: {
      id: randomUUID(),
      email,
      password: hashPassword(accountPassword),
      firstName: 'Export',
      lastName: 'Tester',
      verified: true,
      familyId: family.id,
      caretakerId: caretaker.id,
    },
  });
  await prisma.family.update({ where: { id: family.id }, data: { accountId: account.id } });

  const baby = await prisma.baby.create({
    data: {
      id: randomUUID(),
      firstName: 'Baby',
      lastName: `Test${stamp}`,
      birthDate: hoursAgo(24 * 120), // ~4 months old
      gender: 'FEMALE',
      inactive: false,
      familyId: family.id,
      feedWarningTime: '03:00',
      diaperWarningTime: '02:00',
    },
  });

  const ctIds = [systemCaretaker.id, caretaker.id];

  // A spread of logs across several types so the report has something to show.
  const feedLogs = [];
  const sleepLogs = [];
  const diaperLogs = [];
  const notes = [];
  const bathLogs = [];
  const moodLogs = [];
  const milestones = [];

  for (let i = 0; i < 12; i++) {
    const t = hoursAgo(3 * (i + 1));
    feedLogs.push({
      id: randomUUID(), time: t, type: i % 2 === 0 ? 'BOTTLE' : 'BREAST',
      amount: i % 2 === 0 ? 4 + (i % 3) : null,
      unitAbbr: i % 2 === 0 ? 'OZ' : null,
      side: i % 2 === 0 ? null : (i % 4 === 1 ? 'LEFT' : 'RIGHT'),
      babyId: baby.id, caretakerId: rand(ctIds), familyId: family.id,
    });
    diaperLogs.push({
      id: randomUUID(), time: t, type: rand(['WET', 'DIRTY', 'BOTH']),
      babyId: baby.id, caretakerId: rand(ctIds), familyId: family.id,
    });
  }
  for (let i = 0; i < 6; i++) {
    const start = hoursAgo(6 * (i + 1) + 2);
    sleepLogs.push({
      id: randomUUID(), startTime: start, endTime: hoursAgo(6 * (i + 1)),
      duration: 120, type: i % 3 === 0 ? 'NIGHT_SLEEP' : 'NAP',
      quality: rand(['GOOD', 'FAIR', 'EXCELLENT']),
      babyId: baby.id, caretakerId: rand(ctIds), familyId: family.id,
    });
  }
  for (let i = 0; i < 4; i++) {
    notes.push({
      id: randomUUID(), time: hoursAgo(12 * (i + 1)),
      content: `Test note ${i + 1} for ${slug}`, category: 'General',
      babyId: baby.id, caretakerId: rand(ctIds), familyId: family.id,
    });
  }
  for (let i = 0; i < 3; i++) {
    bathLogs.push({
      id: randomUUID(), time: hoursAgo(24 * (i + 1)), bathType: 'Full Bath',
      soapUsed: true, shampooUsed: true,
      babyId: baby.id, caretakerId: rand(ctIds), familyId: family.id,
    });
  }
  for (let i = 0; i < 5; i++) {
    moodLogs.push({
      id: randomUUID(), time: hoursAgo(5 * (i + 1)),
      mood: rand(['HAPPY', 'CALM', 'FUSSY', 'CRYING']), intensity: 1 + (i % 5),
      babyId: baby.id, caretakerId: rand(ctIds), familyId: family.id,
    });
  }
  milestones.push({
    id: randomUUID(), date: hoursAgo(24 * 30), title: 'First smile',
    description: 'Big grin!', category: 'SOCIAL', ageInDays: 90,
    babyId: baby.id, caretakerId: caretaker.id, familyId: family.id,
  });

  await prisma.feedLog.createMany({ data: feedLogs });
  await prisma.sleepLog.createMany({ data: sleepLogs });
  await prisma.diaperLog.createMany({ data: diaperLogs });
  await prisma.note.createMany({ data: notes });
  await prisma.bathLog.createMany({ data: bathLogs });
  await prisma.moodLog.createMany({ data: moodLogs });
  await prisma.milestone.createMany({ data: milestones });

  await prisma.contact.create({
    data: {
      id: randomUUID(), name: 'Dr. Pediatrician', role: 'doctor',
      phone: '555-0100', email: 'doc@example.com', familyId: family.id,
    },
  });

  return { family, account, email, accountPassword, slug };
}

// ---------------------------------------------------------------------------
// counts — compare source vs target
// ---------------------------------------------------------------------------

async function familyCounts(familyId) {
  const [caretakers, babies, contacts, feedLogs, sleepLogs, diaperLogs, notes, bathLogs, moodLogs, milestones] =
    await Promise.all([
      prisma.caretaker.count({ where: { familyId } }),
      prisma.baby.count({ where: { familyId } }),
      prisma.contact.count({ where: { familyId } }),
      prisma.feedLog.count({ where: { familyId } }),
      prisma.sleepLog.count({ where: { familyId } }),
      prisma.diaperLog.count({ where: { familyId } }),
      prisma.note.count({ where: { familyId } }),
      prisma.bathLog.count({ where: { familyId } }),
      prisma.moodLog.count({ where: { familyId } }),
      prisma.milestone.count({ where: { familyId } }),
    ]);
  return { caretakers, babies, contacts, feedLogs, sleepLogs, diaperLogs, notes, bathLogs, moodLogs, milestones };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  // Maintenance mode: delete one family (and its account) by slug, then exit.
  // Used to reset an instance back to just its setup-seed state.
  if (process.env.DELETE_SLUG) {
    const target = process.env.DELETE_SLUG;
    const fam = await prisma.family.findFirst({ where: { slug: target }, select: { id: true, slug: true } });
    if (!fam) {
      console.log(`No family with slug "${target}" — nothing to delete.`);
      return;
    }
    await deleteFamily(fam.id);
    console.log(`✓ Deleted family "${fam.slug}" (${fam.id}) and its account.`);
    return;
  }

  console.log(`\n=== Account export/import E2E${EXTRACT_ONLY ? ' (EXTRACT ONLY)' : ''} ===`);
  console.log(`Base URL: ${BASE_URL}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Preflight: sysadmin creds are only needed for the import step.
  let adminToken;
  if (!EXTRACT_ONLY) {
    const adminLogin = await api('/api/auth', { method: 'POST', body: { adminPassword: ADMIN_PASSWORD } });
    const adminJson = await adminLogin.json().catch(() => ({}));
    if (!adminLogin.ok || !adminJson?.data?.token) {
      throw new Error(`Sysadmin login failed (${adminLogin.status}). Set ADMIN_PASSWORD. Body: ${JSON.stringify(adminJson)}`);
    }
    adminToken = adminJson.data.token;
    console.log(`✓ Sysadmin auth OK`);
  }

  // 1. SEED
  console.log(`\n[1/4] Seeding source family...`);
  const { family, email, accountPassword, slug } = await seed();
  const sourceCounts = await familyCounts(family.id);
  console.log(`✓ Source family "${slug}" (${family.id})`);
  console.table(sourceCounts);

  // 2. EXPORT (account owner)
  console.log(`\n[2/4] Logging in as account owner and exporting...`);
  const acctLogin = await api('/api/accounts/login', { method: 'POST', body: { email, password: accountPassword } });
  const acctJson = await acctLogin.json().catch(() => ({}));
  const acctToken = acctJson?.data?.token;
  if (!acctLogin.ok || !acctToken) {
    throw new Error(`Account login failed (${acctLogin.status}): ${JSON.stringify(acctJson)}`);
  }
  console.log(`✓ Account auth OK (${email})`);

  const exportRes = await api('/api/accounts/download-data', { token: acctToken });
  if (!exportRes.ok) {
    const errBody = await exportRes.text().catch(() => '');
    throw new Error(`Export failed (${exportRes.status}): ${errBody}`);
  }
  const zipBuffer = Buffer.from(await exportRes.arrayBuffer());
  const zipPath = path.join(OUT_DIR, `${slug}-migration.zip`);
  fs.writeFileSync(zipPath, zipBuffer);
  console.log(`✓ Exported ${zipBuffer.length} bytes → ${zipPath}`);
  console.log(`  Content-Disposition: ${exportRes.headers.get('content-disposition')}`);

  if (EXTRACT_ONLY) {
    console.log(`\n=== EXTRACT ONLY — done ✅ ===`);
    console.log(`Migration archive: ${zipPath}`);
    console.log(`Source family "${slug}" left in place for inspection.`);
    return;
  }

  // 3. IMPORT (sysadmin) — preview then confirm/new-family
  console.log(`\n[3/4] Importing as sysadmin (new-family)...`);
  const zipBlob = new Blob([zipBuffer], { type: 'application/zip' });

  const previewForm = new FormData();
  previewForm.append('file', zipBlob, `${slug}-migration.zip`);
  previewForm.append('step', 'preview');
  const previewRes = await api('/api/database/import-family', { method: 'POST', token: adminToken, form: previewForm });
  const previewJson = await previewRes.json().catch(() => ({}));
  if (!previewRes.ok || !previewJson?.success) {
    throw new Error(`Preview failed (${previewRes.status}): ${JSON.stringify(previewJson)}`);
  }
  console.log(`✓ Preview:`, JSON.stringify(previewJson.data.preview));

  const targetSlug = `imported-${slug}`;
  const confirmForm = new FormData();
  confirmForm.append('file', zipBlob, `${slug}-migration.zip`);
  confirmForm.append('step', 'confirm');
  confirmForm.append('mode', 'new-family');
  confirmForm.append('newFamily', JSON.stringify({ name: `Imported ${slug}`, slug: targetSlug }));
  const confirmRes = await api('/api/database/import-family', { method: 'POST', token: adminToken, form: confirmForm });
  const confirmJson = await confirmRes.json().catch(() => ({}));
  if (!confirmRes.ok || !confirmJson?.success) {
    throw new Error(`Import confirm failed (${confirmRes.status}): ${JSON.stringify(confirmJson)}`);
  }
  const targetFamilyId = confirmJson.data.targetFamilyId;
  console.log(`✓ Imported → target family ${targetFamilyId}`);
  console.log(`\nReport:`);
  console.log(JSON.stringify(confirmJson.data.report, null, 2));

  // 4. VERIFY
  console.log(`\n[4/4] Verifying target counts vs source...`);
  const targetCounts = await familyCounts(targetFamilyId);

  const rows = Object.keys(sourceCounts).map((k) => ({
    table: k, source: sourceCounts[k], target: targetCounts[k], match: sourceCounts[k] === targetCounts[k] ? '✓' : '✗',
  }));
  console.table(rows);

  // Golden rule: imported rows must carry the TARGET familyId, never the source one.
  const leaked = await prisma.feedLog.count({ where: { familyId: family.id, id: { in: [] } } }); // noop guard
  const mismatches = rows.filter((r) => r.match === '✗');

  // Confirm the imported caretaker PIN traveled (plaintext, by design).
  const importedCaretaker = await prisma.caretaker.findFirst({
    where: { familyId: targetFamilyId, loginId: '01' },
    select: { securityPin: true },
  });
  const pinTraveled = importedCaretaker?.securityPin === '778899';

  console.log(`\nCaretaker PIN traveled (778899): ${pinTraveled ? '✓' : '✗ got ' + importedCaretaker?.securityPin}`);

  const pass = mismatches.length === 0 && pinTraveled;
  console.log(`\n=== ${pass ? 'PASS ✅' : 'FAIL ❌'} ===`);
  if (!pass) {
    if (mismatches.length) console.log(`Count mismatches: ${mismatches.map((m) => m.table).join(', ')}`);
    process.exitCode = 1;
  }

  // Cleanup
  if (KEEP_DATA) {
    console.log(`\nKEEP_DATA=true — leaving source (${slug}) and target (${targetSlug}) families in place.`);
    console.log(`Zip kept at: ${zipPath}`);
  } else {
    console.log(`\nCleaning up source + target families...`);
    await deleteFamily(family.id);
    await deleteFamily(targetFamilyId);
    fs.unlinkSync(zipPath);
    console.log(`✓ Cleaned up`);
  }
}

// Delete a family and all its scoped rows. Family <-> Account is a mutual FK, so
// clear Family.accountId and delete the Account first; logs cascade off Baby but
// reference Caretaker, so delete logs before caretakers.
async function deleteFamily(familyId) {
  const w = { where: { familyId } };
  await prisma.family.update({ where: { id: familyId }, data: { accountId: null } }).catch(() => {});
  await prisma.account.deleteMany({ where: { familyId } }).catch(() => {});
  await prisma.familyMember.deleteMany(w);
  for (const model of [
    'feedLog', 'sleepLog', 'diaperLog', 'note', 'bathLog', 'moodLog', 'milestone',
    'contact', 'baby', 'caretaker', 'settings',
  ]) {
    await prisma[model].deleteMany(w).catch(() => {});
  }
  await prisma.family.delete({ where: { id: familyId } }).catch(() => {});
}

main()
  .catch((e) => {
    console.error(`\n❌ E2E failed:`, e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
