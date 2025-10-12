/**
 * Family Subscription Management Script for Sprout Track
 * Manages trial and subscription statuses for testing purposes
 * Run with: node scripts/manage-family-subscriptions.js
 */

const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const prisma = new PrismaClient();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Utility function to prompt user for input
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Utility function to format dates
function formatDate(date) {
  if (!date) return 'None';
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// List random 15 families with their current subscription status
async function listFamilies() {
  console.log('\n========================================');
  console.log('        Family List (Random 15)');
  console.log('========================================');

  // Get total count first
  const totalFamilies = await prisma.family.count();
  console.log(`Total families in database: ${totalFamilies}`);

  if (totalFamilies === 0) {
    console.log('No families found.');
    return [];
  }

  // Get random 15 families (or all if less than 15)
  const limit = Math.min(15, totalFamilies);
  const families = await prisma.family.findMany({
    include: {
      account: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          betaparticipant: true,
          trialEnds: true,
          planType: true,
          planExpires: true,
          verified: true
        }
      },
      babies: {
        select: {
          firstName: true,
          lastName: true,
          birthDate: true
        }
      }
    },
    orderBy: {
      name: 'asc'
    },
    take: limit,
    skip: Math.floor(Math.random() * Math.max(0, totalFamilies - limit))
  });

  console.log(`Showing ${families.length} randomly selected families:\n`);

  if (families.length === 0) {
    console.log('No families found.');
    return [];
  }

  families.forEach((family, index) => {
    console.log(`\n${index + 1}. ${family.name} (${family.slug})`);
    console.log(`   ID: ${family.id}`);
    console.log(`   Active: ${family.isActive ? 'Yes' : 'No'}`);
    console.log(`   Babies: ${family.babies.length}`);

    if (family.account) {
      const account = family.account;
      console.log(`   Account: ${account.firstName || 'Unknown'} ${account.lastName || ''} (${account.email})`);
      console.log(`   Beta Participant: ${account.betaparticipant ? 'Yes' : 'No'}`);
      console.log(`   Verified: ${account.verified ? 'Yes' : 'No'}`);

      // Determine current status
      const now = new Date();
      let status = 'Unknown';
      let details = '';

      if (account.betaparticipant) {
        status = 'Beta Participant (full Access)';
        details = 'No expiration';
      } else if (account.trialEnds) {
        const trialEnd = new Date(account.trialEnds);
        if (now > trialEnd) {
          status = 'Trial Expired';
          details = `Expired: ${formatDate(trialEnd)}`;
        } else {
          status = 'Trial Active';
          details = `Expires: ${formatDate(trialEnd)}`;
        }
      } else if (account.planType && account.planExpires) {
        const planEnd = new Date(account.planExpires);
        if (now > planEnd) {
          status = 'Subscription Expired';
          details = `Plan: ${account.planType}, Expired: ${formatDate(planEnd)}`;
        } else {
          status = 'Subscription Active';
          details = `Plan: ${account.planType}, Expires: ${formatDate(planEnd)}`;
        }
      } else if (account.planType && !account.planExpires) {
        status = 'Full License';
        details = `Plan: ${account.planType}, No expiration`;
      } else {
        status = 'No Active Plan';
        details = 'No trial or subscription';
      }

      console.log(`   Status: ${status}`);
      console.log(`   Details: ${details}`);
    } else {
      console.log(`   Account: None (Legacy family)`);
      console.log(`   Status: Legacy (No subscription required)`);
    }
  });

  return families;
}

// Set family subscription status
async function setFamilyStatus(familyId, statusType) {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    include: {
      account: true
    }
  });

  if (!family) {
    throw new Error('Family not found');
  }

  if (!family.account) {
    throw new Error('Family has no associated account - cannot manage subscription');
  }

  const now = new Date();
  let updateData = {};

  switch (statusType) {
    case 'trial_active':
      // 14-day trial starting now
      const trialEnd = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000));
      // Set to 11:59 PM of the 14th day
      trialEnd.setHours(23, 59, 59, 999);

      updateData = {
        trialEnds: trialEnd,
        planType: null,
        planExpires: null,
        betaparticipant: false
      };
      console.log(`✓ Set trial active: expires ${formatDate(trialEnd)}`);
      break;

    case 'trial_expired':
      // Trial expired 2 days ago
      const expiredTrial = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000));
      expiredTrial.setHours(23, 59, 59, 999);

      updateData = {
        trialEnds: expiredTrial,
        planType: null,
        planExpires: null,
        betaparticipant: false
      };
      console.log(`✓ Set trial expired: expired ${formatDate(expiredTrial)}`);
      break;

    case 'sub_active':
      // Active subscription expiring in 30 days
      const subEnd = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
      subEnd.setHours(23, 59, 59, 999);

      updateData = {
        trialEnds: null,
        planType: 'sub',
        planExpires: subEnd,
        betaparticipant: false
      };
      console.log(`✓ Set subscription active: expires ${formatDate(subEnd)}`);
      break;

    case 'sub_expired':
      // Subscription expired 2 days ago
      const expiredSub = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000));
      expiredSub.setHours(23, 59, 59, 999);

      updateData = {
        trialEnds: null,
        planType: 'sub',
        planExpires: expiredSub,
        betaparticipant: false
      };
      console.log(`✓ Set subscription expired: expired ${formatDate(expiredSub)}`);
      break;

    case 'full':
      // full license (500 years in the future)
      const fullEnd = new Date(now.getTime() + (500 * 365 * 24 * 60 * 60 * 1000));

      updateData = {
        trialEnds: null,
        planType: 'full',
        planExpires: fullEnd,
        betaparticipant: false
      };
      console.log(`✓ Set full license: expires ${formatDate(fullEnd)}`);
      break;

    case 'beta':
      // Beta participant (full access)
      updateData = {
        trialEnds: null,
        planType: null,
        planExpires: null,
        betaparticipant: true
      };
      console.log(`✓ Set beta participant: full access`);
      break;

    default:
      throw new Error('Invalid status type');
  }

  // Update the account
  await prisma.account.update({
    where: { id: family.account.id },
    data: updateData
  });

  console.log(`✓ Successfully updated ${family.name} (${family.slug})`);
}

// Main interactive menu
async function showMenu() {
  console.log('\n========================================');
  console.log('    Family Subscription Manager');
  console.log('========================================');
  console.log('1. List all families');
  console.log('2. Set family status');
  console.log('3. Exit');
  console.log('');

  const choice = await askQuestion('Choose an option (1-3): ');

  switch (choice) {
    case '1':
      await listFamilies();
      await showMenu();
      break;

    case '2':
      await setFamilyStatusMenu();
      await showMenu();
      break;

    case '3':
      console.log('Goodbye!');
      rl.close();
      break;

    default:
      console.log('Invalid option. Please try again.');
      await showMenu();
      break;
  }
}

// Set family status submenu
async function setFamilyStatusMenu() {
  const families = await listFamilies();

  if (families.length === 0) {
    console.log('No families available to modify.');
    return;
  }

  console.log('\nSelect a family to modify:');
  const familyChoice = await askQuestion(`Enter family number (1-${families.length}): `);
  const familyIndex = parseInt(familyChoice) - 1;

  if (familyIndex < 0 || familyIndex >= families.length) {
    console.log('Invalid family selection.');
    return;
  }

  const selectedFamily = families[familyIndex];
  console.log(`\nSelected: ${selectedFamily.name} (${selectedFamily.slug})`);

  if (!selectedFamily.account) {
    console.log('This family has no account - cannot manage subscription status.');
    return;
  }

  console.log('\nAvailable status options:');
  console.log('1. Trial Active (14 days from now)');
  console.log('2. Trial Expired (2 days ago)');
  console.log('3. Subscription Active (30 days from now)');
  console.log('4. Subscription Expired (2 days ago)');
  console.log('5. Full License (500 years)');
  console.log('6. Beta Participant (full access)');
  console.log('7. Cancel');

  const statusChoice = await askQuestion('Choose status (1-7): ');

  const statusMap = {
    '1': 'trial_active',
    '2': 'trial_expired',
    '3': 'sub_active',
    '4': 'sub_expired',
    '5': 'full',
    '6': 'beta'
  };

  if (statusChoice === '7') {
    console.log('Cancelled.');
    return;
  }

  const statusType = statusMap[statusChoice];
  if (!statusType) {
    console.log('Invalid status selection.');
    return;
  }

  try {
    await setFamilyStatus(selectedFamily.id, statusType);
    console.log(`\n✓ Successfully updated ${selectedFamily.name}'s subscription status!`);
  } catch (error) {
    console.error(`\n✗ Error updating family status: ${error.message}`);
  }
}

// Main execution
async function main() {
  try {
    console.log('Family Subscription Management Tool');
    console.log('Use this tool to test different subscription scenarios.');
    console.log('CAUTION: This modifies real database data!');

    await showMenu();
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  rl.close();
  await prisma.$disconnect();
  process.exit(0);
});

// Run the script
main().catch(console.error);