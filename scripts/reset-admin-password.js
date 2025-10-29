#!/usr/bin/env node

/**
 * Admin Password Reset Script
 *
 * This script allows you to reset the admin password in the AppConfig table.
 * It uses the encryption utilities to securely store the password.
 *
 * Usage: node scripts/reset-admin-password.js
 */

const { PrismaClient } = require('@prisma/client');
const readline = require('readline');
const crypto = require('crypto');
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

// Encryption utilities (copied from app/api/utils/encryption.ts)
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

function getEncryptionKey() {
  const encHash = process.env.ENC_HASH;
  if (!encHash) {
    throw new Error('ENC_HASH environment variable is not set');
  }

  // Use PBKDF2 to derive a key from the ENC_HASH
  // This ensures we always get a 32-byte key regardless of ENC_HASH length
  const salt = Buffer.from('baby-tracker-salt'); // Static salt for consistency
  return crypto.pbkdf2Sync(encHash, salt, 100000, KEY_LENGTH, 'sha256');
}

function encrypt(text) {
  try {
    if (!text) {
      throw new Error('Text to encrypt cannot be empty');
    }

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    cipher.setAAD(salt);

    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const tag = cipher.getAuthTag();

    const combined = `${iv.toString('base64')}:${salt.toString('base64')}:${tag.toString('base64')}:${encrypted}`;

    return combined;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}


const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});


function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function resetAdminPassword() {
  try {
    console.log('Admin Password Reset Tool');
    console.log('============================\n');

    // Check if ENC_HASH is set
    if (!process.env.ENC_HASH) {
      console.error('Error: ENC_HASH environment variable is not set.');
      console.error('Please ensure your .env file contains the ENC_HASH value.');
      process.exit(1);
    }

    // Get current app config
    const appConfig = await prisma.appConfig.findFirst();

    if (!appConfig) {
      console.log('No app configuration found.');
      console.log('This script only updates existing configurations. Please ensure the application has been properly initialized.');
      process.exit(1);
    }

    console.log('Current app configuration found.');

    console.log('\nPlease enter a new admin password:');

    let password = '';
    let confirmPassword = '';
    let passwordsMatch = false;

    while (!passwordsMatch) {
      password = await question('New password: ');

      if (password.length < 6) {
        console.log('Password must be at least 6 characters long. Please try again.\n');
        continue;
      }

      confirmPassword = await question('Confirm password: ');

      if (password === confirmPassword) {
        passwordsMatch = true;
      } else {
        console.log('Passwords do not match. Please try again.\n');
      }
    }

    // Encrypt and update the password
    const encryptedPassword = encrypt(password);

    await prisma.appConfig.update({
      where: { id: appConfig.id },
      data: { adminPass: encryptedPassword }
    });

    console.log('\nAdmin password has been successfully reset!');
    console.log('Password has been encrypted and stored securely.');

  } catch (error) {
    console.error('\nError resetting admin password:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
  console.log('\n\nOperation cancelled by user.');
  await prisma.$disconnect();
  rl.close();
  process.exit(0);
});

// Run the script
resetAdminPassword().catch(async (error) => {
  console.error('Unexpected error:', error);
  await prisma.$disconnect();
  rl.close();
  process.exit(1);
});