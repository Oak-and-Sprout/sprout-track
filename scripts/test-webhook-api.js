#!/usr/bin/env node

/**
 * Webhook API Test Script for Sprout Track
 *
 * Tests the /api/hooks/v1/ endpoints using a real API key.
 * Prompts for base URL and API key interactively.
 *
 * Usage:
 *   node scripts/test-webhook-api.js
 *   node scripts/test-webhook-api.js --read-only
 *   node scripts/test-webhook-api.js --write-only
 */

const readline = require('readline');

const args = process.argv.slice(2);
const readOnly = args.includes('--read-only');
const writeOnly = args.includes('--write-only');

let API_KEY;
let BASE_URL;
let HOOKS_BASE;

function prompt(question, defaultValue) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const display = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
  return new Promise((resolve) => {
    rl.question(display, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

// ── Helpers ──

let passed = 0;
let failed = 0;
let skipped = 0;

function log(icon, msg) {
  console.log(`  ${icon} ${msg}`);
}

async function request(method, path, body) {
  const url = `${HOOKS_BASE}${path}`;
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const json = await res.json();
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), ...json };
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    log('\x1b[32m✓\x1b[0m', name);
  } catch (err) {
    failed++;
    log('\x1b[31m✗\x1b[0m', `${name}\n      ${err.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

// ── Read Tests ──

async function runReadTests(babyId) {
  console.log('\n\x1b[1m── Read Tests (GET) ──\x1b[0m\n');

  await test('GET /babies — list babies', async () => {
    const res = await request('GET', '/babies');
    assert(res.success, `Expected success, got: ${JSON.stringify(res.error)}`);
    assert(Array.isArray(res.data.babies), 'Expected babies array');
    assert(res.data.babies.length > 0, 'Expected at least one baby');
    const baby = res.data.babies[0];
    assert(baby.id, 'Baby should have id');
    assert(baby.firstName, 'Baby should have firstName');
    assert(typeof baby.ageInDays === 'number', 'Baby should have ageInDays');
    log(' ', `Found ${res.data.babies.length} baby(ies): ${res.data.babies.map(b => b.firstName).join(', ')}`);
  });

  await test(`GET /babies/${babyId}/status — dashboard snapshot`, async () => {
    const res = await request('GET', `/babies/${babyId}/status`);
    assert(res.success, `Expected success, got: ${JSON.stringify(res.error)}`);
    assert(res.data.baby, 'Expected baby object');
    assert(res.data.lastActivities !== undefined, 'Expected lastActivities');
    assert(res.data.dailyCounts !== undefined, 'Expected dailyCounts');
    assert(res.data.warnings !== undefined, 'Expected warnings');
    const dc = res.data.dailyCounts;
    assert(dc.supplements !== undefined, 'Expected supplements in dailyCounts');
    log(' ', `Daily: ${dc.feeds} feeds, ${dc.diapers} diapers, ${dc.sleepMinutes}min sleep, ${dc.baths} baths, ${dc.medicines} medicines, ${dc.supplements} supplements`);
    if (res.data.lastActivities.feed) {
      log(' ', `Last feed: ${res.data.lastActivities.feed.minutesAgo} min ago (${res.data.lastActivities.feed.type})`);
    }
  });

  await test(`GET /babies/${babyId}/activities — recent activities`, async () => {
    const res = await request('GET', `/babies/${babyId}/activities?limit=5`);
    assert(res.success, `Expected success, got: ${JSON.stringify(res.error)}`);
    assert(Array.isArray(res.data.activities), 'Expected activities array');
    assert(typeof res.data.count === 'number', 'Expected count');
    log(' ', `Got ${res.data.count} activities`);
    if (res.data.activities.length > 0) {
      const types = [...new Set(res.data.activities.map(a => a.activityType))];
      log(' ', `Types: ${types.join(', ')}`);
    }
  });

  await test(`GET /babies/${babyId}/activities?type=feed — filtered activities`, async () => {
    const res = await request('GET', `/babies/${babyId}/activities?type=feed&limit=3`);
    assert(res.success, `Expected success, got: ${JSON.stringify(res.error)}`);
    assert(Array.isArray(res.data.activities), 'Expected activities array');
    res.data.activities.forEach(a => {
      assert(a.activityType === 'feed', `Expected feed, got ${a.activityType}`);
    });
    log(' ', `Got ${res.data.count} feed activities`);
  });

  await test(`GET /babies/${babyId}/measurements/latest — latest measurements`, async () => {
    const res = await request('GET', `/babies/${babyId}/measurements/latest`);
    assert(res.success, `Expected success, got: ${JSON.stringify(res.error)}`);
    assert(res.data.measurements, 'Expected measurements object');
    const types = Object.keys(res.data.measurements);
    const available = types.filter(t => res.data.measurements[t] !== null);
    log(' ', `Measurement types: ${types.join(', ')}`);
    log(' ', `Has data: ${available.length > 0 ? available.join(', ') : 'none'}`);
  });

  // Reference data
  await test(`GET /babies/${babyId}/reference — all reference data`, async () => {
    const res = await request('GET', `/babies/${babyId}/reference`);
    assert(res.success, `Expected success, got: ${JSON.stringify(res.error)}`);
    assert(res.data.medicines !== undefined, 'Expected medicines');
    assert(res.data.supplements !== undefined, 'Expected supplements');
    assert(res.data.sleepLocations !== undefined, 'Expected sleepLocations');
    assert(res.data.playCategories !== undefined, 'Expected playCategories');
    assert(res.data.feedTypes !== undefined, 'Expected feedTypes');
    log(' ', `Medicines: ${res.data.medicines.length}, Supplements: ${res.data.supplements.length}, Locations: ${res.data.sleepLocations.length}, Feed types: ${res.data.feedTypes.length}`);
  });

  await test(`GET /babies/${babyId}/reference?type=medicines — medicines only`, async () => {
    const res = await request('GET', `/babies/${babyId}/reference?type=medicines`);
    assert(res.success, `Expected success, got: ${JSON.stringify(res.error)}`);
    assert(Array.isArray(res.data.medicines), 'Expected medicines array');
    assert(res.data.sleepLocations === undefined, 'Should not include sleepLocations');
    if (res.data.medicines.length > 0) {
      const m = res.data.medicines[0];
      assert(m.name, 'Medicine should have name');
      log(' ', `Found: ${res.data.medicines.map(m => m.name).join(', ')}`);
    } else {
      log(' ', 'No medicines configured');
    }
  });

  await test(`GET /babies/${babyId}/reference?type=sleep-locations — sleep locations`, async () => {
    const res = await request('GET', `/babies/${babyId}/reference?type=sleep-locations`);
    assert(res.success, `Expected success, got: ${JSON.stringify(res.error)}`);
    assert(Array.isArray(res.data.sleepLocations), 'Expected sleepLocations array');
    assert(res.data.sleepLocations.length > 0, 'Expected at least default locations');
    log(' ', `Locations: ${res.data.sleepLocations.join(', ')}`);
  });

  await test(`GET /babies/${babyId}/reference?type=supplements — supplements only`, async () => {
    const res = await request('GET', `/babies/${babyId}/reference?type=supplements`);
    assert(res.success, `Expected success, got: ${JSON.stringify(res.error)}`);
    assert(Array.isArray(res.data.supplements), 'Expected supplements array');
    assert(res.data.medicines === undefined, 'Should not include medicines');
    res.data.supplements.forEach(s => {
      assert(s.isSupplement === true, `Expected isSupplement=true, got ${s.isSupplement}`);
    });
    if (res.data.supplements.length > 0) {
      log(' ', `Found: ${res.data.supplements.map(s => s.name).join(', ')}`);
    } else {
      log(' ', 'No supplements configured');
    }
  });

  await test(`GET /babies/${babyId}/reference?type=feed-types — feed types`, async () => {
    const res = await request('GET', `/babies/${babyId}/reference?type=feed-types`);
    assert(res.success, `Expected success, got: ${JSON.stringify(res.error)}`);
    assert(Array.isArray(res.data.feedTypes), 'Expected feedTypes array');
    const values = res.data.feedTypes.map(f => f.value);
    assert(values.includes('formula'), 'Should include formula shorthand');
    assert(values.includes('BREAST'), 'Should include BREAST');
    log(' ', `Feed types: ${values.join(', ')}`);
  });

  await test(`GET /babies/${babyId}/activities?type=medicine — medicine activities only`, async () => {
    const res = await request('GET', `/babies/${babyId}/activities?type=medicine&limit=5`);
    assert(res.success, `Expected success, got: ${JSON.stringify(res.error)}`);
    assert(Array.isArray(res.data.activities), 'Expected activities array');
    res.data.activities.forEach(a => {
      assert(a.activityType === 'medicine', `Expected medicine, got ${a.activityType}`);
    });
    log(' ', `Got ${res.data.count} medicine activities`);
  });

  await test(`GET /babies/${babyId}/activities?type=supplement — supplement activities only`, async () => {
    const res = await request('GET', `/babies/${babyId}/activities?type=supplement&limit=5`);
    assert(res.success, `Expected success, got: ${JSON.stringify(res.error)}`);
    assert(Array.isArray(res.data.activities), 'Expected activities array');
    res.data.activities.forEach(a => {
      assert(a.activityType === 'supplement', `Expected supplement, got ${a.activityType}`);
    });
    log(' ', `Got ${res.data.count} supplement activities`);
  });

  await test(`GET /babies/${babyId}/reference?type=invalid — 400 for bad type`, async () => {
    const res = await request('GET', `/babies/${babyId}/reference?type=invalid`);
    assert(!res.success, 'Expected failure');
    assert(res.error.code === 'INVALID_REF_TYPE', `Expected INVALID_REF_TYPE, got ${res.error.code}`);
  });

  // Edge cases
  await test('GET /babies/invalid-id/status — 404 for bad baby ID', async () => {
    const res = await request('GET', '/babies/nonexistent-baby-id/status');
    assert(!res.success, 'Expected failure');
    assert(res.error, 'Expected error object');
  });

  await test('GET /babies/${babyId}/activities?type=invalid — 400 for bad type', async () => {
    const res = await request('GET', `/babies/${babyId}/activities?type=invalid`);
    assert(!res.success, 'Expected failure');
    assert(res.error.code === 'INVALID_ACTIVITY_TYPE', `Expected INVALID_ACTIVITY_TYPE, got ${res.error.code}`);
  });

  // Rate limit headers
  await test('Rate limit headers present on responses', async () => {
    const res = await request('GET', '/babies');
    assert(res.headers['x-ratelimit-limit'], 'Expected X-RateLimit-Limit header');
    assert(res.headers['x-ratelimit-remaining'], 'Expected X-RateLimit-Remaining header');
    assert(res.headers['x-ratelimit-reset'], 'Expected X-RateLimit-Reset header');
    log(' ', `Limit: ${res.headers['x-ratelimit-limit']}, Remaining: ${res.headers['x-ratelimit-remaining']}`);
  });
}

// ── Write Tests ──

async function runWriteTests(babyId) {
  console.log('\n\x1b[1m── Write Tests (POST) ──\x1b[0m\n');

  await test('POST feed (formula shorthand)', async () => {
    const res = await request('POST', `/babies/${babyId}/activities`, {
      type: 'feed',
      feedType: 'formula',
      amount: 4,
      unitAbbr: 'OZ',
    });
    assert(res.success, `Expected success, got: ${JSON.stringify(res.error)}`);
    assert(res.data.activityType === 'feed', 'Expected feed type');
    assert(res.data.details.type === 'BOTTLE', 'Expected BOTTLE as resolved feedType');
    assert(res.data.details.bottleType === 'formula', 'Expected formula as bottleType');
    assert(res.data.id, 'Expected record id');
    log(' ', `Created feed ${res.data.id} (formula → BOTTLE)`);
  });

  await test('POST feed (BREAST — backward compatible)', async () => {
    const res = await request('POST', `/babies/${babyId}/activities`, {
      type: 'feed',
      feedType: 'BREAST',
      side: 'LEFT',
    });
    assert(res.success, `Expected success, got: ${JSON.stringify(res.error)}`);
    assert(res.data.details.type === 'BREAST', 'Expected BREAST feedType');
    log(' ', `Created feed ${res.data.id}`);
  });

  await test('POST diaper (wet)', async () => {
    const res = await request('POST', `/babies/${babyId}/activities`, {
      type: 'diaper',
      diaperType: 'WET',
    });
    assert(res.success, `Expected success, got: ${JSON.stringify(res.error)}`);
    assert(res.data.activityType === 'diaper', 'Expected diaper type');
    log(' ', `Created diaper ${res.data.id}`);
  });

  await test('POST sleep (start then end)', async () => {
    const startRes = await request('POST', `/babies/${babyId}/activities`, {
      type: 'sleep',
      sleepType: 'NAP',
      action: 'start',
    });
    assert(startRes.success, `Start failed: ${JSON.stringify(startRes.error)}`);
    assert(startRes.data.details.isActive === true, 'Expected active sleep');
    log(' ', `Started sleep ${startRes.data.id}`);

    // Wait a moment then end it
    await new Promise(r => setTimeout(r, 500));

    const endRes = await request('POST', `/babies/${babyId}/activities`, {
      type: 'sleep',
      sleepType: 'NAP',
      action: 'end',
    });
    assert(endRes.success, `End failed: ${JSON.stringify(endRes.error)}`);
    assert(endRes.data.details.isActive === false, 'Expected inactive sleep');
    log(' ', `Ended sleep ${endRes.data.id}, duration: ${endRes.data.details.duration} min`);
  });

  await test('POST sleep (log with duration)', async () => {
    const res = await request('POST', `/babies/${babyId}/activities`, {
      type: 'sleep',
      sleepType: 'NAP',
      action: 'log',
      duration: 45,
    });
    assert(res.success, `Expected success, got: ${JSON.stringify(res.error)}`);
    assert(res.data.details.duration === 45, 'Expected 45 min duration');
    log(' ', `Logged sleep ${res.data.id}`);
  });

  await test('POST note', async () => {
    const res = await request('POST', `/babies/${babyId}/activities`, {
      type: 'note',
      content: 'API test note - safe to delete',
      category: 'test',
    });
    assert(res.success, `Expected success, got: ${JSON.stringify(res.error)}`);
    log(' ', `Created note ${res.data.id}`);
  });

  await test('POST bath', async () => {
    const res = await request('POST', `/babies/${babyId}/activities`, {
      type: 'bath',
      soapUsed: true,
      shampooUsed: false,
      notes: 'API test bath',
    });
    assert(res.success, `Expected success, got: ${JSON.stringify(res.error)}`);
    log(' ', `Created bath ${res.data.id}`);
  });

  await test('POST measurement (weight)', async () => {
    const res = await request('POST', `/babies/${babyId}/activities`, {
      type: 'measurement',
      measurementType: 'WEIGHT',
      value: 18.5,
      unit: 'LB',
    });
    assert(res.success, `Expected success, got: ${JSON.stringify(res.error)}`);
    log(' ', `Created measurement ${res.data.id}`);
  });

  // Validation tests
  await test('POST feed — missing feedType returns 400', async () => {
    const res = await request('POST', `/babies/${babyId}/activities`, {
      type: 'feed',
      amount: 4,
    });
    assert(!res.success, 'Expected failure');
    assert(res.error.code === 'INVALID_FEED_TYPE', `Expected INVALID_FEED_TYPE, got ${res.error.code}`);
  });

  await test('POST invalid type returns 400', async () => {
    const res = await request('POST', `/babies/${babyId}/activities`, {
      type: 'invalid_type',
    });
    assert(!res.success, 'Expected failure');
    assert(res.error.code === 'INVALID_ACTIVITY_TYPE', `Expected INVALID_ACTIVITY_TYPE, got ${res.error.code}`);
  });

  await test('POST sleep end with no active sleep returns 400', async () => {
    // End any active sleeps first by logging a completed one
    const res = await request('POST', `/babies/${babyId}/activities`, {
      type: 'sleep',
      sleepType: 'NAP',
      action: 'end',
    });
    // This might succeed (ending an existing one) or fail — either is fine for setup.
    // Now try again — should fail because no active sleep remains.
    const res2 = await request('POST', `/babies/${babyId}/activities`, {
      type: 'sleep',
      sleepType: 'NAP',
      action: 'end',
    });
    // If the first end succeeded, the second should fail
    if (res.success) {
      assert(!res2.success, 'Expected failure on second end');
      assert(res2.error.code === 'NO_ACTIVE_SLEEP', `Expected NO_ACTIVE_SLEEP, got ${res2.error.code}`);
    }
  });

  await test('POST pump (start then end)', async () => {
    const startRes = await request('POST', `/babies/${babyId}/activities`, {
      type: 'pump',
      action: 'start',
    });
    assert(startRes.success, `Start failed: ${JSON.stringify(startRes.error)}`);
    assert(startRes.data.details.isActive === true, 'Expected active pump');
    log(' ', `Started pump ${startRes.data.id}`);

    await new Promise(r => setTimeout(r, 500));

    const endRes = await request('POST', `/babies/${babyId}/activities`, {
      type: 'pump',
      action: 'end',
      leftAmount: 2,
      rightAmount: 1.5,
      unitAbbr: 'OZ',
    });
    assert(endRes.success, `End failed: ${JSON.stringify(endRes.error)}`);
    assert(endRes.data.details.isActive === false, 'Expected inactive pump');
    log(' ', `Ended pump ${endRes.data.id}, duration: ${endRes.data.details.duration} min`);
  });

  await test('POST pump (log with duration)', async () => {
    const res = await request('POST', `/babies/${babyId}/activities`, {
      type: 'pump',
      action: 'log',
      duration: 20,
      leftAmount: 3,
      rightAmount: 2,
      unitAbbr: 'OZ',
    });
    assert(res.success, `Expected success, got: ${JSON.stringify(res.error)}`);
    assert(res.data.details.duration === 20, 'Expected 20 min duration');
    log(' ', `Logged pump ${res.data.id}`);
  });

  await test('POST play (tummy time)', async () => {
    const res = await request('POST', `/babies/${babyId}/activities`, {
      type: 'play',
      playType: 'TUMMY_TIME',
      duration: 15,
      notes: 'API test tummy time',
    });
    assert(res.success, `Expected success, got: ${JSON.stringify(res.error)}`);
    assert(res.data.activityType === 'play', 'Expected play type');
    assert(res.data.details.type === 'TUMMY_TIME', 'Expected TUMMY_TIME');
    log(' ', `Created play ${res.data.id}`);
  });

  // Medicine with valid name (conditional on having medicines configured)
  await test('POST medicine — valid name (if available)', async () => {
    const refRes = await request('GET', `/babies/${babyId}/reference?type=medicines`);
    if (!refRes.success || !refRes.data.medicines || refRes.data.medicines.length === 0) {
      log(' ', 'No medicines configured — skipping valid medicine POST test');
      skipped++;
      passed--; // undo the auto-pass from test()
      return;
    }
    const med = refRes.data.medicines[0];
    const res = await request('POST', `/babies/${babyId}/activities`, {
      type: 'medicine',
      medicineName: med.name,
      amount: med.typicalDoseSize || 1,
      unitAbbr: med.unitAbbr || 'ML',
    });
    assert(res.success, `Expected success, got: ${JSON.stringify(res.error)}`);
    assert(res.data.activityType === 'medicine', 'Expected medicine type');
    assert(res.data.details.medicineName === med.name, `Expected ${med.name}`);
    log(' ', `Created medicine log ${res.data.id} (${med.name})`);
  });

  await test('POST medicine — nonexistent name returns 404', async () => {
    const res = await request('POST', `/babies/${babyId}/activities`, {
      type: 'medicine',
      medicineName: 'NonexistentMedicine12345',
      amount: 1,
    });
    assert(!res.success, 'Expected failure');
    assert(res.error.code === 'MEDICINE_NOT_FOUND', `Expected MEDICINE_NOT_FOUND, got ${res.error.code}`);
  });

  // Supplement with valid name (conditional on having supplements configured)
  await test('POST supplement — valid name (if available)', async () => {
    const refRes = await request('GET', `/babies/${babyId}/reference?type=supplements`);
    if (!refRes.success || !refRes.data.supplements || refRes.data.supplements.length === 0) {
      log(' ', 'No supplements configured — skipping valid supplement POST test');
      skipped++;
      passed--; // undo the auto-pass from test()
      return;
    }
    const sup = refRes.data.supplements[0];
    const res = await request('POST', `/babies/${babyId}/activities`, {
      type: 'supplement',
      supplementName: sup.name,
      amount: sup.typicalDoseSize || 1,
      unitAbbr: sup.unitAbbr || 'ML',
    });
    assert(res.success, `Expected success, got: ${JSON.stringify(res.error)}`);
    assert(res.data.activityType === 'supplement', 'Expected supplement type');
    assert(res.data.details.supplementName === sup.name, `Expected ${sup.name}`);
    log(' ', `Created supplement log ${res.data.id} (${sup.name})`);
  });

  await test('POST supplement — nonexistent name returns 404', async () => {
    const res = await request('POST', `/babies/${babyId}/activities`, {
      type: 'supplement',
      supplementName: 'NonexistentSupplement12345',
      amount: 1,
    });
    assert(!res.success, 'Expected failure');
    assert(res.error.code === 'SUPPLEMENT_NOT_FOUND', `Expected SUPPLEMENT_NOT_FOUND, got ${res.error.code}`);
  });
}

// ── Auth Tests ──

async function runAuthTests() {
  console.log('\n\x1b[1m── Auth Tests ──\x1b[0m\n');

  await test('Missing auth header returns 401', async () => {
    const res = await fetch(`${HOOKS_BASE}/babies`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const json = await res.json();
    assert(res.status === 401, `Expected 401, got ${res.status}`);
    assert(!json.success, 'Expected failure');
  });

  await test('Invalid API key returns 401', async () => {
    const res = await fetch(`${HOOKS_BASE}/babies`, {
      headers: {
        'Authorization': 'Bearer st_live_0000000000000000000000000000000000',
        'Content-Type': 'application/json',
      },
    });
    const json = await res.json();
    assert(res.status === 401, `Expected 401, got ${res.status}`);
    assert(!json.success, 'Expected failure');
  });

  await test('Bad token format returns 401', async () => {
    const res = await fetch(`${HOOKS_BASE}/babies`, {
      headers: {
        'Authorization': 'Bearer not_a_valid_key',
        'Content-Type': 'application/json',
      },
    });
    const json = await res.json();
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });
}

// ── Main ──

async function main() {
  console.log('\n\x1b[1;36m╔══════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[1;36m║   Sprout Track Webhook API Tests     ║\x1b[0m');
  console.log('\x1b[1;36m╚══════════════════════════════════════╝\x1b[0m\n');

  BASE_URL = (await prompt('Base URL', 'http://localhost:3000')).replace(/\/$/, '');
  HOOKS_BASE = `${BASE_URL}/api/hooks/v1`;

  API_KEY = await prompt('API Key (st_live_...)');
  if (!API_KEY || !API_KEY.startsWith('st_live_')) {
    console.error('\n\x1b[31mError: A valid API key starting with st_live_ is required.\x1b[0m');
    console.error('Create one in Settings > Admin > Integrations.\n');
    process.exit(1);
  }

  console.log(`\n  Base URL: ${HOOKS_BASE}`);
  console.log(`  API Key: ${API_KEY.substring(0, 16)}...`);

  // Auth tests always run
  await runAuthTests();

  // Discover babies
  const babiesRes = await request('GET', '/babies');
  if (!babiesRes.success || !babiesRes.data.babies.length) {
    console.error('\n\x1b[31mCould not list babies. Check your API key and that babies exist.\x1b[0m');
    if (babiesRes.error) console.error(`  Error: ${babiesRes.error.message || babiesRes.error}`);
    process.exit(1);
  }

  const babyId = babiesRes.data.babies[0].id;
  console.log(`  Testing with baby: ${babiesRes.data.babies[0].firstName} (${babyId})`);

  if (!writeOnly) {
    await runReadTests(babyId);
  }

  if (!readOnly) {
    await runWriteTests(babyId);
  }

  // Summary
  console.log('\n\x1b[1m── Summary ──\x1b[0m\n');
  console.log(`  \x1b[32m${passed} passed\x1b[0m`);
  if (failed > 0) console.log(`  \x1b[31m${failed} failed\x1b[0m`);
  if (skipped > 0) console.log(`  \x1b[33m${skipped} skipped\x1b[0m`);
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\n\x1b[31mUnexpected error:\x1b[0m', err);
  process.exit(1);
});
