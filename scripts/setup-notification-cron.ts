#!/usr/bin/env tsx

/**
 * Setup script for notification cron job
 * Installs or verifies the cron job that runs every minute to check timer expirations
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const CRON_COMMENT = '# Sprout Track Notification Cron';
const CRON_SCHEDULE = '* * * * *'; // Every minute

function getProjectRoot(): string {
  // Get the directory where this script is located
  const scriptDir = __dirname;
  // Project root is the parent of scripts directory
  return path.resolve(scriptDir, '..');
}

function getCronScriptPath(): string {
  const projectRoot = getProjectRoot();
  return path.join(projectRoot, 'scripts', 'run-notification-cron.sh');
}

function getLogPath(): string {
  const projectRoot = getProjectRoot();
  const logsDir = path.join(projectRoot, 'logs');
  
  // Create logs directory if it doesn't exist
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  return path.join(logsDir, 'notification-cron.log');
}

function getAppUrl(): string {
  // Try APP_URL first
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }
  
  // Try ROOT_DOMAIN
  if (process.env.ROOT_DOMAIN) {
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    return `${protocol}://${process.env.ROOT_DOMAIN}`;
  }
  
  // Default to localhost for development
  return 'http://localhost:3000';
}

function getCurrentCrontab(): string {
  try {
    return execSync('crontab -l', { encoding: 'utf-8' });
  } catch (error: any) {
    // If crontab doesn't exist, execSync throws an error
    // This is expected for first-time setup
    if (error.status === 1 && error.message.includes('no crontab')) {
      return '';
    }
    throw error;
  }
}

function cronJobExists(crontab: string): boolean {
  return crontab.includes(CRON_COMMENT);
}

function addCronJob(crontab: string): string {
  const cronScriptPath = getCronScriptPath();
  const logPath = getLogPath();
  
  // Make sure the script is executable
  try {
    fs.chmodSync(cronScriptPath, 0o755);
  } catch (error) {
    console.warn(`Warning: Could not make ${cronScriptPath} executable:`, error);
  }
  
  const cronLine = `${CRON_SCHEDULE} ${cronScriptPath} >> ${logPath} 2>&1`;
  
  // Add newline if crontab is not empty
  const separator = crontab.trim() ? '\n' : '';
  
  return `${crontab}${separator}${CRON_COMMENT}\n${cronLine}\n`;
}

function installCrontab(crontab: string): void {
  execSync('crontab -', {
    input: crontab,
    encoding: 'utf-8',
  });
}

function checkCronService(): boolean {
  try {
    // Check if cron service is running (works on Linux)
    execSync('pgrep cron > /dev/null 2>&1', { stdio: 'ignore' });
    return true;
  } catch {
    try {
      // Check for crond (alternative name on some systems)
      execSync('pgrep crond > /dev/null 2>&1', { stdio: 'ignore' });
      return true;
    } catch {
      // On macOS, cron runs differently - just warn
      if (process.platform === 'darwin') {
        console.warn('Warning: Could not verify cron service. On macOS, cron may still work.');
        return true; // Assume it works
      }
      return false;
    }
  }
}

function main(): void {
  console.log('Setting up notification cron job...');
  
  // Check if notifications are enabled
  if (process.env.ENABLE_NOTIFICATIONS !== 'true') {
    console.log('Notifications are disabled (ENABLE_NOTIFICATIONS !== "true"). Skipping cron setup.');
    return;
  }
  
  // Verify required environment variables
  if (!process.env.NOTIFICATION_CRON_SECRET) {
    console.error('Error: NOTIFICATION_CRON_SECRET is not set. Please set it in your .env file.');
    process.exit(1);
  }
  
  // Verify cron script exists
  const cronScriptPath = getCronScriptPath();
  if (!fs.existsSync(cronScriptPath)) {
    console.error(`Error: Cron script not found at ${cronScriptPath}`);
    console.error('Please create the script first.');
    process.exit(1);
  }
  
  // Get current crontab
  let crontab: string;
  try {
    crontab = getCurrentCrontab();
  } catch (error: any) {
    console.error('Error reading crontab:', error.message);
    process.exit(1);
  }
  
  // Check if cron job already exists
  if (cronJobExists(crontab)) {
    console.log('Notification cron job already exists in crontab.');
    console.log('To update it, remove the existing entry and run this script again.');
    return;
  }
  
  // Add cron job
  console.log('Adding notification cron job to crontab...');
  const updatedCrontab = addCronJob(crontab);
  
  // Install updated crontab
  try {
    installCrontab(updatedCrontab);
    console.log('✓ Cron job installed successfully!');
  } catch (error: any) {
    console.error('Error installing crontab:', error.message);
    process.exit(1);
  }
  
  // Check cron service
  if (!checkCronService()) {
    console.warn('Warning: Cron service does not appear to be running.');
    console.warn('Please ensure cron is running for the notification job to execute.');
  } else {
    console.log('✓ Cron service is running.');
  }
  
  // Display information
  const appUrl = getAppUrl();
  const logPath = getLogPath();
  console.log('\nCron job details:');
  console.log(`  Schedule: ${CRON_SCHEDULE} (every minute)`);
  console.log(`  Script: ${cronScriptPath}`);
  console.log(`  Log file: ${logPath}`);
  console.log(`  API endpoint: ${appUrl}/api/notifications/cron`);
  console.log('\nThe cron job will run every minute to check for timer expirations.');
  console.log('Check the log file for execution details.');
}

// Run if executed directly
if (require.main === module) {
  main();
}
