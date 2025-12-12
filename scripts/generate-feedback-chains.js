/**
 * Generate test feedback chains script for Sprout Track
 * Creates 2-3 feedback chains with replies from existing accounts
 * Run with: node scripts/generate-feedback-chains.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Funny feedback messages for the chains
const feedbackChains = [
  {
    subject: "Weather Discussion",
    messages: [
      {
        text: "I think it's going to rain tomorrow. Should I bring an umbrella?",
        delayMinutes: 0,
      },
      {
        text: "Actually, I just checked the forecast and it says sunny skies! No umbrella needed.",
        delayMinutes: 15,
      },
      {
        text: "But my weather app says 60% chance of rain. Which app are you using?",
        delayMinutes: 30,
      },
      {
        text: "I use WeatherWidget Pro. It's been pretty accurate for me. Maybe your app needs an update?",
        delayMinutes: 45,
      },
    ],
  },
  {
    subject: "Daisies vs Elephants Debate",
    messages: [
      {
        text: "I just want to clarify: daisies are NOT elephants. This is a common misconception.",
        delayMinutes: 0,
      },
      {
        text: "Wait, are you saying someone actually thinks daisies are elephants? That's hilarious!",
        delayMinutes: 20,
      },
      {
        text: "You'd be surprised! I've had to explain this multiple times. Daisies are flowers, elephants are mammals. Completely different kingdoms!",
        delayMinutes: 40,
      },
      {
        text: "Well, they're both gray... wait, no. Daisies are white and yellow. My mistake!",
        delayMinutes: 60,
      },
      {
        text: "Exactly! See? This is why we need this clarification. Thank you for helping spread awareness.",
        delayMinutes: 80,
      },
    ],
  },
  {
    subject: "Coffee Temperature Preferences",
    messages: [
      {
        text: "Is it just me, or is coffee always either too hot or too cold? There's no in-between!",
        delayMinutes: 0,
      },
      {
        text: "I totally agree! I've started putting ice cubes in mine immediately. Problem solved!",
        delayMinutes: 25,
      },
      {
        text: "Ice cubes? That's genius! But doesn't it water down the flavor?",
        delayMinutes: 50,
      },
      {
        text: "Not if you use coffee ice cubes! Freeze leftover coffee in an ice tray. Game changer!",
        delayMinutes: 75,
      },
    ],
  },
];

async function generateFeedbackChains() {
  try {
    console.log('Starting feedback chain generation...\n');

    // Get existing accounts that have families
    const accounts = await prisma.account.findMany({
      where: {
        familyId: { not: null },
        closed: false, // Only get active accounts
      },
      include: {
        family: true,
      },
      take: 10, // Get up to 10 accounts
    });

    if (accounts.length === 0) {
      console.log('No accounts with families found. Please create some accounts first.');
      return;
    }

    console.log(`Found ${accounts.length} account(s) with families.\n`);

    // Get admin email from AppConfig for admin replies
    const appConfig = await prisma.appConfig.findFirst();
    const adminEmail = appConfig?.adminEmail || 'admin@example.com';

    // Generate feedback chains
    let chainCount = 0;
    const now = new Date();

    for (const chain of feedbackChains) {
      if (chainCount >= accounts.length) {
        console.log(`\nNot enough accounts to create all chains. Created ${chainCount} chain(s).`);
        break;
      }

      const account = accounts[chainCount];
      console.log(`Creating feedback chain "${chain.subject}" for account ${account.email}...`);

      // Create original feedback
      const originalFeedback = await prisma.feedback.create({
        data: {
          subject: chain.subject,
          message: chain.messages[0].text,
          familyId: account.familyId,
          accountId: account.id,
          submitterName: account.firstName 
            ? `${account.firstName} ${account.lastName || ''}`.trim()
            : account.email.split('@')[0],
          submitterEmail: account.email,
          viewed: false,
          submittedAt: new Date(now.getTime() - chain.messages[0].delayMinutes * 60000),
        },
      });

      console.log(`  ✓ Created original feedback: "${chain.subject}"`);

      // Create replies
      for (let i = 1; i < chain.messages.length; i++) {
        const message = chain.messages[i];
        const replyTime = new Date(now.getTime() - message.delayMinutes * 60000);
        
        // Alternate between user and admin replies
        const isAdminReply = i % 2 === 1;
        
        const reply = await prisma.feedback.create({
          data: {
            subject: `Re: ${chain.subject}`,
            message: message.text,
            familyId: account.familyId,
            parentId: originalFeedback.id,
            accountId: isAdminReply ? null : account.id,
            submitterName: isAdminReply ? 'Admin' : (account.firstName 
              ? `${account.firstName} ${account.lastName || ''}`.trim()
              : account.email.split('@')[0]),
            submitterEmail: isAdminReply ? adminEmail : account.email,
            viewed: false,
            submittedAt: replyTime,
          },
        });

        console.log(`  ✓ Created reply ${i} (${isAdminReply ? 'Admin' : 'User'}): "${message.text.substring(0, 50)}..."`);
      }

      chainCount++;
      console.log(`  ✓ Completed chain "${chain.subject}" with ${chain.messages.length} messages\n`);
    }

    console.log(`\n✅ Successfully created ${chainCount} feedback chain(s)!`);
    console.log(`\nYou can view them in the Family Manager under the Feedback tab.`);

  } catch (error) {
    console.error('Error generating feedback chains:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
generateFeedbackChains()
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

