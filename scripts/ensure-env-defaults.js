#!/usr/bin/env node

/**
 * Ensure Environment Defaults
 *
 * Single source of truth for all environment variable defaults.
 * Creates the .env file if missing, adds any missing vars with correct defaults,
 * generates secrets (ENC_HASH, JWT_SECRET, NOTIFICATION_CRON_SECRET) when needed,
 * and never overwrites existing values.
 *
 * Usage:
 *   node scripts/ensure-env-defaults.js <mode> <env-file-path>
 *
 *   mode: "docker" or "local" (defaults to "docker")
 *   env-file-path: path to .env file (defaults to "/app/env/.env" for docker, "./.env" for local)
 *
 * Examples:
 *   npm run env:ensure -- docker /app/env/.env
 *   npm run env:ensure -- local ./.env
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Environment variable definitions — the single source of truth
// ---------------------------------------------------------------------------
const ENV_DEFAULTS = [
  {
    key: 'DATABASE_PROVIDER',
    default: 'sqlite',
    runtimeEnvWins: true,
    comment: 'Database provider: "sqlite" or "postgresql"'
  },
  {
    key: 'DATABASE_URL',
    dockerDefault: 'file:/db/baby-tracker.db',
    localDefault: 'file:../db/baby-tracker.db',
    runtimeEnvWins: true,
    // The Docker image bakes this value into ENV as a placeholder; it is not
    // user intent, so it never overrides a value persisted in the env file.
    ignoreRuntimeValues: ['file:/db/baby-tracker.db'],
    comment: 'Main database path',
    quoted: true
  },
  {
    key: 'LOG_DATABASE_URL',
    dockerDefault: 'file:/db/baby-tracker-logs.db',
    localDefault: 'file:../db/api-logs.db',
    runtimeEnvWins: true,
    ignoreRuntimeValues: ['file:/db/baby-tracker-logs.db'],
    comment: 'Log database path',
    quoted: true
  },
  {
    key: 'ENABLE_LOG',
    default: 'false',
    comment: 'Enable API request/response logging',
    quoted: true
  },
  {
    key: 'NODE_ENV',
    dockerDefault: 'production',
    localDefault: 'development',
    comment: 'Node environment'
  },
  {
    key: 'PORT',
    default: '3000',
    comment: 'Application port'
  },
  {
    key: 'TZ',
    default: 'UTC',
    comment: 'Timezone'
  },
  {
    key: 'AUTH_LIFE',
    default: '86400',
    comment: 'Access token lifetime in seconds (default 24 hours)'
  },
  {
    key: 'REFRESH_TOKEN_LIFE',
    default: '604800',
    comment: 'Refresh token lifetime in seconds (default 7 days). Sliding window: resets on each refresh.'
  },
  {
    key: 'IDLE_TIME',
    default: '604800',
    comment: 'Idle timeout in seconds (aligned with REFRESH_TOKEN_LIFE)',
    alignWith: 'REFRESH_TOKEN_LIFE'
  },
  {
    key: 'APP_VERSION',
    default: '1.6.3',
    comment: 'Application version'
  },
  {
    key: 'COOKIE_SECURE',
    default: 'false',
    comment: 'Whether to set cookies as secure (requires HTTPS)'
  },
  {
    key: 'ENABLE_NOTIFICATIONS',
    dockerDefault: 'true',
    localDefault: 'true',
    comment: 'Enable push notification infrastructure'
  },
  {
    key: 'ENC_HASH',
    generate: true,
    protected: true,
    comment: 'Encryption hash for data encryption (auto-generated, do not change)',
    quoted: true
  },
  {
    key: 'JWT_SECRET',
    generate: true,
    protected: true,
    comment: 'Secret for signing JWT auth tokens (auto-generated, do not change or share)',
    quoted: true
  },
  {
    key: 'NOTIFICATION_CRON_SECRET',
    generate: true,
    protected: true,
    conditionalOn: 'ENABLE_NOTIFICATIONS',
    comment: 'Secret for securing the notification cron endpoint (auto-generated)',
    quoted: true
  }
];

// ---------------------------------------------------------------------------
// .env file parser
// ---------------------------------------------------------------------------
function parseEnvFile(content) {
  const vars = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) continue;

    const key = trimmed.substring(0, equalIndex).trim();
    let value = trimmed.substring(equalIndex + 1).trim();

    if (!key) continue;

    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    vars[key] = value;
  }

  return vars;
}

// ---------------------------------------------------------------------------
// Main logic
// ---------------------------------------------------------------------------
function main() {
  const mode = process.argv[2] || 'docker';
  const defaultPath = mode === 'docker' ? '/app/env/.env' : './.env';
  const envFilePath = process.argv[3] || defaultPath;

  console.log(`Ensuring environment defaults (mode: ${mode}, file: ${envFilePath})...`);

  // Ensure parent directory exists
  const dir = path.dirname(envFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`  Created directory: ${dir}`);
  }

  // Read existing .env or start with empty
  let content = '';
  let existingVars = {};
  if (fs.existsSync(envFilePath)) {
    content = fs.readFileSync(envFilePath, 'utf-8');
    existingVars = parseEnvFile(content);
    console.log(`  Found existing .env with ${Object.keys(existingVars).length} variables`);
  } else {
    console.log('  No existing .env found, creating new file');
    content = '# Environment variables for Sprout Track\n';
  }

  // Track what we add
  const added = [];
  const updated = [];
  const skipped = [];

  // Build lines to append
  let appendLines = [];

  for (const def of ENV_DEFAULTS) {
    const existingValue = existingVars[def.key];
    const hasValue = existingValue !== undefined && existingValue !== '';

    // Runtime container env takes precedence for DB settings (issue #171):
    // a stale persisted env file must not clobber compose-provided values.
    let runtimeValue;
    if (def.runtimeEnvWins) {
      const candidate = process.env[def.key];
      const isPlaceholder = def.ignoreRuntimeValues && def.ignoreRuntimeValues.includes(candidate);
      if (candidate !== undefined && candidate !== '' && !isPlaceholder) {
        runtimeValue = candidate;
      }
    }

    // Already exists with a value: update in place if runtime env disagrees
    if (hasValue) {
      if (runtimeValue !== undefined && runtimeValue !== existingValue) {
        const formattedValue = def.quoted ? `"${runtimeValue}"` : runtimeValue;
        const regex = new RegExp(`^${def.key}=.*$`, 'm');
        content = content.replace(regex, `${def.key}=${formattedValue}`);
        existingVars[def.key] = runtimeValue;
        updated.push(def.key);
        console.log(`  Updated ${def.key} from runtime environment`);
      } else {
        skipped.push(def.key);
      }
      continue;
    }

    // For conditional vars, check if the condition is met
    if (def.conditionalOn) {
      const conditionValue = existingVars[def.conditionalOn] || process.env[def.conditionalOn];
      if (conditionValue !== 'true') {
        skipped.push(`${def.key} (${def.conditionalOn} is not true)`);
        continue;
      }
    }

    // Determine the value
    let value;
    if (runtimeValue !== undefined) {
      value = runtimeValue;
      console.log(`  Using runtime environment value for ${def.key}`);
    } else if (def.generate) {
      value = crypto.randomBytes(32).toString('hex');
      console.log(`  Generated ${def.key}`);
    } else {
      // Use mode-specific default, falling back to shared default
      if (mode === 'docker' && def.dockerDefault !== undefined) {
        value = def.dockerDefault;
      } else if (mode === 'local' && def.localDefault !== undefined) {
        value = def.localDefault;
      } else {
        value = def.default;
      }
    }

    if (value === undefined) {
      console.warn(`  Warning: No default value for ${def.key}, skipping`);
      continue;
    }

    // Format the line
    const formattedValue = def.quoted ? `"${value}"` : value;
    if (def.comment) {
      appendLines.push(`# ${def.comment}`);
    }
    appendLines.push(`${def.key}=${formattedValue}`);
    added.push(def.key);

    // Track the added value so later conditional checks can see it
    // (e.g., NOTIFICATION_CRON_SECRET depends on ENABLE_NOTIFICATIONS being set)
    existingVars[def.key] = value;
  }

  // Append new vars if any
  if (appendLines.length > 0) {
    // Ensure there's a newline before our additions
    if (content.length > 0 && !content.endsWith('\n')) {
      content += '\n';
    }
    content += '\n' + appendLines.join('\n') + '\n';
  }

  // Re-parse to get the full set of vars for alignment
  const updatedVars = parseEnvFile(content);

  // Align IDLE_TIME with REFRESH_TOKEN_LIFE if needed
  for (const def of ENV_DEFAULTS) {
    if (def.alignWith && updatedVars[def.alignWith]) {
      const targetValue = updatedVars[def.alignWith];
      const currentValue = updatedVars[def.key];
      if (currentValue !== targetValue) {
        // Update the value in the file content
        const regex = new RegExp(`^${def.key}=.*$`, 'm');
        if (regex.test(content)) {
          content = content.replace(regex, `${def.key}=${targetValue}`);
          console.log(`  Aligned ${def.key} with ${def.alignWith} (${targetValue})`);
        }
      }
    }
  }

  // Write the file
  fs.writeFileSync(envFilePath, content, 'utf-8');

  // Summary
  if (added.length > 0) {
    console.log(`  Added ${added.length} variable(s): ${added.join(', ')}`);
  }
  if (updated.length > 0) {
    console.log(`  Updated ${updated.length} variable(s) from runtime environment: ${updated.join(', ')}`);
  }
  if (added.length === 0 && updated.length === 0) {
    console.log('  All environment variables are present');
  }

  console.log('Environment defaults check complete.');
}

main();
