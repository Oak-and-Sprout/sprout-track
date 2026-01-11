/* eslint-disable no-console */
import * as webPush from 'web-push';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Script to generate VAPID keys for Web Push notifications
 * Checks if keys exist in environment, generates if missing
 */

const PROJECT_DIR = path.resolve(__dirname, '..');
const ENV_FILE = path.join(PROJECT_DIR, '.env');

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

function generateVapidKeys(): VapidKeys {
  const vapidKeys = webPush.generateVAPIDKeys();
  return {
    publicKey: vapidKeys.publicKey,
    privateKey: vapidKeys.privateKey,
  };
}

function readEnvFile(): string {
  try {
    if (fs.existsSync(ENV_FILE)) {
      return fs.readFileSync(ENV_FILE, 'utf-8');
    }
    return '';
  } catch (error) {
    console.error('Error reading .env file:', error);
    return '';
  }
}

function writeEnvFile(content: string): void {
  try {
    fs.writeFileSync(ENV_FILE, content, 'utf-8');
    console.log('✅ VAPID keys written to .env file');
  } catch (error) {
    console.error('❌ Error writing to .env file:', error);
    throw error;
  }
}

function hasVapidKeys(envContent: string): boolean {
  const hasPublicKey = /^VAPID_PUBLIC_KEY=/.test(envContent) || /VAPID_PUBLIC_KEY=/.test(envContent);
  const hasPrivateKey = /^VAPID_PRIVATE_KEY=/.test(envContent) || /VAPID_PRIVATE_KEY=/.test(envContent);
  return hasPublicKey && hasPrivateKey;
}

function getVapidSubject(envContent: string): string {
  const match = envContent.match(/^VAPID_SUBJECT=(.+)$/m);
  if (match && match[1]) {
    return match[1].trim().replace(/^["']|["']$/g, '');
  }
  return 'mailto:notifications@sprouttrack.app';
}

function updateEnvFile(envContent: string, keys: VapidKeys, subject: string): string {
  let updated = envContent;

  // Remove existing VAPID keys if present
  updated = updated.replace(/^VAPID_PUBLIC_KEY=.*$/m, '');
  updated = updated.replace(/^VAPID_PRIVATE_KEY=.*$/m, '');
  updated = updated.replace(/^VAPID_SUBJECT=.*$/m, '');

  // Add new VAPID configuration
  const vapidConfig = `
# VAPID keys for Web Push notifications
VAPID_PUBLIC_KEY="${keys.publicKey}"
VAPID_PRIVATE_KEY="${keys.privateKey}"
VAPID_SUBJECT="${subject}"
`;

  // Append to file (trim to avoid extra newlines)
  updated = updated.trim();
  if (updated && !updated.endsWith('\n')) {
    updated += '\n';
  }
  updated += vapidConfig.trim();

  return updated;
}

async function main() {
  console.log('Checking for VAPID keys...\n');

  const envContent = readEnvFile();
  const subject = getVapidSubject(envContent);

  if (hasVapidKeys(envContent)) {
    console.log('✅ VAPID keys already exist in .env file');
    console.log(`   Subject: ${subject}`);
    console.log('\nIf you need to regenerate keys, remove VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY from .env and run this script again.');
    return;
  }

  console.log('Generating new VAPID keypair...');
  const keys = generateVapidKeys();

  console.log('\n📋 Generated VAPID Keys:');
  console.log(`   Public Key:  ${keys.publicKey}`);
  console.log(`   Private Key: ${keys.privateKey.substring(0, 20)}...`);
  console.log(`   Subject:     ${subject}`);

  if (fs.existsSync(ENV_FILE)) {
    console.log('\nUpdating .env file...');
    const updated = updateEnvFile(envContent, keys, subject);
    writeEnvFile(updated);
    console.log('\n✅ VAPID keys have been added to your .env file');
  } else {
    console.log('\n⚠️  .env file not found. Please add these to your .env file:');
    console.log('\n# VAPID keys for Web Push notifications');
    console.log(`VAPID_PUBLIC_KEY="${keys.publicKey}"`);
    console.log(`VAPID_PRIVATE_KEY="${keys.privateKey}"`);
    console.log(`VAPID_SUBJECT="${subject}"`);
  }

  // Check for NOTIFICATION_CRON_SECRET
  if (!envContent.includes('NOTIFICATION_CRON_SECRET=')) {
    console.log('\n⚠️  Note: NOTIFICATION_CRON_SECRET is not set in .env');
    console.log('   You may want to generate a secret for the cron endpoint:');
    console.log('   NOTIFICATION_CRON_SECRET="<generate-a-random-secret>"');
  }
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
