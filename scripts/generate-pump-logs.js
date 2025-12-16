/**
 * Pump log generation script for Sprout Track
 * Generates realistic pump logs for existing babies
 * Run with: node scripts/generate-pump-logs.js
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

// Clear existing pump logs
async function clearExistingPumpLogs() {
  console.log('Clearing existing pump logs...');
  try {
    await prisma.pumpLog.deleteMany({});
    console.log('Cleared pump log records');
  } catch (error) {
    console.log(`Note: Could not clear pump logs: ${error.message}`);
  }
}

// Generate pump logs for a baby
async function generatePumpLogs(baby, caretakers, family, startDate, endDate, cutoffTime) {
  const logs = [];
  const currentDate = new Date(startDate);
  
  // Common pump units
  const units = ['OZ', 'ML'];
  const defaultUnit = 'OZ';
  
  // Pump notes templates
  const pumpNotes = [
    'Morning pump session',
    'Afternoon pump',
    'Evening pump',
    'Late night pump',
    'Pumped after feeding',
    'Power pump session',
    'Quick pump between feeds',
    null, // 50% chance of no notes
    null,
  ];
  
  while (currentDate <= endDate) {
    const caretaker = randomChoice(caretakers);
    const isToday = isSameDay(currentDate, new Date());
    
    // Generate 3-6 pump sessions per day
    const pumpCount = randomInt(3, 6);
    
    // Common pump times throughout the day
    const pumpTimeSlots = [
      { hour: 6, chance: 0.8 },   // Early morning
      { hour: 9, chance: 0.7 },   // Mid-morning
      { hour: 12, chance: 0.6 },   // Noon
      { hour: 15, chance: 0.7 },  // Afternoon
      { hour: 18, chance: 0.8 },  // Evening
      { hour: 21, chance: 0.6 },  // Late evening
      { hour: 2, chance: 0.4 },   // Overnight
    ];
    
    // Select random time slots for this day
    const selectedSlots = pumpTimeSlots
      .filter(slot => Math.random() < slot.chance)
      .slice(0, pumpCount)
      .sort((a, b) => a.hour - b.hour);
    
    for (const slot of selectedSlots) {
      const pumpStart = generateTimeInDay(currentDate, slot.hour, 60, isToday ? cutoffTime : null);
      
      // Only create pump log if start time is not in the future
      if (pumpStart <= cutoffTime) {
        // Pump duration: 15-45 minutes
        const durationMinutes = randomInt(15, 45);
        let pumpEnd = new Date(pumpStart.getTime() + durationMinutes * 60 * 1000);
        
        // Ensure pump end is not in the future
        if (pumpEnd > cutoffTime) {
          pumpEnd = cutoffTime;
          // Recalculate duration if we had to cap the end time
          const actualDuration = Math.floor((pumpEnd.getTime() - pumpStart.getTime()) / (1000 * 60));
          if (actualDuration <= 0) continue; // Skip if no valid duration
        }
        
        // Generate amounts (in ounces, typically 1-8 oz per side)
        // Sometimes only one side, sometimes both
        const pumpBothSides = Math.random() > 0.2; // 80% chance of both sides
        
        let leftAmount = null;
        let rightAmount = null;
        
        if (pumpBothSides) {
          leftAmount = randomFloat(1.0, 6.0);
          rightAmount = randomFloat(1.0, 6.0);
        } else {
          // Single side pump
          if (Math.random() > 0.5) {
            leftAmount = randomFloat(2.0, 8.0);
          } else {
            rightAmount = randomFloat(2.0, 8.0);
          }
        }
        
        // Round amounts to 1 decimal place
        if (leftAmount !== null) {
          leftAmount = Math.round(leftAmount * 10) / 10;
        }
        if (rightAmount !== null) {
          rightAmount = Math.round(rightAmount * 10) / 10;
        }
        
        // Calculate total amount
        const totalAmount = (leftAmount || 0) + (rightAmount || 0);
        
        // Calculate actual duration
        const actualDuration = Math.floor((pumpEnd.getTime() - pumpStart.getTime()) / (1000 * 60));
        
        // Only create the log if it has a positive duration and at least some amount
        if (actualDuration > 0 && totalAmount > 0) {
          logs.push({
            id: randomUUID(),
            startTime: pumpStart,
            endTime: pumpEnd,
            duration: actualDuration,
            leftAmount: leftAmount,
            rightAmount: rightAmount,
            totalAmount: totalAmount > 0 ? totalAmount : null,
            unitAbbr: defaultUnit,
            notes: randomChoice(pumpNotes),
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
async function generatePumpLogsData() {
  try {
    console.log(`Starting pump log generation...`);
    console.log(`Families: ${familyCount}, Days: ${daysCount}, Clear data: ${clearData}`);
    
    if (clearData) {
      await clearExistingPumpLogs();
    }
    
    // Generate cutoff time (between 15 minutes and 3 hours ago)
    const cutoffTime = generateCutoffTime();
    const endDate = new Date(cutoffTime);
    const startDate = new Date(endDate.getTime() - (daysCount * 24 * 60 * 60 * 1000));
    
    console.log(`Pump logs will be generated from ${startDate.toLocaleString()} to ${endDate.toLocaleString()}`);
    console.log(`Last entries will be between 15 minutes and 3 hours ago`);
    
    let totalPumpLogs = 0;
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
      
      // Generate pump logs for each baby
      for (const baby of family.babies) {
        babiesProcessed++;
        console.log(`    Generating pump logs for ${baby.firstName}...`);
        
        const pumpLogs = await generatePumpLogs(
          baby,
          family.caretakers,
          family,
          startDate,
          endDate,
          cutoffTime
        );
        
        if (pumpLogs.length > 0) {
          await prisma.pumpLog.createMany({ data: pumpLogs });
          totalPumpLogs += pumpLogs.length;
          console.log(`      Created ${pumpLogs.length} pump logs`);
        } else {
          console.log(`      No pump logs created (date range may be in the future)`);
        }
      }
    }
    
    console.log(`\nPump log generation completed successfully!`);
    console.log(`Generated:`);
    console.log(`- ${familiesProcessed} families processed`);
    console.log(`- ${babiesProcessed} babies processed`);
    console.log(`- ${totalPumpLogs} pump logs`);
    
  } catch (error) {
    console.error('Error generating pump logs:', error);
    throw error;
  }
}

// Run the data generation
generatePumpLogsData()
  .catch(e => {
    console.error('Pump log generation failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

