// Family migration script for multi-family support
// This script creates a single family record and associates all existing data with it
const { PrismaClient } = require('@prisma/client');
const { createPrismaAdapter } = require('../prisma/prisma-adapter');

const prisma = new PrismaClient({ adapter: createPrismaAdapter(process.env.DATABASE_URL) });

// Slug word lists copied directly from app/api/utils/slug-words.ts
const adjectives = [
  'adorable', 'fluffy', 'cuddly', 'tiny', 'fuzzy', 'sweet', 'playful', 'gentle', 'happy',
  'bouncy', 'sleepy', 'snuggly', 'cheerful', 'bubbly', 'cozy', 'merry', 'giggly', 'jolly',
  'silly', 'wiggly', 'charming', 'dainty', 'darling', 'precious', 'lovable', 'huggable',
  'perky', 'sprightly', 'twinkly', 'whimsical', 'delightful', 'friendly', 'joyful', 'peppy',
  'snuggable', 'squeaky', 'teeny', 'itty-bitty', 'little', 'mini', 'petite', 'pocket-sized',
  'wee', 'chubby', 'plump', 'pudgy', 'roly-poly', 'round', 'squishy', 'tubby'
];

const animals = [
  'kitten', 'puppy', 'bunny', 'duckling', 'chick', 'calf', 'lamb', 'piglet', 'fawn',
  'cub', 'foal', 'joey', 'owlet', 'panda', 'koala', 'hamster', 'hedgehog', 'otter',
  'chinchilla', 'squirrel', 'chipmunk', 'mouse', 'gerbil', 'ferret', 'meerkat', 'sloth',
  'penguin', 'seal', 'walrus', 'alpaca', 'llama', 'capybara', 'quokka', 'wombat', 'beaver',
  'mole', 'dormouse', 'shrew', 'vole', 'lemur', 'marmoset', 'tamarin', 'loris', 'tarsier',
  'gibbon', 'raccoon', 'skunk', 'badger', 'fox', 'wolf', 'coyote', 'dingo', 'jackal',
  'deer', 'moose', 'elk', 'caribou', 'gazelle', 'antelope', 'impala', 'zebra', 'giraffe',
  'okapi', 'hippo', 'rhino', 'elephant', 'manatee', 'dugong', 'dolphin', 'porpoise', 'whale',
  'narwhal', 'beluga', 'turtle', 'tortoise', 'terrapin', 'lizard', 'gecko', 'chameleon',
  'iguana', 'salamander', 'newt', 'axolotl', 'frog', 'toad', 'tadpole', 'fish', 'goldfish',
  'guppy', 'minnow', 'tetra', 'betta', 'angelfish', 'clownfish', 'seahorse', 'starfish',
  'jellyfish', 'crab', 'lobster', 'shrimp', 'snail', 'slug', 'butterfly', 'caterpillar',
  'ladybug', 'beetle', 'bumblebee', 'honeybee', 'dragonfly', 'firefly', 'grasshopper',
  'cricket', 'mantis', 'ant', 'spider', 'scorpion', 'robin', 'sparrow', 'finch', 'canary',
  'parakeet', 'parrot', 'macaw', 'cockatoo', 'toucan', 'hummingbird', 'chickadee', 'cardinal',
  'bluejay', 'woodpecker', 'duck', 'goose', 'swan', 'peacock', 'flamingo', 'stork', 'crane',
  'heron', 'pelican', 'seagull', 'puffin', 'owl', 'hawk', 'eagle', 'falcon', 'kestrel',
  'kiwi', 'ostrich', 'emu', 'platypus', 'echidna', 'armadillo', 'pangolin', 'aardvark'
];

// Generate a random slug by combining an adjective and animal
function generateSlug() {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `${adjective}-${animal}`;
}

// Generate a random slug with a numeric suffix for additional uniqueness
function generateSlugWithNumber(digits = 4) {
  const baseSlug = generateSlug();
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
  return `${baseSlug}-${randomNumber}`;
}

// Models that need to be updated with familyId
const modelsToUpdate = [
  'baby',
  'caretaker',
  'settings',
  'sleepLog',
  'feedLog',
  'diaperLog',
  'moodLog',
  'note',
  'milestone',
  'pumpLog',
  'playLog',
  'bathLog',
  'measurement',
  'medicine',
  'medicineLog',
  'contact',
  'calendarEvent'
];

// Generate a unique slug for the family
async function generateUniqueSlug() {
  // Try to generate a unique slug (max 10 attempts with basic slug)
  let slug = '';
  let isUnique = false;
  let attempts = 0;
  
  // First try with basic slugs (adjective-animal)
  while (!isUnique && attempts < 10) {
    slug = generateSlug();
    
    // Check if this slug already exists in the database
    try {
      const existingFamilies = await prisma.$queryRaw`
        SELECT * FROM "Family" WHERE slug = ${slug} LIMIT 1
      `;
      
      if (Array.isArray(existingFamilies) && existingFamilies.length === 0) {
        isUnique = true;
      }
    } catch (error) {
      // If the query fails (e.g., table doesn't exist yet), assume it's unique
      console.log('Error checking slug uniqueness, assuming unique:', error.message);
      isUnique = true;
    }
    
    attempts++;
  }
  
  // If we couldn't find a unique basic slug, try with numeric suffix
  if (!isUnique) {
    attempts = 0;
    while (!isUnique && attempts < 10) {
      slug = generateSlugWithNumber();
      
      try {
        // Check if this slug already exists in the database
        const existingFamilies = await prisma.$queryRaw`
          SELECT * FROM "Family" WHERE slug = ${slug} LIMIT 1
        `;
        
        if (Array.isArray(existingFamilies) && existingFamilies.length === 0) {
          isUnique = true;
        }
      } catch (error) {
        // If the query fails, assume it's unique
        console.log('Error checking slug uniqueness, assuming unique:', error.message);
        isUnique = true;
      }
      
      attempts++;
    }
  }
  
  return slug;
}

// Main function to update the database
async function updateDatabase() {
  try {
    console.log('Checking if family migration is needed...');
    
    // Check if any family records already exist
    const existingFamilies = await prisma.family.findMany({
      take: 1
    });
    
    if (existingFamilies.length > 0) {
      console.log('Family records already exist, no migration needed.');
      return;
    }
    
    // Generate a unique slug for the family
    const slug = await generateUniqueSlug();
    console.log(`Generated unique slug: ${slug}`);
    
    // Get the family name from settings if available
    let familyName = 'My Family';
    try {
      const settings = await prisma.settings.findFirst();
      if (settings && settings.familyName) {
        familyName = settings.familyName;
      }
    } catch (error) {
      console.log('Error getting family name from settings:', error.message);
    }
    
    // Create a new family record
    console.log(`Creating new family...`);
    
    const family = await prisma.family.create({
      data: {
        slug: slug,
        name: familyName,
        isActive: true
      }
    });
    
    const familyId = family.id;
    console.log(`Created new family with ID: ${familyId}`);
    
    console.log('Family record created successfully.');
    
    // Create family member relationships for system user and all existing caretakers
    try {
      console.log('Creating family member relationships...');
      
      const familyMemberData = [];
      
      // Create or update system caretaker
      let systemCaretaker = await prisma.caretaker.findFirst({
        where: { 
          loginId: '00',
          familyId: familyId 
        }
      });
      
      if (!systemCaretaker) {
        console.log('Creating system caretaker...');
        
        // Get security pin from settings table
        let securityPin = '111222'; // Default fallback from schema
        try {
          const settings = await prisma.settings.findFirst();
          if (settings && settings.securityPin) {
            securityPin = settings.securityPin;
            console.log('Using security pin from settings table.');
          } else {
            console.log('No settings found or no security pin set, using default: 111222');
          }
        } catch (error) {
          console.log('Error reading security pin from settings, using default 111222:', error.message);
        }
        
        systemCaretaker = await prisma.caretaker.create({
          data: {
            loginId: '00',
            name: 'system',
            type: 'System Administrator',
            role: 'ADMIN',
            securityPin: securityPin,
            familyId: familyId
          }
        });
        console.log('System caretaker created successfully.');
      } else {
        console.log('System caretaker already exists in this family.');
      }
      
      // Check if system user is already a family member
      const existingSystemMember = await prisma.familyMember.findFirst({
        where: {
          familyId: familyId,
          caretakerId: systemCaretaker.id
        }
      });
      
      if (!existingSystemMember) {
        // Add system user to family with admin role
        familyMemberData.push({
          familyId: familyId,
          caretakerId: systemCaretaker.id,
          role: 'admin',
          joinedAt: new Date()
        });
      } else {
        console.log('System caretaker is already a family member.');
      }
      
      // Get all existing caretakers (excluding system caretaker)
      const caretakers = await prisma.caretaker.findMany({
        where: {
          deletedAt: null,
          loginId: { not: '00' } // Exclude system caretaker to prevent duplicates
        },
        orderBy: {
          createdAt: 'asc'
        }
      });
      
      if (caretakers.length > 0) {
        console.log(`Found ${caretakers.length} caretakers to link to family.`);
        
        // Create FamilyMember records for each caretaker (only if they don't already exist)
        for (const caretaker of caretakers) {
          const existingMember = await prisma.familyMember.findFirst({
            where: {
              familyId: familyId,
              caretakerId: caretaker.id
            }
          });
          
          if (!existingMember) {
            // Determine role based on caretaker's existing role
            let familyRole = 'member'; // default
            
            // Use the caretaker's existing role (ADMIN -> admin, USER -> member)
            if (caretaker.role === 'ADMIN') {
              familyRole = 'admin';
            }
            // USER role becomes member (this is the default we set above)
            
            familyMemberData.push({
              familyId: familyId,
              caretakerId: caretaker.id,
              role: familyRole,
              joinedAt: new Date()
            });
          } else {
            console.log(`Caretaker ${caretaker.name} is already a family member.`);
          }
        }
      }
      
      // Bulk create all family member relationships
      if (familyMemberData.length > 0) {
        await prisma.familyMember.createMany({
          data: familyMemberData
        });
        
        console.log(`Created ${familyMemberData.length} family member relationships.`);
        console.log(`- ${familyMemberData.filter(fm => fm.role === 'admin').length} admin(s)`);
        console.log(`- ${familyMemberData.filter(fm => fm.role === 'member').length} member(s)`);
        console.log(`- System user included as admin`);
      } else {
        console.log('No family member relationships to create.');
      }
    } catch (error) {
      console.error('Error creating family member relationships:', error);
      // Don't exit on this error, continue with other updates
    }
    
    // Update all existing records with the new familyId
    for (const model of modelsToUpdate) {
      try {
        console.log(`Updating ${model} records...`);
        
        // Get count of records for this model
        const countQuery = `SELECT COUNT(*) as count FROM "${model.charAt(0).toUpperCase() + model.slice(1)}"`;
        const countResult = await prisma.$queryRawUnsafe(countQuery);
        const count = countResult[0]?.count || 0;
        
        if (count === 0) {
          console.log(`No ${model} records to update.`);
          continue;
        }
        
        // Update all records for this model
        const updateQuery = `UPDATE "${model.charAt(0).toUpperCase() + model.slice(1)}" SET "familyId" = '${familyId}' WHERE "familyId" IS NULL`;
        await prisma.$executeRawUnsafe(updateQuery);
        
        console.log(`Updated ${count} ${model} records.`);
      } catch (error) {
        console.error(`Error updating ${model} records:`, error);
      }
    }
    
    console.log('Database update for multi-family support completed successfully!');
  } catch (error) {
    console.error('Error updating database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
updateDatabase();
