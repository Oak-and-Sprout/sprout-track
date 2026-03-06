/**
 * Breast milk inventory data generation script for Sprout Track
 * Generates pump logs (STORED), breast milk bottle feeds, and adjustments
 * Run with: node scripts/generate-inventory-data.js
 *
 * Interactive mode: prompts for family, baby, days, and clear option
 * Automated mode: set FAMILY_ID, BABY_ID, DAYS_COUNT, CLEAR_INVENTORY env vars
 */

const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');
const readline = require('readline');

const prisma = new PrismaClient();

// Utility functions
function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

function isSameDay(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

function generateCutoffTime() {
  const now = new Date();
  const minutesAgo = randomInt(15, 180);
  return new Date(now.getTime() - (minutesAgo * 60 * 1000));
}

function generateTimeInDay(baseDate, hour, minuteVariation = 30, maxTime = null) {
  const date = new Date(baseDate);
  date.setHours(hour);
  date.setMinutes(randomInt(-minuteVariation, minuteVariation));
  date.setSeconds(randomInt(0, 59));
  if (maxTime && date > maxTime) {
    return maxTime;
  }
  return date;
}

function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

// Clear existing inventory data for a baby
async function clearInventoryData(babyId) {
  console.log('Clearing existing inventory data...');

  const pumpResult = await prisma.pumpLog.deleteMany({
    where: { babyId, pumpAction: 'STORED' },
  });
  console.log(`  Deleted ${pumpResult.count} STORED pump logs`);

  const feedResult = await prisma.feedLog.deleteMany({
    where: {
      babyId,
      type: 'BOTTLE',
      bottleType: { in: ['Breast Milk', 'Formula\\Breast'] },
    },
  });
  console.log(`  Deleted ${feedResult.count} breast milk bottle feeds`);

  const adjResult = await prisma.breastMilkAdjustment.deleteMany({
    where: { babyId },
  });
  console.log(`  Deleted ${adjResult.count} breast milk adjustments`);
}

// Generate pump logs with pumpAction STORED
function generatePumpLogs(baby, caretakers, familyId, startDate, endDate, cutoffTime) {
  const logs = [];
  const currentDate = new Date(startDate);

  const pumpNotes = [
    'Morning pump session',
    'Afternoon pump',
    'Evening pump',
    'Late night pump',
    'Pumped after feeding',
    'Power pump session',
    null,
    null,
  ];

  const pumpTimeSlots = [
    { hour: 6, chance: 0.85 },
    { hour: 9, chance: 0.75 },
    { hour: 12, chance: 0.65 },
    { hour: 15, chance: 0.75 },
    { hour: 18, chance: 0.85 },
    { hour: 21, chance: 0.60 },
  ];

  while (currentDate <= endDate) {
    const isToday = isSameDay(currentDate, new Date());
    const selectedSlots = pumpTimeSlots
      .filter(slot => Math.random() < slot.chance)
      .sort((a, b) => a.hour - b.hour);

    for (const slot of selectedSlots) {
      const pumpStart = generateTimeInDay(currentDate, slot.hour, 45, isToday ? cutoffTime : null);
      if (pumpStart > cutoffTime) continue;

      const durationMinutes = randomInt(15, 35);
      let pumpEnd = new Date(pumpStart.getTime() + durationMinutes * 60 * 1000);
      if (pumpEnd > cutoffTime) pumpEnd = cutoffTime;

      const actualDuration = Math.floor((pumpEnd.getTime() - pumpStart.getTime()) / (1000 * 60));
      if (actualDuration <= 0) continue;

      const leftAmount = randomFloat(1.0, 5.0);
      const rightAmount = randomFloat(1.0, 5.0);
      const totalAmount = Math.round((leftAmount + rightAmount) * 10) / 10;

      logs.push({
        id: randomUUID(),
        startTime: pumpStart,
        endTime: pumpEnd,
        duration: actualDuration,
        leftAmount,
        rightAmount,
        totalAmount,
        unitAbbr: 'OZ',
        pumpAction: 'STORED',
        notes: randomChoice(pumpNotes),
        babyId: baby.id,
        caretakerId: randomChoice(caretakers).id,
        familyId,
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return logs;
}

// Generate bottle feeds with breast milk
function generateBottleFeeds(baby, caretakers, familyId, startDate, endDate, cutoffTime) {
  const logs = [];
  const currentDate = new Date(startDate);

  const feedNotes = [
    'Finished the whole bottle',
    'Left a little bit',
    'Very hungry today',
    'Fussy at first',
    null,
    null,
  ];

  const feedTimeSlots = [
    { hour: 7, chance: 0.90 },
    { hour: 10, chance: 0.80 },
    { hour: 13, chance: 0.85 },
    { hour: 16, chance: 0.75 },
    { hour: 19, chance: 0.90 },
    { hour: 22, chance: 0.50 },
  ];

  while (currentDate <= endDate) {
    const isToday = isSameDay(currentDate, new Date());
    const selectedSlots = feedTimeSlots
      .filter(slot => Math.random() < slot.chance)
      .sort((a, b) => a.hour - b.hour);

    for (const slot of selectedSlots) {
      const feedTime = generateTimeInDay(currentDate, slot.hour, 45, isToday ? cutoffTime : null);
      if (feedTime > cutoffTime) continue;

      const amount = randomFloat(2.0, 5.0);

      logs.push({
        id: randomUUID(),
        time: feedTime,
        type: 'BOTTLE',
        bottleType: 'Breast Milk',
        amount,
        unitAbbr: 'OZ',
        notes: randomChoice(feedNotes),
        babyId: baby.id,
        caretakerId: randomChoice(caretakers).id,
        familyId,
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return logs;
}

// Generate breast milk adjustments (occasional)
function generateAdjustments(baby, caretakers, familyId, startDate, endDate, cutoffTime) {
  const logs = [];
  const currentDate = new Date(startDate);

  // Initial stock adjustment on the first day
  logs.push({
    id: randomUUID(),
    time: generateTimeInDay(startDate, 8, 30),
    amount: randomFloat(15.0, 40.0),
    unitAbbr: 'OZ',
    reason: 'Initial Stock',
    notes: 'Starting inventory',
    babyId: baby.id,
    caretakerId: randomChoice(caretakers).id,
    familyId,
  });

  // Occasional adjustments every 7-14 days
  currentDate.setDate(currentDate.getDate() + randomInt(7, 14));

  while (currentDate <= endDate) {
    const isToday = isSameDay(currentDate, new Date());
    const adjTime = generateTimeInDay(currentDate, randomInt(9, 17), 60, isToday ? cutoffTime : null);
    if (adjTime > cutoffTime) break;

    // 70% negative (expired/spilled), 30% positive (donated to us, found more)
    const isNegative = Math.random() < 0.7;
    const reasons = isNegative
      ? [{ reason: 'Expired', min: -8.0, max: -2.0 }, { reason: 'Spilled', min: -2.0, max: -0.5 }]
      : [{ reason: 'Other', min: 5.0, max: 15.0 }];

    const chosen = randomChoice(reasons);

    logs.push({
      id: randomUUID(),
      time: adjTime,
      amount: randomFloat(Math.min(chosen.min, chosen.max), Math.max(chosen.min, chosen.max)),
      unitAbbr: 'OZ',
      reason: chosen.reason,
      notes: null,
      babyId: baby.id,
      caretakerId: randomChoice(caretakers).id,
      familyId,
    });

    currentDate.setDate(currentDate.getDate() + randomInt(7, 14));
  }

  return logs;
}

// Interactive parameter gathering
async function getParameters() {
  // Check for automated mode
  if (process.env.FAMILY_ID && process.env.BABY_ID) {
    const family = await prisma.family.findFirst({
      where: { id: process.env.FAMILY_ID, isActive: true },
      include: { caretakers: { where: { inactive: false } } },
    });
    if (!family) {
      console.error(`Family not found: ${process.env.FAMILY_ID}`);
      process.exit(1);
    }
    const baby = await prisma.baby.findFirst({
      where: { id: process.env.BABY_ID, familyId: family.id, inactive: false },
    });
    if (!baby) {
      console.error(`Baby not found: ${process.env.BABY_ID}`);
      process.exit(1);
    }
    return {
      family,
      baby,
      caretakers: family.caretakers,
      daysCount: parseInt(process.env.DAYS_COUNT) || 30,
      clearData: process.env.CLEAR_INVENTORY === 'true',
    };
  }

  // Interactive mode
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('========================================');
  console.log('   Breast Milk Inventory Data Generator');
  console.log('========================================\n');

  // List families
  const families = await prisma.family.findMany({
    where: { isActive: true },
    include: {
      caretakers: { where: { inactive: false } },
      babies: { where: { inactive: false } },
    },
    orderBy: { name: 'asc' },
  });

  if (families.length === 0) {
    console.log('No active families found. Create a family first.');
    rl.close();
    process.exit(1);
  }

  console.log('Select a family:\n');
  families.forEach((f, i) => {
    const babyCount = f.babies.length;
    console.log(`  [${i + 1}] ${f.name} (slug: ${f.slug}, ${babyCount} ${babyCount === 1 ? 'baby' : 'babies'})`);
  });

  let familyIdx;
  while (true) {
    const input = await ask(rl, `\nEnter number (1-${families.length}): `);
    familyIdx = parseInt(input) - 1;
    if (familyIdx >= 0 && familyIdx < families.length) break;
    console.log('Invalid selection.');
  }

  const family = families[familyIdx];

  if (family.babies.length === 0) {
    console.log(`No active babies in ${family.name}. Add a baby first.`);
    rl.close();
    process.exit(1);
  }

  if (family.caretakers.length === 0) {
    console.log(`No active caretakers in ${family.name}. Add a caretaker first.`);
    rl.close();
    process.exit(1);
  }

  // List babies
  console.log(`\nSelect a baby from ${family.name}:\n`);
  family.babies.forEach((b, i) => {
    const born = b.birthDate.toISOString().split('T')[0];
    console.log(`  [${i + 1}] ${b.firstName} ${b.lastName} (born ${born})`);
  });

  let babyIdx;
  while (true) {
    const input = await ask(rl, `\nEnter number (1-${family.babies.length}): `);
    babyIdx = parseInt(input) - 1;
    if (babyIdx >= 0 && babyIdx < family.babies.length) break;
    console.log('Invalid selection.');
  }

  const baby = family.babies[babyIdx];

  // Days count
  let daysCount = 30;
  const daysInput = await ask(rl, '\nHow many days of data to generate? (1-90, default: 30): ');
  if (daysInput) {
    const parsed = parseInt(daysInput);
    if (parsed >= 1 && parsed <= 90) daysCount = parsed;
  }

  // Clear data
  const clearInput = await ask(rl, '\nClear existing inventory data for this baby? (y/N): ');
  const clearData = /^[Yy]$/.test(clearInput);

  // Confirmation
  console.log('\n========================================');
  console.log('Configuration Summary:');
  console.log('========================================');
  console.log(`Family: ${family.name} (${family.slug})`);
  console.log(`Baby: ${baby.firstName} ${baby.lastName}`);
  console.log(`Days: ${daysCount}`);
  console.log(`Clear existing data: ${clearData}`);
  console.log(`Caretakers available: ${family.caretakers.length}`);
  console.log('');

  const confirm = await ask(rl, 'Proceed with data generation? (y/N): ');
  rl.close();

  if (!/^[Yy]$/.test(confirm)) {
    console.log('Cancelled.');
    process.exit(0);
  }

  return {
    family,
    baby,
    caretakers: family.caretakers,
    daysCount,
    clearData,
  };
}

// Main
async function main() {
  try {
    const { family, baby, caretakers, daysCount, clearData } = await getParameters();

    if (clearData) {
      await clearInventoryData(baby.id);
    }

    const cutoffTime = generateCutoffTime();
    const endDate = new Date(cutoffTime);
    const startDate = new Date(endDate.getTime() - (daysCount * 24 * 60 * 60 * 1000));

    console.log(`\nGenerating inventory data from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);

    // Generate data
    const pumpLogs = generatePumpLogs(baby, caretakers, family.id, startDate, endDate, cutoffTime);
    const feedLogs = generateBottleFeeds(baby, caretakers, family.id, startDate, endDate, cutoffTime);
    const adjustments = generateAdjustments(baby, caretakers, family.id, startDate, endDate, cutoffTime);

    // Insert
    if (pumpLogs.length > 0) {
      await prisma.pumpLog.createMany({ data: pumpLogs });
    }
    if (feedLogs.length > 0) {
      await prisma.feedLog.createMany({ data: feedLogs });
    }
    if (adjustments.length > 0) {
      await prisma.breastMilkAdjustment.createMany({ data: adjustments });
    }

    // Summary
    const totalStored = pumpLogs.reduce((sum, l) => sum + (l.totalAmount || 0), 0);
    const totalConsumed = feedLogs.reduce((sum, l) => sum + (l.amount || 0), 0);
    const totalAdjusted = adjustments.reduce((sum, l) => sum + l.amount, 0);

    console.log('\n========================================');
    console.log('   Inventory data generation complete!');
    console.log('========================================');
    console.log(`Pump logs (STORED): ${pumpLogs.length} (${totalStored.toFixed(1)} oz total)`);
    console.log(`Bottle feeds (BM):  ${feedLogs.length} (${totalConsumed.toFixed(1)} oz total)`);
    console.log(`Adjustments:        ${adjustments.length} (${totalAdjusted.toFixed(1)} oz net)`);
    console.log(`Estimated balance:  ${(totalStored + totalAdjusted - totalConsumed).toFixed(1)} oz`);

  } catch (error) {
    console.error('Error generating inventory data:', error);
    process.exit(1);
  }
}

main()
  .catch(e => {
    console.error('Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
