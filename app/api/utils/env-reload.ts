import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Parses a .env file content and returns key-value pairs
 * Handles comments, empty lines, quoted values, and unquoted values
 */
export function parseEnvFile(content: string): Record<string, string> {
  const envVars: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    // Trim the line
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Find the first = sign
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) {
      // No = sign, skip this line
      continue;
    }

    // Extract key and value
    const key = trimmed.substring(0, equalIndex).trim();
    let value = trimmed.substring(equalIndex + 1).trim();

    // Skip if key is empty
    if (!key) {
      continue;
    }

    // Handle quoted values
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      // Remove surrounding quotes
      value = value.slice(1, -1);
      // Unescape quotes within the value
      value = value.replace(/\\"/g, '"').replace(/\\'/g, "'");
    }

    envVars[key] = value;
  }

  return envVars;
}

/**
 * Replaces or appends an environment variable in .env file content.
 * If the key exists, its value is updated in-place. If not, it's appended.
 */
export function replaceEnvVar(content: string, key: string, value: string): string {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  const needsQuotes = value.includes(' ') || value.includes('://');
  const newLine = needsQuotes ? `${key}="${value}"` : `${key}=${value}`;
  if (regex.test(content)) {
    return content.replace(regex, newLine);
  }
  const suffix = content.endsWith('\n') ? '' : '\n';
  return content + suffix + newLine + '\n';
}

/**
 * Ensures all required environment variables exist in the .env file.
 * Adds missing vars with correct defaults without overwriting existing values.
 * Uses the centralized ensure-env-defaults.js script (single source of truth).
 */
export function ensureEnvDefaults(envFilePath?: string): boolean {
  try {
    const envPath = envFilePath || path.resolve('./.env');
    const mode = process.env.NODE_ENV === 'production' ? 'docker' : 'local';
    const scriptPath = path.resolve('./scripts/ensure-env-defaults.js');
    execSync(`node ${scriptPath} ${mode} ${envPath}`, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error('Error ensuring env defaults:', error);
    return false;
  }
}

export function reloadEnvFile(envFilePath?: string): boolean {
  try {
    const envPath = envFilePath || path.resolve('./.env');

    // Check if file exists
    if (!fs.existsSync(envPath)) {
      console.warn(`Environment file not found at ${envPath}, skipping reload`);
      return false;
    }

    // Read the .env file
    const envContent = fs.readFileSync(envPath, 'utf-8');

    // Parse the file
    const envVars = parseEnvFile(envContent);

    // Update process.env with the new values
    let reloadedCount = 0;
    for (const [key, value] of Object.entries(envVars)) {
      process.env[key] = value;
      reloadedCount++;
    }

    console.log(`✓ Reloaded ${reloadedCount} environment variables from ${envPath}`);
    return true;
  } catch (error) {
    console.error('Error reloading environment file:', error);
    return false;
  }
}

