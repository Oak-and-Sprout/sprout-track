/**
 * Health data generation script for Sprout Track
 * Generates medicines, supplements, medicine logs, vaccine logs, and temperature measurements
 * over the last 60 days for a selected family and baby.
 *
 * Run with: node scripts/generate-health-data.js
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

function randomFloat(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
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

// ── Medicine & Supplement definitions ──

const MEDICINES = [
  {
    name: 'Infant Tylenol',
    typicalDoseSize: 2.5,
    unitAbbr: 'ml',
    doseMinTime: '04:00', // every 4 hours minimum
    notes: 'Acetaminophen 160mg/5ml. For fever and pain relief.',
    isSupplement: false,
  },
  {
    name: 'Infant Motrin',
    typicalDoseSize: 1.25,
    unitAbbr: 'ml',
    doseMinTime: '06:00', // every 6 hours minimum
    notes: 'Ibuprofen 50mg/1.25ml. For fever, pain, and inflammation. 6+ months only.',
    isSupplement: false,
  },
];

const SUPPLEMENTS = [
  {
    name: 'Vitamin D Drops',
    typicalDoseSize: 1,
    unitAbbr: 'ml',
    doseMinTime: '24:00', // once daily
    notes: '400 IU per drop. Recommended daily for breastfed infants.',
    isSupplement: true,
  },
  {
    name: 'Iron Supplement',
    typicalDoseSize: 1,
    unitAbbr: 'ml',
    doseMinTime: '24:00', // once daily
    notes: 'Ferrous sulfate 15mg/ml. For iron-deficient infants.',
    isSupplement: true,
  },
];

// ── Vaccine definitions ──

const VACCINES = [
  { name: 'DTaP', doseNumber: 1, notes: 'Diphtheria, Tetanus, Pertussis - first dose' },
  { name: 'IPV', doseNumber: 1, notes: 'Inactivated Poliovirus - first dose' },
  { name: 'Hep B', doseNumber: 2, notes: 'Hepatitis B - second dose' },
];

// ── Data clearing ──

async function clearHealthData(babyId, familyId) {
  console.log('Clearing existing health test data...');

  // Delete medicine logs for this baby
  const medLogResult = await prisma.medicineLog.deleteMany({
    where: { babyId },
  });
  console.log(`  Deleted ${medLogResult.count} medicine logs`);

  // Delete medicines for this family (soft-delete aware)
  const medResult = await prisma.medicine.deleteMany({
    where: { familyId },
  });
  console.log(`  Deleted ${medResult.count} medicines`);

  // Delete vaccine logs for this baby (hard delete includes documents)
  const vaccineDocResult = await prisma.vaccineDocument.deleteMany({
    where: { vaccineLog: { babyId } },
  });
  if (vaccineDocResult.count > 0) {
    console.log(`  Deleted ${vaccineDocResult.count} vaccine documents`);
  }
  const vaccResult = await prisma.vaccineLog.deleteMany({
    where: { babyId },
  });
  console.log(`  Deleted ${vaccResult.count} vaccine logs`);

  // Delete temperature measurements for this baby
  const tempResult = await prisma.measurement.deleteMany({
    where: { babyId, type: 'TEMPERATURE' },
  });
  console.log(`  Deleted ${tempResult.count} temperature measurements`);
}

// ── Unit creation (ensures FK target exists) ──

async function ensureUnit(unitAbbr, unitName, activityTypes) {
  let unit = await prisma.unit.findUnique({ where: { unitAbbr } });
  if (!unit) {
    unit = await prisma.unit.create({
      data: {
        id: randomUUID(),
        unitAbbr,
        unitName,
        activityTypes,
      },
    });
    console.log(`  Created unit: ${unitAbbr} (${unitName})`);
  } else {
    console.log(`  Found existing unit: ${unitAbbr} (${unit.unitName})`);
  }
  return unit;
}

// ── Medicine/Supplement creation ──

async function ensureMedicines(familyId) {
  // Ensure all required units exist in the Unit table (FK constraint)
  const requiredUnits = new Set([...MEDICINES, ...SUPPLEMENTS].map(d => d.unitAbbr));
  for (const abbr of requiredUnits) {
    await ensureUnit(abbr, abbr === 'ml' ? 'milliliter' : abbr, 'medicine');
  }

  const created = [];

  for (const def of [...MEDICINES, ...SUPPLEMENTS]) {
    // Check if it already exists for this family
    let medicine = await prisma.medicine.findFirst({
      where: { name: def.name, familyId, deletedAt: null },
    });

    if (!medicine) {
      medicine = await prisma.medicine.create({
        data: {
          id: randomUUID(),
          name: def.name,
          typicalDoseSize: def.typicalDoseSize,
          unitAbbr: def.unitAbbr,
          doseMinTime: def.doseMinTime,
          notes: def.notes,
          isSupplement: def.isSupplement,
          active: true,
          familyId,
        },
      });
      console.log(`  Created ${def.isSupplement ? 'supplement' : 'medicine'}: ${def.name}`);
    } else {
      console.log(`  Found existing ${def.isSupplement ? 'supplement' : 'medicine'}: ${def.name}`);
    }

    created.push(medicine);
  }

  return created;
}

// ── Medicine log generation ──

function generateMedicineLogs(medicines, baby, caretakers, familyId, startDate, endDate) {
  const logs = [];

  for (const med of medicines) {
    const def = [...MEDICINES, ...SUPPLEMENTS].find(d => d.name === med.name);
    if (!def) continue;

    const currentDate = new Date(startDate);

    if (def.isSupplement) {
      // Supplements: once daily, ~90% consistency
      while (currentDate <= endDate) {
        if (Math.random() < 0.90) {
          // Morning dose between 7-9am
          const time = generateTimeInDay(currentDate, randomInt(7, 9));
          if (time <= endDate) {
            logs.push({
              id: randomUUID(),
              time,
              doseAmount: def.typicalDoseSize,
              unitAbbr: def.unitAbbr,
              notes: null,
              medicineId: med.id,
              babyId: baby.id,
              caretakerId: randomChoice(caretakers).id,
              familyId,
            });
          }
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else {
      // Medicines: given in 2-4 day "illness episodes"
      // Create 3-4 episodes over the 60-day range
      const episodeCount = randomInt(3, 4);
      const rangeMs = endDate.getTime() - startDate.getTime();
      const usedDays = new Set();

      for (let ep = 0; ep < episodeCount; ep++) {
        const episodeStart = new Date(startDate.getTime() + Math.random() * rangeMs * 0.85);
        episodeStart.setHours(0, 0, 0, 0);
        const episodeDays = randomInt(2, 4);

        for (let d = 0; d < episodeDays; d++) {
          const dayDate = new Date(episodeStart);
          dayDate.setDate(dayDate.getDate() + d);
          if (dayDate > endDate) break;

          const dayKey = dayDate.toISOString().split('T')[0];
          if (usedDays.has(dayKey)) continue;
          usedDays.add(dayKey);

          // Parse doseMinTime to figure out how many doses per day
          const [minHrs] = def.doseMinTime.split(':').map(Number);
          const dosesPerDay = Math.floor(24 / minHrs);
          const actualDoses = randomInt(Math.max(1, dosesPerDay - 1), dosesPerDay);

          // Spread doses throughout the day
          const baseHours = [8, 12, 16, 20, 6, 14, 22];
          const selectedHours = baseHours.slice(0, actualDoses).sort((a, b) => a - b);

          for (const hour of selectedHours) {
            const time = generateTimeInDay(dayDate, hour, 45);
            if (time > endDate) continue;

            // Vary dose slightly from typical
            const doseVariation = randomFloat(0.8, 1.1);
            const doseAmount = Math.round(def.typicalDoseSize * doseVariation * 10) / 10;

            logs.push({
              id: randomUUID(),
              time,
              doseAmount,
              unitAbbr: def.unitAbbr,
              notes: d === 0 && hour === selectedHours[0]
                ? randomChoice(['Fever detected', 'Teething pain', 'Post-vaccination discomfort', null])
                : null,
              medicineId: med.id,
              babyId: baby.id,
              caretakerId: randomChoice(caretakers).id,
              familyId,
            });
          }
        }
      }
    }
  }

  return logs;
}

// ── Vaccine log generation ──

function generateVaccineLogs(baby, caretakers, familyId, startDate, endDate) {
  const logs = [];

  // Pick a single day about 3-4 weeks into the range for a "well-baby visit"
  const visitOffset = randomInt(18, 28);
  const visitDate = new Date(startDate);
  visitDate.setDate(visitDate.getDate() + visitOffset);

  // All vaccines given at ~10am on the same day
  const visitTime = generateTimeInDay(visitDate, 10, 15);

  for (const vax of VACCINES) {
    logs.push({
      id: randomUUID(),
      time: visitTime,
      vaccineName: vax.name,
      doseNumber: vax.doseNumber,
      notes: vax.notes,
      babyId: baby.id,
      caretakerId: randomChoice(caretakers).id,
      familyId,
    });
  }

  return logs;
}

// ── Temperature measurement generation ──

function generateTemperatures(baby, caretakers, familyId, startDate, endDate) {
  const measurements = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    // Every 2-3 days
    const skip = randomInt(2, 3);

    // Normal temperature range 97.5-99.1 F, with occasional low fever
    const isFever = Math.random() < 0.08; // ~8% chance of mild fever
    const temp = isFever
      ? randomFloat(99.5, 101.2)
      : randomFloat(97.5, 99.1);

    const time = generateTimeInDay(currentDate, randomInt(7, 19), 30);
    if (time <= endDate) {
      measurements.push({
        id: randomUUID(),
        date: time,
        type: 'TEMPERATURE',
        value: temp,
        unit: 'F',
        notes: isFever ? 'Slightly elevated' : null,
        babyId: baby.id,
        caretakerId: randomChoice(caretakers).id,
        familyId,
      });
    }

    currentDate.setDate(currentDate.getDate() + skip);
  }

  return measurements;
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
      clearData: process.env.CLEAR_HEALTH === 'true',
    };
  }

  // Interactive mode
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('========================================');
  console.log('   Health Data Generator');
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
  const clearInput = await ask(rl, '\nClear existing health data for this baby? (y/N): ');
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
  console.log(`  - 2 medicines (Infant Tylenol, Infant Motrin) with episodic dosing`);
  console.log(`  - 2 supplements (Vitamin D Drops, Iron Supplement) with daily dosing`);
  console.log(`  - 3 vaccines (DTaP, IPV, Hep B) on a single visit day`);
  console.log(`  - Temperature readings every 2-3 days`);
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
      await clearHealthData(baby.id, family.id);
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 60);
    startDate.setHours(0, 0, 0, 0);

    console.log(`\nGenerating health data from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);

    // 1. Create/find medicines and supplements
    console.log('\n── Medicines & Supplements ──');
    const medicines = await ensureMedicines(family.id);

    // 2. Generate medicine/supplement logs
    console.log('\n── Medicine Logs ──');
    const medicineLogs = generateMedicineLogs(medicines, baby, caretakers, family.id, startDate, endDate);
    if (medicineLogs.length > 0) {
      await prisma.medicineLog.createMany({ data: medicineLogs });
    }

    const medLogs = medicineLogs.filter(l => {
      const med = medicines.find(m => m.id === l.medicineId);
      return med && !med.isSupplement;
    });
    const supLogs = medicineLogs.filter(l => {
      const med = medicines.find(m => m.id === l.medicineId);
      return med && med.isSupplement;
    });
    console.log(`  Created ${medLogs.length} medicine dose logs`);
    console.log(`  Created ${supLogs.length} supplement dose logs`);

    // 3. Generate vaccine logs
    console.log('\n── Vaccine Logs ──');
    const vaccineLogs = generateVaccineLogs(baby, caretakers, family.id, startDate, endDate);
    if (vaccineLogs.length > 0) {
      await prisma.vaccineLog.createMany({ data: vaccineLogs });
    }
    console.log(`  Created ${vaccineLogs.length} vaccine records`);
    const visitDate = new Date(vaccineLogs[0].time);
    console.log(`  Visit date: ${visitDate.toLocaleDateString()}`);

    // 4. Generate temperature measurements
    console.log('\n── Temperature Measurements ──');
    const temperatures = generateTemperatures(baby, caretakers, family.id, startDate, endDate);
    if (temperatures.length > 0) {
      await prisma.measurement.createMany({ data: temperatures });
    }
    console.log(`  Created ${temperatures.length} temperature readings`);

    // Summary
    console.log('\n========================================');
    console.log('   Health data generation complete!');
    console.log('========================================');
    console.log(`Medicine doses:     ${medLogs.length}`);
    console.log(`Supplement doses:   ${supLogs.length}`);
    console.log(`Vaccine records:    ${vaccineLogs.length}`);
    console.log(`Temperature reads:  ${temperatures.length}`);
    console.log(`\nView in Reports > Health tab for ${baby.firstName}`);

  } catch (error) {
    console.error('Error generating health data:', error);
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
