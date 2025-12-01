import fs from 'fs';
import path from 'path';

/**
 * Parses a .env file content and returns key-value pairs
 * Handles comments, empty lines, quoted values, and unquoted values
 */
function parseEnvFile(content: string): Record<string, string> {
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
 * Reloads environment variables from the .env file into process.env
 * This is useful after restoring a backup that includes a new .env file
 * 
 * @param envFilePath Optional path to the .env file. Defaults to './.env'
 * @returns True if the reload was successful, false otherwise
 */
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

