# Multi-Family Migration Script

This document provides a migration script and instructions for transitioning the existing database to support multiple families. The migration process is designed to be minimally disruptive, allowing for a smooth transition from a single-family to a multi-family model.

## Migration Process Overview

1. Create a new Prisma migration that adds the Family model and familyId fields to all relevant models
2. Run the migration to update the database schema
3. Execute a script to create a default family and assign all existing data to it
4. Optionally, make the familyId fields required after the migration is complete

## Step 1: Create Prisma Migration

Run the following command to create a new migration:

```bash
npx prisma migrate dev --name add-multi-family-support
```

This will generate a new migration file based on the changes made to the schema.prisma file.

## Step 2: Migration Script

Create a file named `migrate-to-multi-family.ts` in the `prisma` directory with the following content:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting multi-family migration...');

  // Create default family
  const defaultFamily = await prisma.family.create({
    data: {
      name: 'Default Family',
      slug: 'default-family',
      isActive: true,
    },
  });

  console.log(`Created default family with ID: ${defaultFamily.id}`);

  // Get existing settings to use the familyName
  const existingSettings = await prisma.settings.findFirst();
  
  if (existingSettings) {
    // Update the default family name if settings exist
    await prisma.family.update({
      where: { id: defaultFamily.id },
      data: { name: existingSettings.familyName },
    });
    console.log(`Updated default family name to: ${existingSettings.familyName}`);
  }

  // Update all existing records to reference the default family
  const models = [
    'baby',
    'caretaker',
    'sleepLog',
    'unit',
    'feedLog',
    'diaperLog',
    'moodLog',
    'note',
    'settings',
    'milestone',
    'pumpLog',
    'playLog',
    'bathLog',
    'measurement',
    'contact',
    'calendarEvent',
    'medicine',
    'medicineLog',
  ];

  for (const model of models) {
    const count = await updateModelFamilyId(model, defaultFamily.id);
    console.log(`Updated ${count} records in ${model} model`);
  }

  // Create FamilyMember records for all caretakers
  const caretakers = await prisma.caretaker.findMany();
  
  for (const caretaker of caretakers) {
    await prisma.familyMember.create({
      data: {
        familyId: defaultFamily.id,
        caretakerId: caretaker.id,
        role: caretaker.role === 'ADMIN' ? 'admin' : 'member',
      },
    });
  }
  
  console.log(`Created ${caretakers.length} family member records`);

  console.log('Migration completed successfully!');
}

async function updateModelFamilyId(model: string, familyId: string): Promise<number> {
  // Use dynamic property access to update each model
  const updateResult = await (prisma as any)[model].updateMany({
    where: {
      familyId: null,
    },
    data: {
      familyId,
    },
  });

  return updateResult.count;
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

## Step 3: Run the Migration Script

Execute the migration script with the following command:

```bash
npx ts-node prisma/migrate-to-multi-family.ts
```

This script will:
1. Create a default family
2. Update the family name based on existing settings
3. Update all existing records to reference the default family
4. Create FamilyMember records for all caretakers

## Step 4: Make familyId Required (Optional)

After confirming that the migration was successful and all data is properly associated with the default family, you can make the familyId fields required. This step is optional but recommended for data integrity.

1. Update the schema.prisma file to make familyId required in all models by changing `String?` to `String`
2. Create a new migration:

```bash
npx prisma migrate dev --name make-family-id-required
```

## Verification Steps

After completing the migration, verify that:

1. All records have been properly associated with the default family
2. The application functions correctly with the new multi-family schema
3. New records are properly associated with families
4. Family-based filtering works as expected

## Rollback Plan

If issues are encountered during the migration:

1. Restore the database from backup
2. Revert the schema changes
3. Run `npx prisma migrate resolve --rolled-back add-multi-family-support`

## Additional Considerations

- **API Updates**: Ensure all API endpoints include family-based filtering
- **Authentication**: Update authentication to include family context
- **Frontend**: Update UI to display and manage family information
- **Testing**: Thoroughly test all functionality with multiple families
