/**
 * Demo family data generation script for Sprout Track
 * Creates a single demo family based on existing family data
 * Run with: node scripts/generate-demo-data.js
 */

const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

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

// Utility functions
function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate 30 random days between March-June 2025
function generateRandomDates() {
  // March 1, 2025 to June 30, 2025
  const startOfPeriod = new Date('2025-03-01T00:00:00Z');
  const endOfPeriod = new Date('2025-06-30T23:59:59Z');
  
  const totalDaysAvailable = Math.floor((endOfPeriod - startOfPeriod) / (1000 * 60 * 60 * 24));
  const randomDates = [];
  
  // Generate 30 unique random dates
  const usedDays = new Set();
  while (randomDates.length < 30) {
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

// Generate mapping from source dates to target dates (last 30 days)
function generateDateMapping(sourceDates) {
  const now = new Date();
  const cutoffTime = new Date(now.getTime() - (60 * 60 * 1000)); // 1 hour ago
  const mapping = [];
  
  for (let i = 0; i < sourceDates.length; i++) {
    const daysAgo = 29 - i; // Start with 29 days ago, end with today
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
  
  console.log(`Created ${demoLogs.length} demo sleep logs`);
  return demoLogs.length;
}

// Transform and create feed logs
async function createDemoFeedLogs(family, caretaker, babyMappings, sourceFeedLogs, dateMapping) {
  const demoLogs = [];
  
  for (const sourceLog of sourceFeedLogs) {
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
    const startTime = sourceLog.startTime ? new Date(sourceLog.startTime.getTime() + dateOffset) : null;
    const endTime = sourceLog.endTime ? new Date(sourceLog.endTime.getTime() + dateOffset) : null;
    
    // Check if this falls within the allowed time range (respect maxTime for today)
    if (mapping.maxTime && time > mapping.maxTime) {
      continue; // Skip entries that are too recent for today
    }
    
    demoLogs.push({
      id: randomUUID(),
      time: time,
      startTime: startTime,
      endTime: endTime,
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
  
  if (demoLogs.length > 0) {
    await prisma.feedLog.createMany({ data: demoLogs });
  }
  
  console.log(`Created ${demoLogs.length} demo feed logs`);
  return demoLogs.length;
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
  
  console.log(`Generated ${logs.length} demo bath logs`);
  return logs.length;
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
      notes: `Demo generated from family ${SOURCE_FAMILY_ID} using 30 random days from ${earliestSourceDate.toLocaleDateString()} to ${latestSourceDate.toLocaleDateString()}, mapped to ${earliestTargetDate.toLocaleDateString()} to ${latestTargetDate.toLocaleDateString()}`
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
    
    // Generate 30 random dates between March-June 2025
    const sourceDates = generateRandomDates();
    console.log(`Using 30 random dates from ${sourceDates[0].toLocaleDateString()} to ${sourceDates[sourceDates.length - 1].toLocaleDateString()}`);
    
    // Create mapping from source dates to target dates (last 30 days)
    const dateMapping = generateDateMapping(sourceDates);
    console.log(`Mapping to target period: ${dateMapping[0].targetDate.toLocaleDateString()} to ${dateMapping[dateMapping.length - 1].targetDate.toLocaleDateString()}`);
    console.log(`Today's entries will be cutoff at: ${dateMapping[dateMapping.length - 1].maxTime?.toLocaleString() || 'no limit'}`);
    
    // Get source family data for the random dates
    const sourceData = await getSourceFamilyData(sourceDates);
    
    // Create demo family structure
    const demoFamily = await createDemoFamily();
    const demoCaretaker = await createDemoCaretaker(demoFamily);
    const demoBabyMappings = await createDemoBabies(demoFamily, sourceData.babies);
    
    // Transform and create log data using date mapping
    const sleepCount = await createDemoSleepLogs(demoFamily, demoCaretaker, demoBabyMappings, sourceData.sleepLogs, dateMapping);
    const feedCount = await createDemoFeedLogs(demoFamily, demoCaretaker, demoBabyMappings, sourceData.feedLogs, dateMapping);
    const diaperCount = await createDemoDiaperLogs(demoFamily, demoCaretaker, demoBabyMappings, sourceData.diaperLogs, dateMapping);
    
    // Generate random bath logs and notes using date mapping
    const bathCount = await generateDemoBathLogs(demoFamily, demoCaretaker, demoBabyMappings, dateMapping);
    const noteCount = await generateDemoNotes(demoFamily, demoCaretaker, demoBabyMappings, dateMapping);
    
    // Create demo tracker record
    await createDemoTracker(demoFamily, sourceDates, dateMapping);
    
    console.log('\n========================================');
    console.log('   Demo family generation completed!');
    console.log('========================================');
    console.log(`Family: ${demoFamily.name}`);
    console.log(`Slug: ${demoFamily.slug}`);
    console.log(`Caretaker: Login ID "${DEMO_CARETAKER_LOGIN_ID}", PIN "${DEMO_CARETAKER_PIN}"`);
    console.log(`Babies: ${demoBabyMappings.length}`);
    console.log(`Source dates: 30 random days from March-June 2025`);
    console.log(`Target period: Last 30 days (${dateMapping[0].targetDate.toLocaleDateString()} to ${dateMapping[dateMapping.length - 1].targetDate.toLocaleDateString()})`);
    console.log(`Today's cutoff: ${dateMapping[dateMapping.length - 1].maxTime?.toLocaleTimeString() || 'none'} (1 hour ago)`);
    console.log('\nGenerated logs:');
    console.log(`- Sleep logs: ${sleepCount}`);
    console.log(`- Feed logs: ${feedCount}`);
    console.log(`- Diaper logs: ${diaperCount}`);
    console.log(`- Bath logs: ${bathCount}`);
    console.log(`- Notes: ${noteCount}`);
    console.log(`Total log entries: ${sleepCount + feedCount + diaperCount + bathCount + noteCount}`);
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
