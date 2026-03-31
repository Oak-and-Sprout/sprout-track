/**
 * Demo family data generation script for Sprout Track
 * Creates a single demo family based on existing family data
 * Run with: node scripts/generate-demo-data.js
 */

const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Source family ID to copy data from
const SOURCE_FAMILY_ID = 'cmcqdc0gj0000s6xh8gp1sj0x';
const DEMO_FAMILY_SLUG = 'demo';
const DEMO_CARETAKER_LOGIN_ID = '01';
const DEMO_CARETAKER_PIN = '111111';

// Random name arrays for demo family
const maleFirstNames = [
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles',
  'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua'
];

const femaleFirstNames = [
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen',
  'Nancy', 'Lisa', 'Betty', 'Helen', 'Sandra', 'Donna', 'Carol', 'Ruth', 'Sharon', 'Michelle'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'
];

// Note content examples for random generation
const noteTemplates = [
  "Baby was very fussy during feeding time today",
  "Slept through the night for the first time!",
  "Pediatrician appointment scheduled for next week",
  "Started showing interest in solid foods",
  "Had a great day at the park",
  "Trying new sleep routine tonight",
  "Baby seemed extra giggly today",
  "Running low on diapers - need to buy more",
  "Grandmother visited and baby was so happy",
  "First time rolling over from back to tummy!",
  "Teething seems to be starting",
  "Baby loves the new toy we got",
  "Had to change clothes 3 times today - lots of spit up",
  "Daycare said baby played well with other children",
  "Trying to establish better feeding schedule"
];

// Medicine/supplement definitions for demo family
const DEMO_SUPPLEMENTS = [
  { name: 'Vitamin D Drops', dose: 1, unitAbbr: 'ml', doseMinTime: '24:00',
    notes: '400 IU per drop. Recommended daily for breastfed infants.', isSupplement: true },
];
const DEMO_MEDICINES = [
  { name: 'Infant Tylenol', dose: 2.5, unitAbbr: 'ml', doseMinTime: '04:00',
    notes: 'Acetaminophen 160mg/5ml. For fever and pain relief.', isSupplement: false },
  { name: 'Infant Motrin', dose: 1.25, unitAbbr: 'ml', doseMinTime: '06:00',
    notes: 'Ibuprofen 50mg/1.25ml. For fever, pain, and inflammation.', isSupplement: false },
];

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

// CDC growth chart helpers
function loadCdcData(filename) {
  const filePath = path.join(__dirname, '..', 'documentation', filename);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.trim().split('\n');
  // Skip header row
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    return {
      sex: parseInt(cols[0]),    // 1=male, 2=female
      agemos: parseFloat(cols[1]),
      L: parseFloat(cols[2]),
      M: parseFloat(cols[3]),
      S: parseFloat(cols[4])
    };
  });
}

function interpolateLMS(cdcData, sex, ageMonths) {
  const sexData = cdcData.filter(r => r.sex === sex);
  // Clamp to data range
  if (ageMonths <= sexData[0].agemos) return sexData[0];
  if (ageMonths >= sexData[sexData.length - 1].agemos) return sexData[sexData.length - 1];
  // Find bracketing rows
  let lower, upper;
  for (let i = 0; i < sexData.length - 1; i++) {
    if (sexData[i].agemos <= ageMonths && sexData[i + 1].agemos >= ageMonths) {
      lower = sexData[i];
      upper = sexData[i + 1];
      break;
    }
  }
  if (!lower) return sexData[sexData.length - 1];
  if (lower.agemos === upper.agemos) return lower;
  const t = (ageMonths - lower.agemos) / (upper.agemos - lower.agemos);
  return {
    L: lower.L + t * (upper.L - lower.L),
    M: lower.M + t * (upper.M - lower.M),
    S: lower.S + t * (upper.S - lower.S)
  };
}

function calculateMeasurement(L, M, S, zScore) {
  if (Math.abs(L) < 0.001) {
    return M * Math.exp(S * zScore);
  }
  return M * Math.pow(1 + L * S * zScore, 1 / L);
}

// Check if a time falls during any interval (sleep, feed, pump, etc.)
function isDuringSleep(time, sleepIntervals) {
  return sleepIntervals.some(s =>
    time >= s.startTime && s.endTime && time <= s.endTime
  );
}

// Check if a time range overlaps with any existing intervals
function overlapsAny(startTime, endTime, intervals) {
  return intervals.some(iv =>
    startTime < iv.endTime && endTime > iv.startTime
  );
}

// Generate 60 random days between March-June 2025
function generateRandomDates() {
  // March 1, 2025 to June 30, 2025
  const startOfPeriod = new Date('2025-03-01T00:00:00Z');
  const endOfPeriod = new Date('2025-06-30T23:59:59Z');

  const totalDaysAvailable = Math.floor((endOfPeriod - startOfPeriod) / (1000 * 60 * 60 * 24));
  const randomDates = [];

  // Generate 60 unique random dates
  const usedDays = new Set();
  while (randomDates.length < 60) {
    const randomDay = randomInt(0, totalDaysAvailable);
    if (!usedDays.has(randomDay)) {
      usedDays.add(randomDay);
      const randomDate = new Date(startOfPeriod.getTime() + (randomDay * 24 * 60 * 60 * 1000));
      randomDates.push(randomDate);
    }
  }
  
  // Sort dates chronologically for consistent processing
  randomDates.sort((a, b) => a.getTime() - b.getTime());
  
  return randomDates;
}

// Generate mapping from source dates to target dates (last 60 days)
function generateDateMapping(sourceDates) {
  const now = new Date();
  const cutoffTime = new Date(now.getTime() - (60 * 60 * 1000)); // 1 hour ago
  const mapping = [];

  for (let i = 0; i < sourceDates.length; i++) {
    const daysAgo = 59 - i; // Start with 59 days ago, end with today
    const targetDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    
    // For today (daysAgo = 0), use cutoff time as the max time
    const maxTime = daysAgo === 0 ? cutoffTime : null;
    
    mapping.push({
      sourceDate: sourceDates[i],
      targetDate: targetDate,
      maxTime: maxTime,
      daysAgo: daysAgo
    });
  }
  
  return mapping;
}

// Check if existing demo family exists
async function findExistingDemoFamily() {
  return await prisma.family.findFirst({
    where: { slug: DEMO_FAMILY_SLUG },
    include: {
      babies: true,
      caretakers: true,
      settings: true
    }
  });
}

// Delete existing demo family and all related data
async function deleteExistingDemoFamily(demoFamily) {
  console.log('Deleting existing demo family data...');
  
  const familyId = demoFamily.id;
  
  // Delete demo tracker record first
  try {
    await prisma.demoTracker.deleteMany({
      where: { familyId: familyId }
    });
    console.log('  Cleared demo tracker records');
  } catch (error) {
    console.log(`  Note: Could not clear demo tracker: ${error.message}`);
  }
  
  // Delete junction tables first (many-to-many relationships)
  const junctionTables = [
    'babyEvent', 'caretakerEvent', 'contactEvent', 'contactMedicine', 'contactVaccine', 'familyMember'
  ];
  
  for (const table of junctionTables) {
    try {
      // For junction tables, we need to find records through related entities
      if (table === 'familyMember') {
        await prisma.familyMember.deleteMany({
          where: { familyId: familyId }
        });
      } else if (table === 'babyEvent') {
        // Delete baby events for babies in this family
        const babies = await prisma.baby.findMany({
          where: { familyId: familyId },
          select: { id: true }
        });
        const babyIds = babies.map(b => b.id);
        if (babyIds.length > 0) {
          await prisma.babyEvent.deleteMany({
            where: { babyId: { in: babyIds } }
          });
        }
      } else if (table === 'caretakerEvent') {
        // Delete caretaker events for caretakers in this family
        const caretakers = await prisma.caretaker.findMany({
          where: { familyId: familyId },
          select: { id: true }
        });
        const caretakerIds = caretakers.map(c => c.id);
        if (caretakerIds.length > 0) {
          await prisma.caretakerEvent.deleteMany({
            where: { caretakerId: { in: caretakerIds } }
          });
        }
      } else if (table === 'contactEvent') {
        // Delete contact events for contacts in this family
        const contacts = await prisma.contact.findMany({
          where: { familyId: familyId },
          select: { id: true }
        });
        const contactIds = contacts.map(c => c.id);
        if (contactIds.length > 0) {
          await prisma.contactEvent.deleteMany({
            where: { contactId: { in: contactIds } }
          });
        }
      } else if (table === 'contactMedicine') {
        // Delete contact medicine relationships for contacts in this family
        const contacts = await prisma.contact.findMany({
          where: { familyId: familyId },
          select: { id: true }
        });
        const contactIds = contacts.map(c => c.id);
        if (contactIds.length > 0) {
          await prisma.contactMedicine.deleteMany({
            where: { contactId: { in: contactIds } }
          });
        }
      } else if (table === 'contactVaccine') {
        // Delete contact vaccine relationships for contacts in this family
        const contacts = await prisma.contact.findMany({
          where: { familyId: familyId },
          select: { id: true }
        });
        const contactIds = contacts.map(c => c.id);
        if (contactIds.length > 0) {
          await prisma.contactVaccine.deleteMany({
            where: { contactId: { in: contactIds } }
          });
        }
      }
      console.log(`  Cleared ${table} junction records for demo family`);
    } catch (error) {
      console.log(`  Note: Could not clear ${table} junction records: ${error.message}`);
    }
  }
  
  // Delete vaccine documents (FK to vaccineLog) before deleting vaccine logs
  try {
    const vaccineLogs = await prisma.vaccineLog.findMany({
      where: { familyId: familyId },
      select: { id: true }
    });
    const vaccineLogIds = vaccineLogs.map(v => v.id);
    if (vaccineLogIds.length > 0) {
      await prisma.vaccineDocument.deleteMany({
        where: { vaccineLogId: { in: vaccineLogIds } }
      });
    }
    console.log('  Cleared vaccineDocument records for demo family');
  } catch (error) {
    console.log(`  Note: Could not clear vaccineDocument records: ${error.message}`);
  }

  // Delete notification logs and preferences (FK to pushSubscription) before deleting subscriptions
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { familyId: familyId },
      select: { id: true }
    });
    const subscriptionIds = subscriptions.map(s => s.id);
    if (subscriptionIds.length > 0) {
      await prisma.notificationLog.deleteMany({
        where: { subscriptionId: { in: subscriptionIds } }
      });
      await prisma.notificationPreference.deleteMany({
        where: { subscriptionId: { in: subscriptionIds } }
      });
    }
    console.log('  Cleared notificationLog and notificationPreference records for demo family');
  } catch (error) {
    console.log(`  Note: Could not clear notification records: ${error.message}`);
  }

  // Delete in order to respect foreign key constraints
  // Models with familyId field - ordered to handle dependencies
  const modelsWithFamilyId = [
    // Activity logs (depend on baby/caretaker)
    'sleepLog', 'feedLog', 'diaperLog', 'moodLog', 'note', 'milestone',
    'pumpLog', 'playLog', 'bathLog', 'measurement', 'medicineLog',
    'breastMilkAdjustment', 'activeBreastFeed', 'vaccineLog',

    // Push subscriptions, feedback, API keys (have direct familyId)
    'pushSubscription', 'feedback', 'apiKey',

    // Calendar events (depend on babies/caretakers through junction tables)
    'calendarEvent',

    // Medicine and contacts
    'medicine', 'contact',

    // Core entities
    'baby', 'caretaker',

    // Settings and family setup
    'settings', 'familySetup'
  ];
  
  // Delete records with familyId
  for (const model of modelsWithFamilyId) {
    try {
      await prisma[model].deleteMany({
        where: { familyId: familyId }
      });
      console.log(`  Cleared ${model} records for demo family`);
    } catch (error) {
      console.log(`  Note: Could not clear ${model} for demo family: ${error.message}`);
    }
  }
  
  // Delete the family record itself (uses id, not familyId)
  try {
    await prisma.family.delete({
      where: { id: familyId }
    });
    console.log(`  Cleared family record`);
  } catch (error) {
    console.log(`  Note: Could not clear family record: ${error.message}`);
  }
}

// Get source family data for the random dates
async function getSourceFamilyData(sourceDates) {
  console.log(`Fetching source data from ${SOURCE_FAMILY_ID} for ${sourceDates.length} random dates...`);
  
  const [family, babies] = await Promise.all([
    prisma.family.findUnique({
      where: { id: SOURCE_FAMILY_ID },
      include: { settings: true }
    }),
    prisma.baby.findMany({
      where: { familyId: SOURCE_FAMILY_ID }
    })
  ]);
  
  if (!family) {
    throw new Error(`Source family ${SOURCE_FAMILY_ID} not found`);
  }
  
  // Get data for each random date
  const allSleepLogs = [];
  const allFeedLogs = [];
  const allDiaperLogs = [];
  
  for (const sourceDate of sourceDates) {
    const dayStart = new Date(sourceDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(sourceDate);
    dayEnd.setHours(23, 59, 59, 999);
    
    const [sleepLogs, feedLogs, diaperLogs] = await Promise.all([
      prisma.sleepLog.findMany({
        where: {
          familyId: SOURCE_FAMILY_ID,
          startTime: {
            gte: dayStart,
            lte: dayEnd
          }
        },
        include: { baby: true }
      }),
      prisma.feedLog.findMany({
        where: {
          familyId: SOURCE_FAMILY_ID,
          time: {
            gte: dayStart,
            lte: dayEnd
          }
        },
        include: { baby: true }
      }),
      prisma.diaperLog.findMany({
        where: {
          familyId: SOURCE_FAMILY_ID,
          time: {
            gte: dayStart,
            lte: dayEnd
          }
        },
        include: { baby: true }
      })
    ]);
    
    // Add source date to each log for mapping
    sleepLogs.forEach(log => log.sourceDate = sourceDate);
    feedLogs.forEach(log => log.sourceDate = sourceDate);
    diaperLogs.forEach(log => log.sourceDate = sourceDate);
    
    allSleepLogs.push(...sleepLogs);
    allFeedLogs.push(...feedLogs);
    allDiaperLogs.push(...diaperLogs);
  }
  
  console.log(`Found source data: ${babies.length} babies, ${allSleepLogs.length} sleep logs, ${allFeedLogs.length} feed logs, ${allDiaperLogs.length} diaper logs`);
  
  return { family, babies, sleepLogs: allSleepLogs, feedLogs: allFeedLogs, diaperLogs: allDiaperLogs };
}

// Create demo family
async function createDemoFamily() {
  const demoLastName = randomChoice(lastNames);
  
  const family = await prisma.family.create({
    data: {
      id: randomUUID(),
      slug: DEMO_FAMILY_SLUG,
      name: `${demoLastName} Family (Demo)`,
      isActive: true
    }
  });
  
  // Create family settings
  await prisma.settings.create({
    data: {
      id: randomUUID(),
      familyId: family.id,
      familyName: family.name,
      securityPin: DEMO_CARETAKER_PIN,
      authType: 'CARETAKER',
      defaultBottleUnit: 'OZ',
      defaultSolidsUnit: 'TBSP',
      defaultHeightUnit: 'IN',
      defaultWeightUnit: 'LB',
      defaultTempUnit: 'F'
    }
  });
  
  console.log(`Created demo family: ${family.name} (${family.slug})`);
  return family;
}

// Create demo caretaker
async function createDemoCaretaker(family) {
  const firstName = randomChoice(femaleFirstNames); // Parent name
  
  const caretaker = await prisma.caretaker.create({
    data: {
      id: randomUUID(),
      loginId: DEMO_CARETAKER_LOGIN_ID,
      name: firstName,
      type: 'Parent',
      role: 'ADMIN',
      inactive: false,
      securityPin: DEMO_CARETAKER_PIN,
      familyId: family.id
    }
  });
  
  // Create family member relationship
  await prisma.familyMember.create({
    data: {
      familyId: family.id,
      caretakerId: caretaker.id,
      role: 'admin'
    }
  });
  
  console.log(`Created demo caretaker: ${firstName} (${DEMO_CARETAKER_LOGIN_ID})`);
  return caretaker;
}

// Create demo baby based on first source baby
async function createDemoBabies(family, sourceBabies) {
  const demoBabies = [];
  const demoLastName = family.name.replace(' Family (Demo)', '');
  
  // Only create one baby based on the first source baby
  if (sourceBabies.length > 0) {
    const sourceBaby = sourceBabies[0]; // Use the first baby as template
    const gender = sourceBaby.gender || 'FEMALE';
    const firstName = gender === 'MALE' ? randomChoice(maleFirstNames) : randomChoice(femaleFirstNames);
    
    // Generate random birthDate for baby to be 4-5 months old
    const now = new Date();
    const minDaysAgo = 120; // 4 months (approximately)
    const maxDaysAgo = 150; // 5 months (approximately)
    const randomDaysAgo = randomInt(minDaysAgo, maxDaysAgo);
    const birthDate = new Date(now.getTime() - (randomDaysAgo * 24 * 60 * 60 * 1000));
    
    const demoBaby = await prisma.baby.create({
      data: {
        id: randomUUID(),
        firstName: firstName,
        lastName: demoLastName,
        birthDate: birthDate,
        gender: gender,
        inactive: false,
        familyId: family.id,
        feedWarningTime: sourceBaby.feedWarningTime,
        diaperWarningTime: sourceBaby.diaperWarningTime
      }
    });
    
    // Create mappings for all source babies to this single demo baby
    // This allows us to use logs from all source babies for the one demo baby
    for (const sb of sourceBabies) {
      demoBabies.push({ demo: demoBaby, source: sb });
    }
  }
  
  console.log(`Created 1 demo baby (mapped from ${sourceBabies.length} source babies)`);
  return demoBabies;
}

// Transform and create sleep logs
async function createDemoSleepLogs(family, caretaker, babyMappings, sourceSleepLogs, dateMapping) {
  const demoLogs = [];
  
  for (const sourceLog of sourceSleepLogs) {
    const babyMapping = babyMappings.find(m => m.source.id === sourceLog.babyId);
    if (!babyMapping) continue;
    
    // Find the mapping for this source date
    const mapping = dateMapping.find(m => 
      m.sourceDate.toDateString() === sourceLog.sourceDate.toDateString()
    );
    if (!mapping) continue;
    
    // Calculate time offset from source date to target date
    const sourceDay = new Date(sourceLog.sourceDate);
    sourceDay.setHours(0, 0, 0, 0);
    const targetDay = new Date(mapping.targetDate);
    targetDay.setHours(0, 0, 0, 0);
    const dateOffset = targetDay.getTime() - sourceDay.getTime();
    
    const startTime = new Date(sourceLog.startTime.getTime() + dateOffset);
    const endTime = sourceLog.endTime ? new Date(sourceLog.endTime.getTime() + dateOffset) : null;
    
    // Check if this falls within the allowed time range (respect maxTime for today)
    if (mapping.maxTime && startTime > mapping.maxTime) {
      continue; // Skip entries that are too recent for today
    }
    
    // If endTime would be beyond maxTime, truncate it
    let finalEndTime = endTime;
    if (mapping.maxTime && endTime && endTime > mapping.maxTime) {
      finalEndTime = mapping.maxTime;
    }
    
    // Recalculate duration if endTime was truncated
    const duration = finalEndTime ? Math.floor((finalEndTime - startTime) / (1000 * 60)) : sourceLog.duration;
    
    // Only add if duration is positive
    if (duration > 0) {
      demoLogs.push({
        id: randomUUID(),
        startTime: startTime,
        endTime: finalEndTime,
        duration: duration,
        type: sourceLog.type,
        location: sourceLog.location,
        quality: sourceLog.quality,
        babyId: babyMapping.demo.id,
        caretakerId: caretaker.id,
        familyId: family.id
      });
    }
  }
  
  if (demoLogs.length > 0) {
    await prisma.sleepLog.createMany({ data: demoLogs });
  }

  // Return sleep intervals for other generators to avoid overlapping
  const sleepIntervals = demoLogs.map(log => ({
    startTime: log.startTime,
    endTime: log.endTime
  }));

  console.log(`Created ${demoLogs.length} demo sleep logs`);
  return { sleepCount: demoLogs.length, sleepIntervals };
}

// Transform source feed logs: ~50% of BOTTLE→BREAST, keep SOLIDS as-is, skip during sleep
async function createDemoFeedLogs(family, caretaker, babyMappings, sourceFeedLogs, dateMapping, sleepIntervals) {
  const demoLogs = [];
  const breastFeedTimes = []; // Track times for pump overlap avoidance
  let sideToggle = 0; // Alternate LEFT/RIGHT for breast feeds

  for (const sourceLog of sourceFeedLogs) {
    const babyMapping = babyMappings.find(m => m.source.id === sourceLog.babyId);
    if (!babyMapping) continue;

    const mapping = dateMapping.find(m =>
      m.sourceDate.toDateString() === sourceLog.sourceDate.toDateString()
    );
    if (!mapping) continue;

    const sourceDay = new Date(sourceLog.sourceDate);
    sourceDay.setHours(0, 0, 0, 0);
    const targetDay = new Date(mapping.targetDate);
    targetDay.setHours(0, 0, 0, 0);
    const dateOffset = targetDay.getTime() - sourceDay.getTime();

    const time = new Date(sourceLog.time.getTime() + dateOffset);

    if (mapping.maxTime && time > mapping.maxTime) continue;
    if (isDuringSleep(time, sleepIntervals)) continue;

    // Keep SOLIDS feeds as-is
    if (sourceLog.type === 'SOLIDS') {
      demoLogs.push({
        id: randomUUID(),
        time: time,
        startTime: sourceLog.startTime ? new Date(sourceLog.startTime.getTime() + dateOffset) : null,
        endTime: sourceLog.endTime ? new Date(sourceLog.endTime.getTime() + dateOffset) : null,
        feedDuration: sourceLog.feedDuration,
        type: 'SOLIDS',
        amount: sourceLog.amount,
        unitAbbr: sourceLog.unitAbbr,
        side: null,
        food: sourceLog.food,
        babyId: babyMapping.demo.id,
        caretakerId: caretaker.id,
        familyId: family.id
      });
      continue;
    }

    // For BOTTLE feeds, convert ~50% to BREAST
    if (sourceLog.type === 'BOTTLE' && Math.random() < 0.5) {
      const feedDurationSec = randomInt(5, 20) * 60; // 5-20 minutes in seconds
      const startTime = new Date(time);
      const endTime = new Date(time.getTime() + feedDurationSec * 1000);
      const side = sideToggle % 2 === 0 ? 'LEFT' : 'RIGHT';
      sideToggle++;

      demoLogs.push({
        id: randomUUID(),
        time: time,
        startTime: startTime,
        endTime: endTime,
        feedDuration: feedDurationSec,
        type: 'BREAST',
        amount: null,
        unitAbbr: null,
        side: side,
        food: null,
        babyId: babyMapping.demo.id,
        caretakerId: caretaker.id,
        familyId: family.id
      });

      breastFeedTimes.push(time);
    } else {
      // Keep as BOTTLE feed
      demoLogs.push({
        id: randomUUID(),
        time: time,
        startTime: sourceLog.startTime ? new Date(sourceLog.startTime.getTime() + dateOffset) : null,
        endTime: sourceLog.endTime ? new Date(sourceLog.endTime.getTime() + dateOffset) : null,
        feedDuration: sourceLog.feedDuration,
        type: sourceLog.type,
        amount: sourceLog.amount,
        unitAbbr: sourceLog.unitAbbr,
        side: sourceLog.side,
        food: sourceLog.food,
        babyId: babyMapping.demo.id,
        caretakerId: caretaker.id,
        familyId: family.id
      });
    }
  }

  if (demoLogs.length > 0) {
    await prisma.feedLog.createMany({ data: demoLogs });
  }

  // Collect feed intervals for overlap checking
  const feedIntervals = demoLogs
    .filter(l => l.startTime && l.endTime)
    .map(l => ({ startTime: l.startTime, endTime: l.endTime }));

  const breastCount = demoLogs.filter(l => l.type === 'BREAST').length;
  const bottleCount = demoLogs.filter(l => l.type === 'BOTTLE').length;
  const solidsCount = demoLogs.filter(l => l.type === 'SOLIDS').length;
  console.log(`Created ${demoLogs.length} demo feed logs (${breastCount} breast, ${bottleCount} bottle, ${solidsCount} solids)`);
  return { feedCount: demoLogs.length, breastFeedTimes, feedIntervals };
}

// Transform and create diaper logs
async function createDemoDiaperLogs(family, caretaker, babyMappings, sourceDiaperLogs, dateMapping) {
  const demoLogs = [];
  
  for (const sourceLog of sourceDiaperLogs) {
    const babyMapping = babyMappings.find(m => m.source.id === sourceLog.babyId);
    if (!babyMapping) continue;
    
    // Find the mapping for this source date
    const mapping = dateMapping.find(m => 
      m.sourceDate.toDateString() === sourceLog.sourceDate.toDateString()
    );
    if (!mapping) continue;
    
    // Calculate time offset from source date to target date
    const sourceDay = new Date(sourceLog.sourceDate);
    sourceDay.setHours(0, 0, 0, 0);
    const targetDay = new Date(mapping.targetDate);
    targetDay.setHours(0, 0, 0, 0);
    const dateOffset = targetDay.getTime() - sourceDay.getTime();
    
    const time = new Date(sourceLog.time.getTime() + dateOffset);
    
    // Check if this falls within the allowed time range (respect maxTime for today)
    if (mapping.maxTime && time > mapping.maxTime) {
      continue; // Skip entries that are too recent for today
    }
    
    demoLogs.push({
      id: randomUUID(),
      time: time,
      type: sourceLog.type,
      condition: sourceLog.condition,
      color: sourceLog.color,
      babyId: babyMapping.demo.id,
      caretakerId: caretaker.id,
      familyId: family.id
    });
  }
  
  if (demoLogs.length > 0) {
    await prisma.diaperLog.createMany({ data: demoLogs });
  }
  
  console.log(`Created ${demoLogs.length} demo diaper logs`);
  return demoLogs.length;
}

// Generate random bath logs using date mapping
async function generateDemoBathLogs(family, caretaker, babyMappings, dateMapping) {
  const logs = [];
  
  for (const mapping of dateMapping) {
    for (const babyMapping of babyMappings) {
      // 80% chance of bath per day, usually in the evening
      if (Math.random() > 0.2) {
        const bathTime = new Date(mapping.targetDate);
        bathTime.setHours(19, randomInt(-60, 60), randomInt(0, 59)); // 7 PM +/- 1 hour
        
        // Check if this falls within the allowed time range (respect maxTime for today)
        if (mapping.maxTime && bathTime > mapping.maxTime) {
          continue; // Skip bath logs that are too recent for today
        }
        
        const soapUsed = Math.random() > 0.1; // 90% chance
        const shampooUsed = Math.random() > 0.3; // 70% chance
        
        logs.push({
          id: randomUUID(),
          time: bathTime,
          soapUsed: soapUsed,
          shampooUsed: shampooUsed,
          notes: Math.random() > 0.7 ? randomChoice([
            'Baby loved splashing in the water',
            'Calm and relaxed during bath',
            'Fussy at first but settled down',
            'Enjoyed playing with bath toys',
            'Very sleepy after bath'
          ]) : null,
          babyId: babyMapping.demo.id,
          caretakerId: caretaker.id,
          familyId: family.id
        });
      }
    }
  }
  
  if (logs.length > 0) {
    await prisma.bathLog.createMany({ data: logs });
  }

  // Bath ~15 min interval for overlap checking
  const bathIntervals = logs.map(l => ({
    startTime: l.time,
    endTime: new Date(l.time.getTime() + 15 * 60 * 1000)
  }));

  console.log(`Generated ${logs.length} demo bath logs`);
  return { bathCount: logs.length, bathIntervals };
}

// Generate random notes using date mapping
async function generateDemoNotes(family, caretaker, babyMappings, dateMapping) {
  const logs = [];
  
  for (const mapping of dateMapping) {
    for (const babyMapping of babyMappings) {
      // 60% chance of note per day (roughly 1 every day or two)
      if (Math.random() > 0.4) {
        const noteTime = new Date(mapping.targetDate);
        noteTime.setHours(randomInt(8, 20), randomInt(0, 30), randomInt(0, 59));
        
        // Check if this falls within the allowed time range (respect maxTime for today)
        if (mapping.maxTime && noteTime > mapping.maxTime) {
          continue; // Skip notes that are too recent for today
        }
        
        logs.push({
          id: randomUUID(),
          time: noteTime,
          content: randomChoice(noteTemplates),
          category: randomChoice(['General', 'Feeding', 'Sleep', 'Development', 'Health']),
          babyId: babyMapping.demo.id,
          caretakerId: caretaker.id,
          familyId: family.id
        });
      }
    }
  }
  
  if (logs.length > 0) {
    await prisma.note.createMany({ data: logs });
  }
  
  console.log(`Generated ${logs.length} demo notes`);
  return logs.length;
}

// Generate pump logs (~every 3 hours), avoiding sleep and breast feed times
async function generateDemoPumpLogs(family, caretaker, babyMappings, dateMapping, breastFeedTimes, sleepIntervals) {
  const logs = [];
  const pumpHours = [6, 9, 12, 15, 18, 21]; // Every 3 hours, 6am-9pm

  for (const mapping of dateMapping) {
    for (const babyMapping of babyMappings) {
      for (const baseHour of pumpHours) {
        // Add +/- 30 min jitter
        const jitterMin = randomInt(-30, 30);
        const pumpStart = new Date(mapping.targetDate);
        pumpStart.setHours(baseHour, jitterMin, randomInt(0, 59), 0);

        if (mapping.maxTime && pumpStart > mapping.maxTime) continue;
        if (isDuringSleep(pumpStart, sleepIntervals)) continue;

        // Skip if within 30 minutes of a breast feed
        const tooClose = breastFeedTimes.some(ft =>
          Math.abs(ft.getTime() - pumpStart.getTime()) < 30 * 60 * 1000
        );
        if (tooClose) continue;

        const duration = randomInt(15, 25); // minutes
        const pumpEnd = new Date(pumpStart.getTime() + duration * 60 * 1000);

        // 3-5 oz base with +/- 30% variance
        const baseAmount = randomFloat(3.0, 5.0);
        const totalAmount = Math.round(baseAmount * (0.7 + Math.random() * 0.6) * 10) / 10;
        const leftPct = 0.4 + Math.random() * 0.2;
        const leftAmount = Math.round(totalAmount * leftPct * 10) / 10;
        const rightAmount = Math.round((totalAmount - leftAmount) * 10) / 10;

        logs.push({
          id: randomUUID(),
          startTime: pumpStart,
          endTime: pumpEnd,
          duration: duration,
          leftAmount: leftAmount,
          rightAmount: rightAmount,
          totalAmount: totalAmount,
          unitAbbr: 'OZ',
          pumpAction: 'STORED',
          babyId: babyMapping.demo.id,
          caretakerId: caretaker.id,
          familyId: family.id
        });
      }
    }
  }

  if (logs.length > 0) {
    await prisma.pumpLog.createMany({ data: logs });
  }

  const pumpIntervals = logs.map(l => ({ startTime: l.startTime, endTime: l.endTime }));

  console.log(`Generated ${logs.length} demo pump logs`);
  return { pumpCount: logs.length, pumpIntervals };
}

// Generate growth measurements at each CDC age increment from birth to now
async function generateDemoMeasurements(family, caretaker, babyMappings) {
  const lengthData = loadCdcData('lenageinf.csv');
  const weightData = loadCdcData('wtageinf.csv');
  const hcData = loadCdcData('hcageinf.csv');

  const logs = [];
  const now = new Date();

  for (const babyMapping of babyMappings) {
    const baby = babyMapping.demo;
    const sex = baby.gender === 'MALE' ? 1 : 2;

    // Consistent z-scores per measurement type (near average, -0.5 to +0.5)
    const zHeight = (Math.random() - 0.5);
    const zWeight = (Math.random() - 0.5);
    const zHC = (Math.random() - 0.5);

    // Baby's current age in months
    const currentAgeMonths = (now.getTime() - baby.birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);

    // CDC age rows for this sex, filtered to baby's age range
    const cdcAges = lengthData
      .filter(r => r.sex === sex && r.agemos <= currentAgeMonths)
      .map(r => r.agemos);
    // Deduplicate
    const uniqueAges = [...new Set(cdcAges)].sort((a, b) => a - b);

    for (const ageMo of uniqueAges) {
      // Calculate calendar date for this age
      const measureDate = new Date(baby.birthDate.getTime() + ageMo * 30.4375 * 24 * 60 * 60 * 1000);
      measureDate.setHours(randomInt(8, 12), randomInt(0, 59), 0, 0);

      // Don't create future measurements
      if (measureDate > now) continue;

      // Use exact CDC values at this age row (no interpolation needed)
      const hLms = interpolateLMS(lengthData, sex, ageMo);
      const heightCm = calculateMeasurement(hLms.L, hLms.M, hLms.S, zHeight);
      const heightIn = Math.round((heightCm / 2.54 + (Math.random() - 0.5) * 0.1) * 10) / 10;

      const wLms = interpolateLMS(weightData, sex, ageMo);
      const weightKg = calculateMeasurement(wLms.L, wLms.M, wLms.S, zWeight);
      const weightLb = Math.round((weightKg * 2.2046 + (Math.random() - 0.5) * 0.1) * 10) / 10;

      const hcLms = interpolateLMS(hcData, sex, ageMo);
      const hcCm = Math.round((calculateMeasurement(hcLms.L, hcLms.M, hcLms.S, zHC) + (Math.random() - 0.5) * 0.1) * 10) / 10;

      logs.push(
        {
          id: randomUUID(),
          date: measureDate,
          type: 'HEIGHT',
          value: heightIn,
          unit: 'IN',
          babyId: baby.id,
          caretakerId: caretaker.id,
          familyId: family.id
        },
        {
          id: randomUUID(),
          date: measureDate,
          type: 'WEIGHT',
          value: weightLb,
          unit: 'LB',
          babyId: baby.id,
          caretakerId: caretaker.id,
          familyId: family.id
        },
        {
          id: randomUUID(),
          date: measureDate,
          type: 'HEAD_CIRCUMFERENCE',
          value: hcCm,
          unit: 'CM',
          babyId: baby.id,
          caretakerId: caretaker.id,
          familyId: family.id
        }
      );
    }
  }

  if (logs.length > 0) {
    await prisma.measurement.createMany({ data: logs });
  }

  const countPerType = logs.length / 3;
  console.log(`Generated ${logs.length} demo measurements (${countPerType} entries at CDC age rows from birth to now)`);
  return logs.length;
}

// Generate play/activity logs (tummy time, indoor play, walks, outdoor play)
// Avoids overlapping with sleep, feeds, pumps, baths, and other activities
async function generateDemoPlayLogs(family, caretaker, babyMappings, dateMapping, busyIntervals, sleepIntervals) {
  const logs = [];

  const playTypes = [
    { type: 'TUMMY_TIME', durationRange: [5, 15], activities: null },
    { type: 'INDOOR_PLAY', durationRange: [10, 30], activities: ['Sensory Play', 'Reading', 'Music'] },
    { type: 'OUTDOOR_PLAY', durationRange: [15, 40], activities: ['Sandbox', 'Swings', 'Water Play'] },
    { type: 'WALK', durationRange: [15, 30], activities: ['Park', 'Stroller', 'Wagon'] },
  ];

  // Two windows per day in Central time (UTC-5 / UTC-6):
  //   Morning: 8-11 CT → 13-16 UTC (CDT) or 14-17 UTC (CST)
  //   Afternoon: 1-4 PM CT → 18-21 UTC (CDT) or 19-22 UTC (CST)
  // Use CDT (UTC-5) as the baseline since March-June is daylight saving time
  const CT_OFFSET = 5; // hours behind UTC for CDT
  const morningWindow = { startHour: 8 + CT_OFFSET, endHour: 11 + CT_OFFSET };   // 13-16 UTC
  const afternoonWindow = { startHour: 13 + CT_OFFSET, endHour: 16 + CT_OFFSET }; // 18-21 UTC

  // Current Central time hour to determine if afternoon window is reachable today
  const nowUtc = new Date();
  const nowCentralHour = (nowUtc.getUTCHours() - CT_OFFSET + 24) % 24;

  const allBusy = [...busyIntervals];

  for (const mapping of dateMapping) {
    for (const babyMapping of babyMappings) {
      const isToday = mapping.daysAgo === 0;

      // Determine which windows to use: always morning, afternoon only if not today or past 1pm CT
      const windows = [morningWindow];
      if (!isToday || nowCentralHour >= 13) {
        windows.push(afternoonWindow);
      }

      // Pick one activity type per window: morning = tummy time, afternoon = random
      const windowActivities = [
        playTypes[0], // morning: tummy time
        randomChoice(playTypes), // afternoon: random
      ];

      for (let w = 0; w < windows.length; w++) {
        const win = windows[w];
        const actDef = windowActivities[w];
        const durationMin = randomInt(actDef.durationRange[0], actDef.durationRange[1]);

        // Try a few random times within the window
        let placed = false;
        for (let attempt = 0; attempt < 5; attempt++) {
          const startTime = new Date(mapping.targetDate);
          const startHourUtc = randomInt(win.startHour, win.endHour - 1);
          startTime.setUTCHours(startHourUtc, randomInt(0, 45), randomInt(0, 59), 0);
          const endTime = new Date(startTime.getTime() + durationMin * 60 * 1000);

          if (mapping.maxTime && startTime > mapping.maxTime) continue;
          if (isDuringSleep(startTime, sleepIntervals)) continue;
          if (isDuringSleep(endTime, sleepIntervals)) continue;
          if (overlapsAny(startTime, endTime, allBusy)) continue;

          const activity = actDef.activities ? randomChoice(actDef.activities) : null;

          logs.push({
            id: randomUUID(),
            startTime: startTime,
            endTime: endTime,
            duration: durationMin,
            type: actDef.type,
            activities: activity,
            notes: Math.random() > 0.8 ? randomChoice([
              'Really enjoyed this session',
              'A bit fussy at first',
              'Lots of smiles today',
              'Getting stronger every day',
              'Loved watching the other kids',
            ]) : null,
            babyId: babyMapping.demo.id,
            caretakerId: caretaker.id,
            familyId: family.id
          });

          allBusy.push({ startTime, endTime });
          placed = true;
          break;
        }
      }
    }
  }

  if (logs.length > 0) {
    await prisma.playLog.createMany({ data: logs });
  }

  const typeCounts = {};
  logs.forEach(l => { typeCounts[l.type] = (typeCounts[l.type] || 0) + 1; });
  const breakdown = Object.entries(typeCounts).map(([k, v]) => `${v} ${k.toLowerCase().replace('_', ' ')}`).join(', ');
  console.log(`Generated ${logs.length} demo play logs (${breakdown})`);
  return logs.length;
}

// Generate medicines, supplements, and medicine logs
async function generateDemoMedicines(family, caretaker, babyMappings, dateMapping, sleepIntervals) {
  // Ensure the ml unit exists
  let unit = await prisma.unit.findUnique({ where: { unitAbbr: 'ml' } });
  if (!unit) {
    unit = await prisma.unit.create({
      data: { id: randomUUID(), unitAbbr: 'ml', unitName: 'milliliter', activityTypes: 'medicine' }
    });
  }

  const allDefs = [...DEMO_SUPPLEMENTS, ...DEMO_MEDICINES];
  const medicineRecords = [];

  for (const def of allDefs) {
    const med = await prisma.medicine.create({
      data: {
        id: randomUUID(),
        name: def.name,
        typicalDoseSize: def.dose,
        unitAbbr: def.unitAbbr,
        doseMinTime: def.doseMinTime,
        notes: def.notes,
        isSupplement: def.isSupplement,
        active: true,
        familyId: family.id
      }
    });
    medicineRecords.push({ ...def, id: med.id });
  }

  const logs = [];

  for (const babyMapping of babyMappings) {
    const baby = babyMapping.demo;

    // --- Vitamin D: 90-95% daily, morning dose ---
    const vitD = medicineRecords.find(m => m.name === 'Vitamin D Drops');
    for (const mapping of dateMapping) {
      if (Math.random() < 0.07) continue; // ~7% skip for 90-95% consistency
      // Try morning hours 7-12 until we find one not during sleep
      let placed = false;
      for (let hr = 7; hr <= 12; hr++) {
        const time = new Date(mapping.targetDate);
        time.setHours(hr, randomInt(0, 59), randomInt(0, 59), 0);
        if (mapping.maxTime && time > mapping.maxTime) break;
        if (isDuringSleep(time, sleepIntervals)) continue;
        logs.push({
          id: randomUUID(),
          time: time,
          doseAmount: vitD.dose,
          unitAbbr: vitD.unitAbbr,
          notes: null,
          medicineId: vitD.id,
          babyId: baby.id,
          caretakerId: caretaker.id,
          familyId: family.id
        });
        placed = true;
        break;
      }
    }

    // --- Tylenol: 1-2 episodes of 2-3 days, 2-3 doses/day ---
    const tylenol = medicineRecords.find(m => m.name === 'Infant Tylenol');
    const tylenolEpisodes = randomInt(1, 2);
    const usedTylenolDays = new Set();
    for (let ep = 0; ep < tylenolEpisodes; ep++) {
      const startIdx = randomInt(0, Math.max(0, dateMapping.length - 10));
      const episodeDays = randomInt(2, 3);
      for (let d = 0; d < episodeDays; d++) {
        const idx = startIdx + ep * 15 + d; // space episodes apart
        if (idx >= dateMapping.length || usedTylenolDays.has(idx)) continue;
        usedTylenolDays.add(idx);
        const dosesPerDay = randomInt(2, 3);
        const baseHours = [8, 14, 20].slice(0, dosesPerDay);
        for (const baseHr of baseHours) {
          // Try baseHr and the next 2 hours to avoid sleep
          let placed = false;
          for (let hr = baseHr; hr <= baseHr + 2; hr++) {
            const time = new Date(dateMapping[idx].targetDate);
            time.setHours(hr, randomInt(0, 45), randomInt(0, 59), 0);
            if (dateMapping[idx].maxTime && time > dateMapping[idx].maxTime) break;
            if (isDuringSleep(time, sleepIntervals)) continue;
            logs.push({
              id: randomUUID(),
              time: time,
              doseAmount: Math.round((tylenol.dose + (Math.random() - 0.5) * 0.5) * 10) / 10,
              unitAbbr: tylenol.unitAbbr,
              notes: d === 0 && baseHr === baseHours[0] ? randomChoice(['Fever detected', 'Teething pain', 'Fussy and warm']) : null,
              medicineId: tylenol.id,
              babyId: baby.id,
              caretakerId: caretaker.id,
              familyId: family.id
            });
            placed = true;
            break;
          }
        }
      }
    }

    // --- Motrin: 1 episode of 2 days, 2 doses/day ---
    const motrin = medicineRecords.find(m => m.name === 'Infant Motrin');
    const motrinStart = randomInt(Math.floor(dateMapping.length / 3), Math.floor(dateMapping.length * 2 / 3));
    for (let d = 0; d < 2; d++) {
      const idx = motrinStart + d;
      if (idx >= dateMapping.length) continue;
      const baseHours = [9, 17]; // 2 doses, 8hrs apart
      for (const baseHr of baseHours) {
        // Try baseHr and the next 2 hours to avoid sleep
        for (let hr = baseHr; hr <= baseHr + 2; hr++) {
          const time = new Date(dateMapping[idx].targetDate);
          time.setHours(hr, randomInt(0, 45), randomInt(0, 59), 0);
          if (dateMapping[idx].maxTime && time > dateMapping[idx].maxTime) break;
          if (isDuringSleep(time, sleepIntervals)) continue;
          logs.push({
            id: randomUUID(),
            time: time,
            doseAmount: motrin.dose,
            unitAbbr: motrin.unitAbbr,
            notes: d === 0 && baseHr === baseHours[0] ? 'Post-vaccination discomfort' : null,
            medicineId: motrin.id,
            babyId: baby.id,
            caretakerId: caretaker.id,
            familyId: family.id
          });
          break;
        }
      }
    }
  }

  if (logs.length > 0) {
    await prisma.medicineLog.createMany({ data: logs });
  }

  const vitDCount = logs.filter(l => l.medicineId === medicineRecords.find(m => m.name === 'Vitamin D Drops')?.id).length;
  const tylenolCount = logs.filter(l => l.medicineId === medicineRecords.find(m => m.name === 'Infant Tylenol')?.id).length;
  const motrinCount = logs.filter(l => l.medicineId === medicineRecords.find(m => m.name === 'Infant Motrin')?.id).length;
  console.log(`Generated ${logs.length} demo medicine logs (${vitDCount} Vitamin D, ${tylenolCount} Tylenol, ${motrinCount} Motrin)`);
  return logs.length;
}

// Create demo tracker record
async function createDemoTracker(family, sourceDates, dateMapping) {
  const earliestSourceDate = sourceDates[0];
  const latestSourceDate = sourceDates[sourceDates.length - 1];
  const earliestTargetDate = dateMapping[0].targetDate;
  const latestTargetDate = dateMapping[dateMapping.length - 1].targetDate;
  
  const tracker = await prisma.demoTracker.create({
    data: {
      familyId: family.id,
      sourceFamilyId: SOURCE_FAMILY_ID,
      dateRangeStart: earliestSourceDate,
      dateRangeEnd: latestSourceDate,
      notes: `Demo generated from family ${SOURCE_FAMILY_ID} using 60 random days from ${earliestSourceDate.toLocaleDateString()} to ${latestSourceDate.toLocaleDateString()}, mapped to ${earliestTargetDate.toLocaleDateString()} to ${latestTargetDate.toLocaleDateString()}`
    }
  });
  
  console.log(`Created demo tracker record: ${tracker.id}`);
  return tracker;
}

// Main demo generation function
async function generateDemoData() {
  try {
    console.log('Starting demo family data generation...');
    
    // Check if demo family already exists and delete it
    const existingDemo = await findExistingDemoFamily();
    if (existingDemo) {
      await deleteExistingDemoFamily(existingDemo);
    }
    
    // Generate 60 random dates between March-June 2025
    const sourceDates = generateRandomDates();
    console.log(`Using 60 random dates from ${sourceDates[0].toLocaleDateString()} to ${sourceDates[sourceDates.length - 1].toLocaleDateString()}`);

    // Create mapping from source dates to target dates (last 60 days)
    const dateMapping = generateDateMapping(sourceDates);
    console.log(`Mapping to target period: ${dateMapping[0].targetDate.toLocaleDateString()} to ${dateMapping[dateMapping.length - 1].targetDate.toLocaleDateString()}`);
    console.log(`Today's entries will be cutoff at: ${dateMapping[dateMapping.length - 1].maxTime?.toLocaleString() || 'no limit'}`);
    
    // Get source family data for the random dates
    const sourceData = await getSourceFamilyData(sourceDates);
    
    // Create demo family structure
    const demoFamily = await createDemoFamily();
    const demoCaretaker = await createDemoCaretaker(demoFamily);
    const demoBabyMappings = await createDemoBabies(demoFamily, sourceData.babies);
    
    // Create sleep logs first — other generators use sleep intervals to avoid overlap
    const { sleepCount, sleepIntervals } = await createDemoSleepLogs(demoFamily, demoCaretaker, demoBabyMappings, sourceData.sleepLogs, dateMapping);
    const { feedCount, breastFeedTimes, feedIntervals } = await createDemoFeedLogs(demoFamily, demoCaretaker, demoBabyMappings, sourceData.feedLogs, dateMapping, sleepIntervals);
    const diaperCount = await createDemoDiaperLogs(demoFamily, demoCaretaker, demoBabyMappings, sourceData.diaperLogs, dateMapping);

    // Generate bath, notes, pump logs, and growth measurements
    const { bathCount, bathIntervals } = await generateDemoBathLogs(demoFamily, demoCaretaker, demoBabyMappings, dateMapping);
    const noteCount = await generateDemoNotes(demoFamily, demoCaretaker, demoBabyMappings, dateMapping);
    const { pumpCount, pumpIntervals } = await generateDemoPumpLogs(demoFamily, demoCaretaker, demoBabyMappings, dateMapping, breastFeedTimes, sleepIntervals);
    const measurementCount = await generateDemoMeasurements(demoFamily, demoCaretaker, demoBabyMappings);

    // Generate play/activity logs — collect all busy intervals so activities don't overlap
    const busyIntervals = [...feedIntervals, ...pumpIntervals, ...bathIntervals];
    const playCount = await generateDemoPlayLogs(demoFamily, demoCaretaker, demoBabyMappings, dateMapping, busyIntervals, sleepIntervals);

    // Generate medicines, supplements, and medicine logs
    const medicineCount = await generateDemoMedicines(demoFamily, demoCaretaker, demoBabyMappings, dateMapping, sleepIntervals);

    // Create demo tracker record
    await createDemoTracker(demoFamily, sourceDates, dateMapping);

    console.log('\n========================================');
    console.log('   Demo family generation completed!');
    console.log('========================================');
    console.log(`Family: ${demoFamily.name}`);
    console.log(`Slug: ${demoFamily.slug}`);
    console.log(`Caretaker: Login ID "${DEMO_CARETAKER_LOGIN_ID}", PIN "${DEMO_CARETAKER_PIN}"`);
    console.log(`Babies: ${demoBabyMappings.length}`);
    console.log(`Source dates: 60 random days from March-June 2025`);
    console.log(`Target period: Last 60 days (${dateMapping[0].targetDate.toLocaleDateString()} to ${dateMapping[dateMapping.length - 1].targetDate.toLocaleDateString()})`);
    console.log(`Today's cutoff: ${dateMapping[dateMapping.length - 1].maxTime?.toLocaleTimeString() || 'none'} (1 hour ago)`);
    console.log('\nGenerated logs:');
    console.log(`- Sleep logs: ${sleepCount}`);
    console.log(`- Breast feed logs: ${feedCount}`);
    console.log(`- Diaper logs: ${diaperCount}`);
    console.log(`- Bath logs: ${bathCount}`);
    console.log(`- Notes: ${noteCount}`);
    console.log(`- Pump logs: ${pumpCount}`);
    console.log(`- Measurements: ${measurementCount}`);
    console.log(`- Play/activity logs: ${playCount}`);
    console.log(`- Medicine logs: ${medicineCount}`);
    console.log(`Total log entries: ${sleepCount + feedCount + diaperCount + bathCount + noteCount + pumpCount + measurementCount + playCount + medicineCount}`);
    console.log('\nAccess URL: /demo');
    
  } catch (error) {
    console.error('Error generating demo family data:', error);
    throw error;
  }
}

// Run the demo generation
generateDemoData()
  .catch(e => {
    console.error('Demo family generation failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
