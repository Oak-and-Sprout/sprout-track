/**
 * Play/Activity data generation script for Sprout Track
 * Generates realistic play activity logs over the last 60 days
 * for a selected family and baby.
 *
 * Run with: node scripts/generate-play-data.js
 *
 * Interactive mode: prompts for family and baby selection
 * Automated mode: set FAMILY_ID and BABY_ID environment variables
 */

const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');
const readline = require('readline');

const prisma = new PrismaClient();

// ── Utility functions ──

function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function generateTimeInDay(baseDate, hour, minuteVariation = 30) {
  const date = new Date(baseDate);
  date.setHours(hour, randomInt(0, minuteVariation), randomInt(0, 59), 0);
  return date;
}

// ── Play activity definitions ──

// Realistic schedule patterns by play type
const PLAY_PATTERNS = {
  TUMMY_TIME: {
    // Tummy time: short sessions, 2-4 times per day for young babies
    minDuration: 3,
    maxDuration: 15,
    sessionsPerDay: [2, 4],
    preferredHours: [8, 10, 13, 15, 17], // morning and afternoon
    activities: null, // tummy time has no sub-category
    probability: 0.85, // 85% of days
  },
  INDOOR_PLAY: {
    // Indoor play: moderate sessions, 1-3 per day
    minDuration: 10,
    maxDuration: 45,
    sessionsPerDay: [1, 3],
    preferredHours: [9, 11, 14, 16],
    activities: ['Sensory Play', 'Reading', 'Music', 'Arts & Crafts', 'Building Blocks', 'Puzzles'],
    probability: 0.70,
  },
  OUTDOOR_PLAY: {
    // Outdoor play: longer sessions, 0-2 per day, weather dependent
    minDuration: 15,
    maxDuration: 60,
    sessionsPerDay: [0, 2],
    preferredHours: [9, 10, 15, 16, 17],
    activities: ['Sandbox', 'Swings', 'Water Play', 'Garden', 'Playground', 'Bubbles'],
    probability: 0.45, // less frequent - weather, season dependent
  },
  WALK: {
    // Walks: moderate duration, typically once per day
    minDuration: 15,
    maxDuration: 45,
    sessionsPerDay: [0, 1],
    preferredHours: [8, 9, 10, 16, 17, 18],
    activities: ['Park', 'Stroller', 'Push Car', 'Wagon', 'Neighborhood', 'Trail'],
    probability: 0.55,
  },
};

// ── Data clearing ──

async function clearPlayData(babyId) {
  console.log('Clearing existing play data...');

  const result = await prisma.playLog.deleteMany({
    where: { babyId },
  });
  console.log(`  Deleted ${result.count} play logs`);
}

// ── Play log generation ──

function generatePlayLogs(baby, caretakers, familyId, startDate, endDate) {
  const logs = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay(); // 0=Sun, 6=Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    for (const [type, pattern] of Object.entries(PLAY_PATTERNS)) {
      // Adjust probability: outdoor play and walks more likely on weekends
      let adjustedProb = pattern.probability;
      if (isWeekend && (type === 'OUTDOOR_PLAY' || type === 'WALK')) {
        adjustedProb = Math.min(1.0, adjustedProb + 0.25);
      }

      // Skip this type for today?
      if (Math.random() > adjustedProb) continue;

      // How many sessions today
      const [minSessions, maxSessions] = pattern.sessionsPerDay;
      const sessionCount = randomInt(minSessions, maxSessions);
      if (sessionCount === 0) continue;

      // Pick random hours from preferred, ensuring no overlap
      const availableHours = [...pattern.preferredHours];
      const selectedHours = [];
      for (let i = 0; i < sessionCount && availableHours.length > 0; i++) {
        const idx = randomInt(0, availableHours.length - 1);
        selectedHours.push(availableHours[idx]);
        // Remove nearby hours to avoid overlapping sessions
        availableHours.splice(Math.max(0, idx - 1), 3);
      }
      selectedHours.sort((a, b) => a - b);

      for (const hour of selectedHours) {
        const startTime = generateTimeInDay(currentDate, hour, 45);
        if (startTime > endDate) continue;

        const duration = randomInt(pattern.minDuration, pattern.maxDuration);
        const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

        // Pick a sub-category activity if available
        const activity = pattern.activities ? randomChoice(pattern.activities) : null;

        // Occasionally add a note (~15% chance)
        let notes = null;
        if (Math.random() < 0.15) {
          const noteOptions = [
            'Really enjoyed this!',
            'A bit fussy today',
            'Great session',
            'Cut short - got tired',
            'New milestone during play!',
            'Very engaged',
            'With older sibling',
            null,
          ];
          notes = randomChoice(noteOptions);
        }

        logs.push({
          id: randomUUID(),
          startTime,
          endTime,
          duration,
          type,
          notes,
          activities: activity,
          babyId: baby.id,
          caretakerId: randomChoice(caretakers).id,
          familyId,
        });
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return logs;
}

// ── Interactive parameter gathering ──

async function getParameters() {
  // Automated mode
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
      clearData: process.env.CLEAR_PLAY === 'true',
    };
  }

  // Interactive mode
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('========================================');
  console.log('   Play Activity Data Generator');
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

  // Clear data option
  const clearInput = await ask(rl, '\nClear existing play data for this baby? (y/N): ');
  const clearData = /^[Yy]$/.test(clearInput);

  // Confirmation
  console.log('\n========================================');
  console.log('Configuration:');
  console.log('========================================');
  console.log(`Family:     ${family.name} (${family.slug})`);
  console.log(`Baby:       ${baby.firstName} ${baby.lastName}`);
  console.log(`Range:      Last 60 days`);
  console.log(`Clear data: ${clearData}`);
  console.log(`Caretakers: ${family.caretakers.length}`);
  console.log('');
  console.log('Will generate:');
  console.log('  - Tummy Time: 2-4 short sessions/day (3-15 min), ~85% of days');
  console.log('  - Indoor Play: 1-3 sessions/day (10-45 min), ~70% of days');
  console.log('  - Outdoor Play: 0-2 sessions/day (15-60 min), ~45% of days');
  console.log('  - Walks: 0-1 sessions/day (15-45 min), ~55% of days');
  console.log('  - More outdoor/walk activity on weekends');
  console.log('');

  const confirm = await ask(rl, 'Proceed? (y/N): ');
  rl.close();

  if (!/^[Yy]$/.test(confirm)) {
    console.log('Cancelled.');
    process.exit(0);
  }

  return {
    family,
    baby,
    caretakers: family.caretakers,
    clearData,
  };
}

// ── Main ──

async function main() {
  try {
    const { family, baby, caretakers, clearData } = await getParameters();

    if (clearData) {
      await clearPlayData(baby.id);
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 60);
    startDate.setHours(0, 0, 0, 0);

    console.log(`\nGenerating play data from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);

    const playLogs = generatePlayLogs(baby, caretakers, family.id, startDate, endDate);

    if (playLogs.length > 0) {
      await prisma.playLog.createMany({ data: playLogs });
    }

    // Count by type
    const countByType = {};
    for (const log of playLogs) {
      countByType[log.type] = (countByType[log.type] || 0) + 1;
    }

    // Summary
    console.log('\n========================================');
    console.log('   Play data generation complete!');
    console.log('========================================');
    console.log(`Total sessions:  ${playLogs.length}`);
    for (const [type, count] of Object.entries(countByType).sort((a, b) => b[1] - a[1])) {
      const label = {
        TUMMY_TIME: 'Tummy Time',
        INDOOR_PLAY: 'Indoor Play',
        OUTDOOR_PLAY: 'Outdoor Play',
        WALK: 'Walk',
      }[type] || type;
      console.log(`  ${label}: ${count} sessions`);
    }
    console.log(`\nView in Reports > Stats > Activity Statistics for ${baby.firstName}`);

  } catch (error) {
    console.error('Error generating play data:', error);
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
