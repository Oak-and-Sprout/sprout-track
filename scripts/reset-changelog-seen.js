#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Manually load environment variables from .env file
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n');

  for (const line of envLines) {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key.trim()] = value;
      }
    }
  }
}

async function main() {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  });

  try {
    const accountResult = await prisma.account.updateMany({
      data: { lastSeenVersion: null },
    });
    console.log(`Reset lastSeenVersion for ${accountResult.count} accounts.`);

    const caretakerResult = await prisma.caretaker.updateMany({
      data: { lastSeenVersion: null },
    });
    console.log(`Reset lastSeenVersion for ${caretakerResult.count} caretakers.`);

    console.log('Changelog seen status reset successfully.');
  } catch (error) {
    console.error('Error resetting changelog seen status:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
