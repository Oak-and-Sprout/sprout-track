import prisma from './db';
import * as fs from 'fs';
import * as path from 'path';

type UnitData = {
  unitAbbr: string;
  unitName: string;
  activityTypes?: string;
};

async function main() {
  // Check if any families exist - if not, create the initial family and system caretaker
  const familyCount = await prisma.family.count();
  let defaultFamilyId: string;

  if (familyCount === 0) {
    console.log('No families found. Creating initial family and system caretaker...');
    
    // Create the default family
    const defaultFamily = await prisma.family.create({
      data: {
        name: "My Family",
        slug: "my-family",
        isActive: true
      }
    });
    
    defaultFamilyId = defaultFamily.id;
    console.log(`Created default family: ${defaultFamily.name} (${defaultFamily.slug})`);
    
    // Create the system caretaker associated with the default family
    const systemCaretaker = await prisma.caretaker.create({
      data: {
        loginId: '00',
        name: 'system',
        type: 'System Administrator',
        role: 'ADMIN',
        securityPin: '111222', // Default PIN
        familyId: defaultFamilyId,
        inactive: false,
        deletedAt: null
      }
    });
    
    console.log(`Created system caretaker with loginId: ${systemCaretaker.loginId}`);
  } else {
    // Get the first family's ID for settings
    const firstFamily = await prisma.family.findFirst();
    defaultFamilyId = firstFamily!.id;
    console.log(`Using existing family: ${firstFamily!.name} for settings`);
  }

  // Ensure default settings exist with PIN 111222
  const settingsCount = await prisma.settings.count();
  if (settingsCount === 0) {
    console.log('Creating default settings with PIN: 111222');
    await prisma.settings.create({
      data: {
        familyId: defaultFamilyId,
        familyName: "My Family",
        securityPin: "111222",
        // authType will be auto-detected based on caretaker existence
        defaultBottleUnit: "OZ",
        defaultSolidsUnit: "TBSP",
        defaultHeightUnit: "IN",
        defaultWeightUnit: "LB",
        defaultTempUnit: "F",
        enableDebugTimer: false,
        enableDebugTimezone: false
      }
    });
  } else {
    console.log('Default settings already exist');
  }

  // Define all available units with their activity types
  const unitData: UnitData[] = [
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
    { unitAbbr: 'MMOL', unitName: 'Millimoles', activityTypes: 'medicine' },
    { unitAbbr: 'DROP', unitName: 'Drops', activityTypes: 'medicine' },
    { unitAbbr: 'DOSE', unitName: 'Dose', activityTypes: 'medicine' },
    { unitAbbr: 'PILL', unitName: 'Pill', activityTypes: 'medicine' },
    { unitAbbr: 'CAP', unitName: 'Cap', activityTypes: 'medicine' },
    { unitAbbr: 'TAB', unitName: 'Tab', activityTypes: 'medicine' },
    { unitAbbr: 'SPRAY', unitName: 'Spray', activityTypes: 'medicine' },
    { unitAbbr: 'INHALER', unitName: 'Inhaler', activityTypes: 'medicine' },
    { unitAbbr: 'INJECTION', unitName: 'Injection', activityTypes: 'medicine' },
    { unitAbbr: 'PATCH', unitName: 'Patch', activityTypes: 'medicine' },
    { unitAbbr: 'CREAM', unitName: 'Cream', activityTypes: 'medicine' },
    { unitAbbr: 'OINTMENT', unitName: 'Ointment', activityTypes: 'medicine' },
    { unitAbbr: 'SUPPOSITORY', unitName: 'Suppository', activityTypes: 'medicine' },
  ];

  // Handle units separately
  await updateUnits(unitData);

  // Seed CDC growth chart data
  await seedCdcGrowthChartData();

  console.log('Seed script completed successfully!');
}

/**
 * Updates units in the database by checking which units exist and only adding the ones that don't exist yet.
 * Also updates existing units with activity types if they don't have them set.
 * @param unitData Array of unit data objects with unitAbbr, unitName, and activityTypes
 */
async function updateUnits(unitData: UnitData[]): Promise<void> {
  console.log('Checking for missing units and updating activity types...');
  
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
    console.log(`Adding ${missingUnits.length} missing units: ${missingUnits.map(u => u.unitAbbr).join(', ')}`);
    
    for (const unit of missingUnits) {
      await prisma.unit.create({
        data: {
          ...unit
        }
      });
    }
  } else {
    console.log('All units already exist in the database.');
  }
  
  // Update activity types for all existing units
  const unitsToUpdate = [];
  for (const unit of unitData) {
    const existingUnit = existingUnitsMap.get(unit.unitAbbr);
    if (existingUnit) {
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
      console.log(`Setting ${unit.unitAbbr} activity types to: ${unit.activityTypes}`);
      await prisma.unit.update({
        where: { id: unit.id },
        data: { activityTypes: unit.activityTypes }
      });
    }
  } else {
    console.log('No units need activity types updated.');
  }
  
  console.log('Units update completed successfully.');
}

/**
 * CDC growth chart record type (without measurementType since we use separate tables)
 */
type CdcGrowthRecord = {
  sex: number;
  ageMonths: number;
  l: number;
  m: number;
  s: number;
  p3: number;
  p5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p97: number;
};

/**
 * Parses a CDC growth chart CSV file and returns structured data
 * @param filePath Path to the CSV file
 */
function parseCdcCsvFile(filePath: string): CdcGrowthRecord[] {
  let fileContent = fs.readFileSync(filePath, 'utf-8');
  // Remove UTF-8 BOM if present (appears as U+FEFF when read as UTF-8)
  fileContent = fileContent.replace(/^\uFEFF/, '');
  const lines = fileContent.trim().split('\n');

  // Skip the header row
  const dataLines = lines.slice(1);

  return dataLines.map(line => {
    const values = line.split(',');
    return {
      sex: parseInt(values[0], 10),
      ageMonths: parseFloat(values[1]),
      l: parseFloat(values[2]),
      m: parseFloat(values[3]),
      s: parseFloat(values[4]),
      p3: parseFloat(values[5]),
      p5: parseFloat(values[6]),
      p10: parseFloat(values[7]),
      p25: parseFloat(values[8]),
      p50: parseFloat(values[9]),
      p75: parseFloat(values[10]),
      p90: parseFloat(values[11]),
      p95: parseFloat(values[12]),
      p97: parseFloat(values[13]),
    };
  });
}

/**
 * Seeds CDC growth chart reference data from CSV files into separate tables
 * Only inserts data if it doesn't already exist in each table
 */
async function seedCdcGrowthChartData(): Promise<void> {
  console.log('Checking for CDC growth chart data...');

  const documentationDir = path.join(__dirname, '..', 'documentation');

  // Seed weight-for-age data
  const weightCount = await prisma.cdcWeightForAge.count();
  if (weightCount === 0) {
    const weightFilePath = path.join(documentationDir, 'wtageinf.csv');
    if (fs.existsSync(weightFilePath)) {
      const weightData = parseCdcCsvFile(weightFilePath);
      console.log(`Inserting ${weightData.length} records for weight-for-age...`);
      await prisma.cdcWeightForAge.createMany({ data: weightData });
    } else {
      console.warn('Warning: wtageinf.csv not found');
    }
  } else {
    console.log(`Weight-for-age data already exists (${weightCount} records). Skipping.`);
  }

  // Seed length-for-age data
  const lengthCount = await prisma.cdcLengthForAge.count();
  if (lengthCount === 0) {
    const lengthFilePath = path.join(documentationDir, 'lenageinf.csv');
    if (fs.existsSync(lengthFilePath)) {
      const lengthData = parseCdcCsvFile(lengthFilePath);
      console.log(`Inserting ${lengthData.length} records for length-for-age...`);
      // Insert one by one to avoid createMany issues
      for (const record of lengthData) {
        await prisma.cdcLengthForAge.create({ data: record });
      }
    } else {
      console.warn('Warning: lenageinf.csv not found');
    }
  } else {
    console.log(`Length-for-age data already exists (${lengthCount} records). Skipping.`);
  }

  // Seed head circumference-for-age data
  const hcCount = await prisma.cdcHeadCircumferenceForAge.count();
  if (hcCount === 0) {
    const hcFilePath = path.join(documentationDir, 'hcageinf.csv');
    if (fs.existsSync(hcFilePath)) {
      const hcData = parseCdcCsvFile(hcFilePath);
      console.log(`Inserting ${hcData.length} records for head-circumference-for-age...`);
      // Insert one by one to avoid createMany issues
      for (const record of hcData) {
        await prisma.cdcHeadCircumferenceForAge.create({ data: record });
      }
    } else {
      console.warn('Warning: hcageinf.csv not found');
    }
  } else {
    console.log(`Head-circumference-for-age data already exists (${hcCount} records). Skipping.`);
  }

  console.log('CDC growth chart data seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch (error) {
      console.error('Error disconnecting from database:', error);
      process.exit(1);
    }
  });
