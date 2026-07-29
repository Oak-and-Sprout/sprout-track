/**
 * Test data generation script for Sprout Track
 * Generates realistic families, caretakers, babies, and log entries
 * Run with: node scripts/generate-test-data.js
 */

const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();

// Get parameters from environment variables set by bash script
const familyCount = parseInt(process.env.FAMILY_COUNT) || 1;
const daysCount = parseInt(process.env.DAYS_COUNT) || 7;
const clearData = process.env.CLEAR_DATA === 'true';

// Random name arrays
const maleFirstNames = [
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles',
  'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua',
  'Kenneth', 'Kevin', 'Brian', 'George', 'Timothy', 'Ronald', 'Jason', 'Edward', 'Jeffrey', 'Ryan',
  'Jacob', 'Gary', 'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon',
  'Benjamin', 'Samuel', 'Gregory', 'Alexander', 'Patrick', 'Frank', 'Raymond', 'Jack', 'Dennis', 'Jerry',
  'Tyler', 'Aaron', 'Jose', 'Henry', 'Adam', 'Douglas', 'Nathan', 'Peter', 'Zachary', 'Kyle',
  'Noah', 'Alan', 'Ethan', 'Jeremy', 'Lionel', 'Angel', 'Jordan', 'Wayne', 'Arthur', 'Sean',
  'Felix', 'Carl', 'Harold', 'Jose', 'Ralph', 'Mason', 'Roy', 'Eugene', 'Louis', 'Philip'
];

const femaleFirstNames = [
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen',
  'Nancy', 'Lisa', 'Betty', 'Helen', 'Sandra', 'Donna', 'Carol', 'Ruth', 'Sharon', 'Michelle',
  'Laura', 'Sarah', 'Kimberly', 'Deborah', 'Dorothy', 'Amy', 'Angela', 'Ashley', 'Brenda', 'Emma',
  'Olivia', 'Cynthia', 'Marie', 'Janet', 'Catherine', 'Frances', 'Christine', 'Samantha', 'Debra', 'Rachel',
  'Carolyn', 'Janet', 'Maria', 'Heather', 'Diane', 'Julie', 'Joyce', 'Virginia', 'Victoria', 'Kelly',
  'Christina', 'Joan', 'Evelyn', 'Lauren', 'Judith', 'Megan', 'Cheryl', 'Andrea', 'Hannah', 'Jacqueline',
  'Martha', 'Gloria', 'Teresa', 'Sara', 'Janice', 'Marie', 'Julia', 'Heather', 'Diane', 'Carolyn',
  'Ruth', 'Sharon', 'Michelle', 'Laura', 'Sarah', 'Kimberly', 'Deborah', 'Dorothy', 'Lisa', 'Nancy'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
  'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper',
  'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson'
];

const caretakerTypes = [
  'Parent', 'Mother', 'Father', 'Grandmother', 'Grandfather', 'Nanny', 'Babysitter', 
  'Daycare Provider', 'Aunt', 'Uncle', 'Family Friend', 'Caregiver'
];

// Note content examples
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
  "Trying to establish better feeding schedule",
  "Baby's first laugh was so precious",
  "Noticed baby tracking objects with eyes",
  "Temperature was a bit high, monitoring closely",
  "Great nap schedule today",
  "Baby's grip is getting stronger"
];

// Milestone examples
const milestoneTemplates = {
  MOTOR: [
    "First time holding head up",
    "Rolling over from tummy to back",
    "Rolling over from back to tummy",
    "Sitting without support",
    "First crawling movements",
    "Pulling up to standing",
    "First steps with support",
    "Walking independently",
    "Climbing stairs",
    "Running"
  ],
  COGNITIVE: [
    "First social smile",
    "Recognizing familiar faces",
    "Following objects with eyes",
    "Reaching for toys",
    "Understanding cause and effect",
    "Object permanence awareness",
    "Problem solving skills",
    "Imitating actions",
    "Understanding simple commands",
    "Showing preferences"
  ],
  SOCIAL: [
    "First laugh",
    "Enjoying peek-a-boo",
    "Responding to name",
    "Stranger anxiety begins",
    "Waving bye-bye",
    "Playing pat-a-cake",
    "Showing affection",
    "Parallel play with others",
    "Sharing toys",
    "Showing empathy"
  ],
  LANGUAGE: [
    "First coo sounds",
    "Babbling begins",
    "Responding to voices",
    "Making different sounds",
    "First word attempt",
    "Saying 'mama' or 'dada'",
    "Understanding 'no'",
    "Following simple commands",
    "Saying first clear word",
    "Two-word combinations"
  ]
};

// Adjectives and animals for slug generation (copied from family-migration.js)
const adjectives = [
  'adorable', 'fluffy', 'cuddly', 'tiny', 'fuzzy', 'sweet', 'playful', 'gentle', 'happy',
  'bouncy', 'sleepy', 'snuggly', 'cheerful', 'bubbly', 'cozy', 'merry', 'giggly', 'jolly',
  'silly', 'wiggly', 'charming', 'dainty', 'darling', 'precious', 'lovable', 'huggable',
  'perky', 'sprightly', 'twinkly', 'whimsical', 'delightful', 'friendly', 'joyful', 'peppy'
];

const animals = [
  'kitten', 'puppy', 'bunny', 'duckling', 'chick', 'calf', 'lamb', 'piglet', 'fawn',
  'cub', 'foal', 'joey', 'owlet', 'panda', 'koala', 'hamster', 'hedgehog', 'otter',
  'chinchilla', 'squirrel', 'chipmunk', 'mouse', 'gerbil', 'ferret', 'meerkat', 'sloth',
  'penguin', 'seal', 'walrus', 'alpaca', 'llama', 'capybara', 'quokka', 'wombat'
];

// Utility functions
function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

// Check if two dates are on the same day
function isSameDay(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

// Generate the cutoff time (between 15 minutes and 3 hours ago)
function generateCutoffTime() {
  const now = new Date();
  const minMinutesAgo = 15;
  const maxMinutesAgo = 3 * 60; // 3 hours
  const minutesAgo = randomInt(minMinutesAgo, maxMinutesAgo);
  return new Date(now.getTime() - (minutesAgo * 60 * 1000));
}

// Generate unique slug
async function generateUniqueSlug() {
  let attempts = 0;
  while (attempts < 20) {
    const adjective = randomChoice(adjectives);
    const animal = randomChoice(animals);
    const slug = `${adjective}-${animal}`;
    
    const existing = await prisma.family.findFirst({ where: { slug } });
    if (!existing) {
      return slug;
    }
    attempts++;
  }
  
  // Fallback with random number
  const adjective = randomChoice(adjectives);
  const animal = randomChoice(animals);
  const randomNum = randomInt(1000, 9999);
  return `${adjective}-${animal}-${randomNum}`;
}

// Generate realistic birth date (0-24 months ago)
function generateBabyBirthDate() {
  const now = new Date();
  const maxAgeMonths = 24;
  const ageMonths = randomFloat(0, maxAgeMonths);
  const birthDate = new Date(now.getTime() - (ageMonths * 30 * 24 * 60 * 60 * 1000));
  return birthDate;
}

// Generate realistic timestamp within a day, ensuring it doesn't exceed maxTime
function generateTimeInDay(baseDate, hour, minuteVariation = 30, maxTime = null) {
  const date = new Date(baseDate);
  date.setHours(hour);
  date.setMinutes(randomInt(-minuteVariation, minuteVariation));
  date.setSeconds(randomInt(0, 59));
  
  // If maxTime is provided and the generated time exceeds it, cap it at maxTime
  if (maxTime && date > maxTime) {
    return maxTime;
  }
  
  return date;
}

// Clear existing data
async function clearExistingData() {
  console.log('Clearing existing data...');
  
  // Delete in order to respect foreign key constraints
  const models = [
    'familyMember', 'sleepLog', 'feedLog', 'diaperLog', 'moodLog', 'note', 
    'milestone', 'pumpLog', 'playLog', 'bathLog', 'measurement', 'medicineLog',
    'medicine', 'calendarEvent', 'contact', 'baby', 'caretaker', 'settings', 'family', 'appConfig'
  ];
  
  for (const model of models) {
    try {
      await prisma[model].deleteMany({});
      console.log(`Cleared ${model} records`);
    } catch (error) {
      console.log(`Note: Could not clear ${model} (may not exist): ${error.message}`);
    }
  }
}

// Generate app configuration
async function generateAppConfig() {
  console.log('Generating app configuration...');
  
  const appConfig = await prisma.appConfig.create({
    data: {
      id: randomUUID(),
      adminPass: 'admin', // Plain text - will be encrypted by the API when used
      rootDomain: 'demo.sprout-track.com',
      enableHttps: true
    }
  });
  
  console.log(`Created app config with domain: ${appConfig.rootDomain}`);
  return appConfig;
}

// Generate essential units data (copied from seed.ts)
async function generateUnits() {
  console.log('Ensuring essential units exist...');
  
  const unitData = [
    { unitAbbr: 'OZ', unitName: 'Ounces', activityTypes: 'weight,feed,medicine' },
    { unitAbbr: 'ML', unitName: 'Milliliters', activityTypes: 'medicine,feed' },
    { unitAbbr: 'TBSP', unitName: 'Tablespoon', activityTypes: 'medicine,feed' },
    { unitAbbr: 'LB', unitName: 'Pounds', activityTypes: 'weight' },
    { unitAbbr: 'IN', unitName: 'Inches', activityTypes: 'height' },
    { unitAbbr: 'CM', unitName: 'Centimeters', activityTypes: 'height' },
    { unitAbbr: 'G', unitName: 'Grams', activityTypes: 'weight,feed,medicine' },
    { unitAbbr: 'KG', unitName: 'Kilograms', activityTypes: 'weight' },
    { unitAbbr: 'F', unitName: 'Fahrenheit', activityTypes: 'temp' },
    { unitAbbr: 'C', unitName: 'Celsius', activityTypes: 'temp' },
    { unitAbbr: 'MG', unitName: 'Milligrams', activityTypes: 'medicine' },
    { unitAbbr: 'MCG', unitName: 'Micrograms', activityTypes: 'medicine' },
    { unitAbbr: 'L', unitName: 'Liters', activityTypes: 'medicine' },
    { unitAbbr: 'CC', unitName: 'Cubic Centimeters', activityTypes: 'medicine' },
    { unitAbbr: 'MOL', unitName: 'Moles', activityTypes: 'medicine' },
    { unitAbbr: 'MMOL', unitName: 'Millimoles', activityTypes: 'medicine' }
  ];

  // Get existing units from the database
  const existingUnits = await prisma.unit.findMany({
    select: { id: true, unitAbbr: true, activityTypes: true }
  });
  
  // Create a map of existing unit abbreviations for faster lookups
  const existingUnitsMap = new Map(
    existingUnits.map(unit => [unit.unitAbbr, { id: unit.id, activityTypes: unit.activityTypes }])
  );
  
  // Filter out units that already exist
  const missingUnits = unitData.filter(unit => !existingUnitsMap.has(unit.unitAbbr));
  
  // Create the missing units
  if (missingUnits.length > 0) {
    console.log(`Creating ${missingUnits.length} missing units: ${missingUnits.map(u => u.unitAbbr).join(', ')}`);
    
    for (const unit of missingUnits) {
      await prisma.unit.create({
        data: {
          id: randomUUID(),
          ...unit
        }
      });
    }
  } else {
    console.log('All essential units already exist in the database.');
  }
  
  // Update activity types for existing units if needed
  const unitsToUpdate = [];
  for (const unit of unitData) {
    const existingUnit = existingUnitsMap.get(unit.unitAbbr);
    if (existingUnit && existingUnit.activityTypes !== unit.activityTypes) {
      unitsToUpdate.push({
        id: existingUnit.id,
        unitAbbr: unit.unitAbbr,
        activityTypes: unit.activityTypes
      });
    }
  }
  
  if (unitsToUpdate.length > 0) {
    console.log(`Updating activity types for ${unitsToUpdate.length} units: ${unitsToUpdate.map(u => u.unitAbbr).join(', ')}`);
    
    for (const unit of unitsToUpdate) {
      await prisma.unit.update({
        where: { id: unit.id },
        data: { activityTypes: unit.activityTypes }
      });
    }
  }
  
  console.log('Units generation completed successfully.');
}

// Generate a family
async function generateFamily() {
  const lastName = randomChoice(lastNames);
  const slug = await generateUniqueSlug();
  
  const family = await prisma.family.create({
    data: {
      id: randomUUID(),
      slug: slug,
      name: `${lastName} Family`,
      isActive: true
    }
  });
  
  // Create family settings
  await prisma.settings.create({
    data: {
      id: randomUUID(),
      familyId: family.id,
      familyName: family.name,
      securityPin: '111222',
      defaultBottleUnit: 'OZ',
      defaultSolidsUnit: 'TBSP',
      defaultHeightUnit: 'IN',
      defaultWeightUnit: 'LB',
      defaultTempUnit: 'F'
    }
  });
  
  return family;
}

// Generate caretakers for a family
async function generateCaretakers(family) {
  const caretakers = [];
  
  // ALWAYS create the system user "00" first - this is required for the application to work
  console.log(`    Creating system user "00"...`);
  const systemCaretaker = await prisma.caretaker.create({
    data: {
      id: randomUUID(),
      loginId: '00',
      name: 'system',
      type: 'System Administrator',
      role: 'ADMIN',
      inactive: false,
      securityPin: '111222',
      familyId: family.id
    }
  });
  
  // Create family member relationship for system user
  await prisma.familyMember.create({
    data: {
      familyId: family.id,
      caretakerId: systemCaretaker.id,
      role: 'admin'
    }
  });
  
  caretakers.push(systemCaretaker);
  
  // Now create regular caretakers (2-4 additional caretakers)
  const regularCaretakerCount = randomInt(2, 4);
  
  for (let i = 0; i < regularCaretakerCount; i++) {
    const isFirstRegularCaretaker = i === 0;
    const gender = Math.random() > 0.5 ? 'male' : 'female';
    const firstName = gender === 'male' ? randomChoice(maleFirstNames) : randomChoice(femaleFirstNames);
    
    const caretaker = await prisma.caretaker.create({
      data: {
        id: randomUUID(),
        loginId: (i + 1).toString().padStart(2, '0'), // Start from "01" for regular users
        name: firstName,
        type: isFirstRegularCaretaker ? 'Parent' : randomChoice(caretakerTypes),
        role: isFirstRegularCaretaker ? 'ADMIN' : 'USER',
        inactive: false,
        securityPin: '111222',
        familyId: family.id
      }
    });
    
    // Create family member relationship
    await prisma.familyMember.create({
      data: {
        familyId: family.id,
        caretakerId: caretaker.id,
        role: isFirstRegularCaretaker ? 'admin' : 'member'
      }
    });
    
    caretakers.push(caretaker);
  }
  
  return caretakers;
}

// Generate babies for a family
async function generateBabies(family, caretakers) {
  const babyCount = randomInt(1, 2);
  const babies = [];
  
  for (let i = 0; i < babyCount; i++) {
    const gender = Math.random() > 0.5 ? 'MALE' : 'FEMALE';
    const firstName = gender === 'MALE' ? randomChoice(maleFirstNames) : randomChoice(femaleFirstNames);
    const birthDate = generateBabyBirthDate();
    
    const baby = await prisma.baby.create({
      data: {
        id: randomUUID(),
        firstName: firstName,
        lastName: family.name.replace(' Family', ''),
        birthDate: birthDate,
        gender: gender,
        inactive: false,
        familyId: family.id,
        feedWarningTime: '03:00',
        diaperWarningTime: '02:00'
      }
    });
    
    babies.push(baby);
  }
  
  return babies;
}

// Generate sleep logs for a baby
async function generateSleepLogs(baby, caretakers, family, startDate, endDate, cutoffTime) {
  const logs = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const caretaker = randomChoice(caretakers);
    const isToday = isSameDay(currentDate, new Date());
    
    // Night sleep (9 PM - 7 AM)
    const nightStart = generateTimeInDay(currentDate, 21, 30, isToday ? cutoffTime : null); // 9 PM
    
    // Only create night sleep if start time is not in the future
    if (nightStart <= cutoffTime) {
      const nextDay = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      const isTomorrowToday = isSameDay(nextDay, new Date());
      let nightEnd = generateTimeInDay(nextDay, 7, 30, isTomorrowToday ? cutoffTime : null); // 7 AM next day
      
      // Ensure night end is not in the future
      if (nightEnd > cutoffTime) {
        nightEnd = cutoffTime;
      }
      
      const nightDuration = Math.floor((nightEnd - nightStart) / (1000 * 60)); // minutes
      
      // Only create the log if it has a positive duration
      if (nightDuration > 0) {
        logs.push({
          id: randomUUID(),
          startTime: nightStart,
          endTime: nightEnd,
          duration: nightDuration,
          type: 'NIGHT_SLEEP',
          location: 'Crib',
          quality: randomChoice(['GOOD', 'EXCELLENT', 'FAIR']),
          notes: Math.random() < 0.15 ? randomChoice(['Slept peacefully', 'Woke up once', 'Restless night']) : null,
          babyId: baby.id,
          caretakerId: caretaker.id,
          familyId: family.id
        });
      }
    }
    
    // Morning nap (10 AM - 12 PM)
    if (Math.random() > 0.3) { // 70% chance
      const napStart = generateTimeInDay(currentDate, 10, 30, isToday ? cutoffTime : null);
      
      // Only create nap if start time is not in the future
      if (napStart <= cutoffTime) {
        const napDuration = randomInt(60, 120); // 1-2 hours
        let napEnd = new Date(napStart.getTime() + napDuration * 60 * 1000);
        
        // Ensure nap end is not in the future
        if (napEnd > cutoffTime) {
          napEnd = cutoffTime;
        }
        
        const actualDuration = Math.floor((napEnd - napStart) / (1000 * 60));
        
        // Only create the log if it has a positive duration
        if (actualDuration > 0) {
          logs.push({
            id: randomUUID(),
            startTime: napStart,
            endTime: napEnd,
            duration: actualDuration,
            type: 'NAP',
            location: 'Crib',
            quality: randomChoice(['GOOD', 'FAIR', 'EXCELLENT']),
            notes: Math.random() < 0.15 ? randomChoice(['Slept peacefully', 'Woke up once', 'Restless night']) : null,
            babyId: baby.id,
            caretakerId: caretaker.id,
            familyId: family.id
          });
        }
      }
    }
    
    // Afternoon nap (2 PM - 4 PM)
    if (Math.random() > 0.2) { // 80% chance
      const napStart = generateTimeInDay(currentDate, 14, 30, isToday ? cutoffTime : null);
      
      // Only create nap if start time is not in the future
      if (napStart <= cutoffTime) {
        const napDuration = randomInt(90, 180); // 1.5-3 hours
        let napEnd = new Date(napStart.getTime() + napDuration * 60 * 1000);
        
        // Ensure nap end is not in the future
        if (napEnd > cutoffTime) {
          napEnd = cutoffTime;
        }
        
        const actualDuration = Math.floor((napEnd - napStart) / (1000 * 60));
        
        // Only create the log if it has a positive duration
        if (actualDuration > 0) {
          logs.push({
            id: randomUUID(),
            startTime: napStart,
            endTime: napEnd,
            duration: actualDuration,
            type: 'NAP',
            location: 'Crib',
            quality: randomChoice(['GOOD', 'FAIR', 'EXCELLENT']),
            notes: Math.random() < 0.15 ? randomChoice(['Slept peacefully', 'Woke up once', 'Restless night']) : null,
            babyId: baby.id,
            caretakerId: caretaker.id,
            familyId: family.id
          });
        }
      }
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return logs;
}

// Generate feed logs for a baby
async function generateFeedLogs(baby, caretakers, family, startDate, endDate, cutoffTime) {
  const logs = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const caretaker = randomChoice(caretakers);
    const isToday = isSameDay(currentDate, new Date());
    
    // 6-8 bottle feeds per day, every 2-4 hours
    const feedTimes = [2, 6, 10, 14, 18, 22]; // Base times: 2 AM, 6 AM, 10 AM, 2 PM, 6 PM, 10 PM
    
    for (const baseHour of feedTimes) {
      if (Math.random() > 0.15) { // 85% chance for each feed
        const feedTime = generateTimeInDay(currentDate, baseHour, 45, isToday ? cutoffTime : null);
        
        // Only create feed log if time is not in the future
        if (feedTime <= cutoffTime) {
          const amount = randomFloat(2, 8); // 2-8 ounces
          
          logs.push({
            id: randomUUID(),
            time: feedTime,
            type: 'BOTTLE',
            amount: Math.round(amount * 10) / 10, // Round to 1 decimal
            unitAbbr: 'OZ',
            babyId: baby.id,
            caretakerId: caretaker.id,
            familyId: family.id
          });
        }
      }
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return logs;
}

// Generate diaper logs for a baby
async function generateDiaperLogs(baby, caretakers, family, startDate, endDate, cutoffTime) {
  const logs = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const caretaker = randomChoice(caretakers);
    const isToday = isSameDay(currentDate, new Date());
    
    // 6-10 diaper changes per day
    const diaperCount = randomInt(6, 10);
    
    for (let i = 0; i < diaperCount; i++) {
      const hour = randomInt(0, 23);
      const changeTime = generateTimeInDay(currentDate, hour, 30, isToday ? cutoffTime : null);
      
      // Only create diaper log if time is not in the future
      if (changeTime <= cutoffTime) {
        // Determine diaper type (more wet than dirty; DRY - checked before there's
        // anything in it - is the rarest)
        let type;
        const rand = Math.random();
        if (rand < 0.55) {
          type = 'WET';
        } else if (rand < 0.8) {
          type = 'DIRTY';
        } else if (rand < 0.9) {
          type = 'BOTH';
        } else {
          type = 'DRY';
        }
        
        logs.push({
          id: randomUUID(),
          time: changeTime,
          type: type,
          condition: type === 'DIRTY' || type === 'BOTH' ? randomChoice(['Normal', 'Soft', 'Hard']) : null,
          color: type === 'DIRTY' || type === 'BOTH' ? randomChoice(['Yellow', 'Brown', 'Green']) : null,
          notes: Math.random() < 0.1 ? randomChoice(['Slight rash', 'Leaked a little', 'Last diaper in the pack']) : null,
          babyId: baby.id,
          caretakerId: caretaker.id,
          familyId: family.id
        });
      }
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return logs;
}

// Generate bath logs for a baby (daily)
async function generateBathLogs(baby, caretakers, family, startDate, endDate, cutoffTime) {
  const logs = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const caretaker = randomChoice(caretakers);
    const isToday = isSameDay(currentDate, new Date());
    
    // 80% chance of bath per day, usually in the evening
    if (Math.random() > 0.2) {
      const bathTime = generateTimeInDay(currentDate, 19, 60, isToday ? cutoffTime : null); // 7 PM +/- 1 hour
      
      // Only create bath log if time is not in the future
      if (bathTime <= cutoffTime) {
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
          babyId: baby.id,
          caretakerId: caretaker.id,
          familyId: family.id
        });
      }
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return logs;
}

// Generate notes for a baby (1 every day or two)
async function generateNotes(baby, caretakers, family, startDate, endDate, cutoffTime) {
  const logs = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const caretaker = randomChoice(caretakers);
    const isToday = isSameDay(currentDate, new Date());
    
    // 60% chance of note per day (roughly 1 every day or two)
    if (Math.random() > 0.4) {
      const noteTime = generateTimeInDay(currentDate, randomInt(8, 20), 30, isToday ? cutoffTime : null);
      
      // Only create note if time is not in the future
      if (noteTime <= cutoffTime) {
        logs.push({
          id: randomUUID(),
          time: noteTime,
          content: randomChoice(noteTemplates),
          category: randomChoice(['General', 'Feeding', 'Sleep', 'Development', 'Health']),
          babyId: baby.id,
          caretakerId: caretaker.id,
          familyId: family.id
        });
      }
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return logs;
}

// Generate milestones for a baby
async function generateMilestones(baby, caretakers, family, startDate, endDate, cutoffTime) {
  const logs = [];
  const birthDate = new Date(baby.birthDate);
  const currentDate = new Date(startDate);
  
  // Generate milestones based on baby's age
  const categories = Object.keys(milestoneTemplates);
  
  while (currentDate <= endDate) {
    const caretaker = randomChoice(caretakers);
    const isToday = isSameDay(currentDate, new Date());
    
    // Low chance of milestone per day (they're special!)
    if (Math.random() > 0.95) { // 5% chance per day
      const milestoneTime = generateTimeInDay(currentDate, randomInt(8, 20), 30, isToday ? cutoffTime : null);
      
      // Only create milestone if time is not in the future
      if (milestoneTime <= cutoffTime) {
        const category = randomChoice(categories);
        const title = randomChoice(milestoneTemplates[category]);
        const ageInDays = Math.floor((milestoneTime - birthDate) / (1000 * 60 * 60 * 24));
        
        logs.push({
          id: randomUUID(),
          date: milestoneTime,
          title: title,
          description: `${baby.firstName} ${title.toLowerCase()} at ${Math.floor(ageInDays / 30)} months and ${ageInDays % 30} days old!`,
          category: category,
          ageInDays: ageInDays,
          babyId: baby.id,
          caretakerId: caretaker.id,
          familyId: family.id
        });
      }
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return logs;
}

// Main data generation function
async function generateTestData() {
  try {
    console.log(`Starting test data generation...`);
    console.log(`Families: ${familyCount}, Days: ${daysCount}, Clear data: ${clearData}`);
    
    if (clearData) {
      await clearExistingData();
    }
    
    // Generate app configuration
    await generateAppConfig();
    
    // Generate essential units
    await generateUnits();
    
    // Generate cutoff time (between 15 minutes and 3 hours ago)
    const cutoffTime = generateCutoffTime();
    const endDate = new Date(cutoffTime);
    const startDate = new Date(endDate.getTime() - (daysCount * 24 * 60 * 60 * 1000));
    
    console.log(`Data will be generated from ${startDate.toLocaleString()} to ${endDate.toLocaleString()}`);
    console.log(`Last entries will be between 15 minutes and 3 hours ago`);
    
    let totalBabies = 0;
    let totalCaretakers = 0;
    let totalSleepLogs = 0;
    let totalFeedLogs = 0;
    let totalDiaperLogs = 0;
    let totalBathLogs = 0;
    let totalNotes = 0;
    let totalMilestones = 0;
    
    for (let i = 0; i < familyCount; i++) {
      console.log(`Generating family ${i + 1}/${familyCount}...`);
      
      // Generate family
      const family = await generateFamily();
      console.log(`  Created family: ${family.name} (${family.slug})`);
      
      // Generate caretakers
      const caretakers = await generateCaretakers(family);
      totalCaretakers += caretakers.length;
      console.log(`  Created ${caretakers.length} caretakers`);
      
      // Generate babies
      const babies = await generateBabies(family, caretakers);
      totalBabies += babies.length;
      console.log(`  Created ${babies.length} babies`);
      
      // Generate logs for each baby
      for (const baby of babies) {
        console.log(`    Generating logs for ${baby.firstName}...`);
        
        // Generate sleep logs
        const sleepLogs = await generateSleepLogs(baby, caretakers, family, startDate, endDate, cutoffTime);
        if (sleepLogs.length > 0) {
          await prisma.sleepLog.createMany({ data: sleepLogs });
          totalSleepLogs += sleepLogs.length;
        }
        
        // Generate feed logs
        const feedLogs = await generateFeedLogs(baby, caretakers, family, startDate, endDate, cutoffTime);
        if (feedLogs.length > 0) {
          await prisma.feedLog.createMany({ data: feedLogs });
          totalFeedLogs += feedLogs.length;
        }
        
        // Generate diaper logs
        const diaperLogs = await generateDiaperLogs(baby, caretakers, family, startDate, endDate, cutoffTime);
        if (diaperLogs.length > 0) {
          await prisma.diaperLog.createMany({ data: diaperLogs });
          totalDiaperLogs += diaperLogs.length;
        }
        
        // Generate bath logs
        const bathLogs = await generateBathLogs(baby, caretakers, family, startDate, endDate, cutoffTime);
        if (bathLogs.length > 0) {
          await prisma.bathLog.createMany({ data: bathLogs });
          totalBathLogs += bathLogs.length;
        }
        
        // Generate notes
        const notes = await generateNotes(baby, caretakers, family, startDate, endDate, cutoffTime);
        if (notes.length > 0) {
          await prisma.note.createMany({ data: notes });
          totalNotes += notes.length;
        }
        
        // Generate milestones
        const milestones = await generateMilestones(baby, caretakers, family, startDate, endDate, cutoffTime);
        if (milestones.length > 0) {
          await prisma.milestone.createMany({ data: milestones });
          totalMilestones += milestones.length;
        }
        
        console.log(`      Sleep: ${sleepLogs.length}, Feed: ${feedLogs.length}, Diaper: ${diaperLogs.length}, Bath: ${bathLogs.length}, Notes: ${notes.length}, Milestones: ${milestones.length}`);
      }
    }
    
    console.log(`\nTest data generation completed successfully!`);
    console.log(`Generated:`);
    console.log(`- 1 app configuration (domain: demo.sprout-track.com, HTTPS: enabled)`);
    console.log(`- Essential units (OZ, ML, TBSP, LB, IN, CM, G, KG, F, C, MG, MCG, L, CC, MOL, MMOL)`);
    console.log(`- ${familyCount} families`);
    console.log(`- ${totalCaretakers} caretakers (including system user "00" for each family)`);
    console.log(`- ${totalBabies} babies`);
    console.log(`- ${totalSleepLogs} sleep logs`);
    console.log(`- ${totalFeedLogs} feed logs`);
    console.log(`- ${totalDiaperLogs} diaper logs`);
    console.log(`- ${totalBathLogs} bath logs`);
    console.log(`- ${totalNotes} notes`);
    console.log(`- ${totalMilestones} milestones`);
    console.log(`Total log entries: ${totalSleepLogs + totalFeedLogs + totalDiaperLogs + totalBathLogs + totalNotes + totalMilestones}`);
    
  } catch (error) {
    console.error('Error generating test data:', error);
    throw error;
  }
}

// Run the data generation
generateTestData()
  .catch(e => {
    console.error('Test data generation failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
