/**
 * Breast feed log generation script for Sprout Track
 * Generates realistic breast feed logs for existing babies
 * Run with: node scripts/generate-breast-feeds.js
 */

const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();

// Get parameters from environment variables set by bash script
const familyCount = parseInt(process.env.FAMILY_COUNT) || 40;
const daysCount = parseInt(process.env.DAYS_COUNT) || 90;
const clearData = process.env.CLEAR_DATA === 'true';

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

// Clear existing breast feed logs
async function clearExistingBreastFeeds() {
  console.log('Clearing existing breast feed logs...');
  try {
    await prisma.feedLog.deleteMany({
      where: { type: 'BREAST' }
    });
    console.log('Cleared breast feed log records');
  } catch (error) {
    console.log(`Note: Could not clear breast feed logs: ${error.message}`);
  }
}

// Generate breast feed logs for a baby
async function generateBreastFeeds(baby, caretakers, family, startDate, endDate, cutoffTime) {
  const logs = [];
  const currentDate = new Date(startDate);
  
  // Breast feed notes templates
  const feedNotes = [
    'Good feeding session',
    'Baby was very hungry',
    'Quick feed',
    'Long feeding session',
    'Baby fell asleep while feeding',
    'Fussy at first but settled down',
    'Very active feeding',
    null, // 50% chance of no notes
    null,
  ];
  
  while (currentDate <= endDate) {
    const caretaker = randomChoice(caretakers);
    const isToday = isSameDay(currentDate, new Date());
    
    // Generate 6-10 breast feeds per day
    const feedCount = randomInt(6, 10);
    
    // Common feed times throughout the day
    const feedTimeSlots = [
      { hour: 2, chance: 0.6 },   // Overnight
      { hour: 6, chance: 0.9 },   // Early morning
      { hour: 9, chance: 0.8 },   // Mid-morning
      { hour: 12, chance: 0.8 },  // Noon
      { hour: 15, chance: 0.7 },  // Afternoon
      { hour: 18, chance: 0.9 },   // Evening
      { hour: 21, chance: 0.8 },   // Late evening
      { hour: 0, chance: 0.4 },    // Midnight
    ];
    
    // Select random time slots for this day
    const selectedSlots = feedTimeSlots
      .filter(slot => Math.random() < slot.chance)
      .slice(0, feedCount)
      .sort((a, b) => a.hour - b.hour);
    
    // Track which side was last used to alternate
    let lastSide = null;
    
    for (const slot of selectedSlots) {
      const feedStart = generateTimeInDay(currentDate, slot.hour, 60, isToday ? cutoffTime : null);
      
      // Only create feed log if start time is not in the future
      if (feedStart <= cutoffTime) {
        // Feed duration: 5-30 minutes (in seconds for feedDuration field)
        const durationMinutes = randomInt(5, 30);
        const durationSeconds = durationMinutes * 60;
        let feedEnd = new Date(feedStart.getTime() + durationMinutes * 60 * 1000);
        
        // Ensure feed end is not in the future
        if (feedEnd > cutoffTime) {
          feedEnd = cutoffTime;
          // Recalculate duration if we had to cap the end time
          const actualDurationMs = feedEnd.getTime() - feedStart.getTime();
          const actualDurationSeconds = Math.floor(actualDurationMs / 1000);
          if (actualDurationSeconds <= 0) continue; // Skip if no valid duration
        }
        
        // Alternate sides, but sometimes feed from same side twice in a row
        let side;
        if (lastSide === null) {
          // First feed of the day - random side
          side = Math.random() > 0.5 ? 'LEFT' : 'RIGHT';
        } else if (Math.random() > 0.2) {
          // 80% chance to alternate sides
          side = lastSide === 'LEFT' ? 'RIGHT' : 'LEFT';
        } else {
          // 20% chance to use same side
          side = lastSide;
        }
        lastSide = side;
        
        // Calculate actual duration in seconds
        const actualDuration = Math.floor((feedEnd.getTime() - feedStart.getTime()) / 1000);
        
        // Only create the log if it has a positive duration
        if (actualDuration > 0) {
          logs.push({
            id: randomUUID(),
            time: feedStart,
            startTime: feedStart,
            endTime: feedEnd,
            feedDuration: actualDuration,
            type: 'BREAST',
            side: side,
            notes: randomChoice(feedNotes),
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

// Main data generation function
async function generateBreastFeedsData() {
  try {
    console.log(`Starting breast feed log generation...`);
    console.log(`Families: ${familyCount}, Days: ${daysCount}, Clear data: ${clearData}`);
    
    if (clearData) {
      await clearExistingBreastFeeds();
    }
    
    // Generate cutoff time (between 15 minutes and 3 hours ago)
    const cutoffTime = generateCutoffTime();
    const endDate = new Date(cutoffTime);
    const startDate = new Date(endDate.getTime() - (daysCount * 24 * 60 * 60 * 1000));
    
    console.log(`Breast feed logs will be generated from ${startDate.toLocaleString()} to ${endDate.toLocaleString()}`);
    console.log(`Last entries will be between 15 minutes and 3 hours ago`);
    
    let totalBreastFeeds = 0;
    let familiesProcessed = 0;
    let babiesProcessed = 0;
    
    // Get all active families (or limit to familyCount)
    const families = await prisma.family.findMany({
      where: { isActive: true },
      take: familyCount,
      include: {
        babies: {
          where: { inactive: false }
        },
        caretakers: {
          where: { inactive: false }
        }
      }
    });
    
    if (families.length === 0) {
      console.log('No active families found. Please create families and babies first.');
      return;
    }
    
    for (const family of families) {
      familiesProcessed++;
      console.log(`Processing family ${familiesProcessed}/${families.length}: ${family.name} (${family.slug})`);
      
      if (family.babies.length === 0) {
        console.log(`  No active babies found for this family, skipping...`);
        continue;
      }
      
      if (family.caretakers.length === 0) {
        console.log(`  No active caretakers found for this family, skipping...`);
        continue;
      }
      
      // Generate breast feeds for each baby
      for (const baby of family.babies) {
        babiesProcessed++;
        console.log(`    Generating breast feeds for ${baby.firstName}...`);
        
        const breastFeeds = await generateBreastFeeds(
          baby,
          family.caretakers,
          family,
          startDate,
          endDate,
          cutoffTime
        );
        
        if (breastFeeds.length > 0) {
          await prisma.feedLog.createMany({ data: breastFeeds });
          totalBreastFeeds += breastFeeds.length;
          console.log(`      Created ${breastFeeds.length} breast feed logs`);
        } else {
          console.log(`      No breast feed logs created (date range may be in the future)`);
        }
      }
    }
    
    console.log(`\nBreast feed log generation completed successfully!`);
    console.log(`Generated:`);
    console.log(`- ${familiesProcessed} families processed`);
    console.log(`- ${babiesProcessed} babies processed`);
    console.log(`- ${totalBreastFeeds} breast feed logs`);
    
  } catch (error) {
    console.error('Error generating breast feed logs:', error);
    throw error;
  }
}

// Run the data generation
generateBreastFeedsData()
  .catch(e => {
    console.error('Breast feed log generation failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

