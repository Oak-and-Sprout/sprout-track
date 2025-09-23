import prisma from './db';

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
