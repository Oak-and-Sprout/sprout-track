import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const SCRIPT = path.resolve(__dirname, '../scripts/ensure-env-defaults.js');

// Issue #171: the persisted /app/env/.env (seeded with sqlite defaults baked into
// the image) clobbered compose-provided PostgreSQL settings. The script must let
// the runtime environment win for DATABASE_PROVIDER / DATABASE_URL /
// LOG_DATABASE_URL, while never treating the image's baked placeholder URLs as
// user intent.

let dir: string;
const envPath = () => path.join(dir, '.env');

// Run the script with ONLY the given env vars layered over a minimal base
// (PATH is needed to find node).
function run(env: Record<string, string> = {}) {
  execFileSync(process.execPath, [SCRIPT, 'docker', envPath()], {
    env: { PATH: process.env.PATH || '', NODE_ENV: 'test', ...env },
  });
  return readFileSync(envPath(), 'utf8');
}

function parse(content: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) vars[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return vars;
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'ensure-env-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('ensure-env-defaults.js runtime env precedence (issue #171)', () => {
  it('writes sqlite defaults into a fresh file when no runtime env is provided', () => {
    const vars = parse(run());
    expect(vars.DATABASE_PROVIDER).toBe('sqlite');
    expect(vars.DATABASE_URL).toBe('file:/db/baby-tracker.db');
    expect(vars.LOG_DATABASE_URL).toBe('file:/db/baby-tracker-logs.db');
  });

  it('uses runtime PostgreSQL settings for a fresh file (pulled sqlite image + postgres compose)', () => {
    const vars = parse(run({
      DATABASE_PROVIDER: 'postgresql',
      DATABASE_URL: 'postgresql://user:pass@db:5432/sprout_track',
      LOG_DATABASE_URL: 'postgresql://user:pass@db:5432/sprout_track_logs',
    }));
    expect(vars.DATABASE_PROVIDER).toBe('postgresql');
    expect(vars.DATABASE_URL).toBe('postgresql://user:pass@db:5432/sprout_track');
    expect(vars.LOG_DATABASE_URL).toBe('postgresql://user:pass@db:5432/sprout_track_logs');
  });

  it('updates a stale sqlite env file in place when runtime env says postgresql (upgrade path)', () => {
    // Simulate the env volume seeded by an older sqlite image
    writeFileSync(envPath(), [
      '# Environment variables for Docker container',
      'DATABASE_PROVIDER="sqlite"',
      'DATABASE_URL="file:/db/baby-tracker.db"',
      'LOG_DATABASE_URL="file:/db/baby-tracker-logs.db"',
      'JWT_SECRET="existing-secret"',
      '',
    ].join('\n'));

    const vars = parse(run({
      DATABASE_PROVIDER: 'postgresql',
      DATABASE_URL: 'postgresql://user:pass@db:5432/sprout_track',
      LOG_DATABASE_URL: 'postgresql://user:pass@db:5432/sprout_track_logs',
    }));
    expect(vars.DATABASE_PROVIDER).toBe('postgresql');
    expect(vars.DATABASE_URL).toBe('postgresql://user:pass@db:5432/sprout_track');
    expect(vars.LOG_DATABASE_URL).toBe('postgresql://user:pass@db:5432/sprout_track_logs');
    // Existing secrets must never be regenerated
    expect(vars.JWT_SECRET).toBe('existing-secret');
  });

  it('never lets the baked image placeholder URL override a customized file value', () => {
    writeFileSync(envPath(), 'DATABASE_URL="file:/db/custom-location.db"\n');

    // The image always has ENV DATABASE_URL="file:/db/baby-tracker.db" — a
    // placeholder, not user intent
    const vars = parse(run({ DATABASE_URL: 'file:/db/baby-tracker.db' }));
    expect(vars.DATABASE_URL).toBe('file:/db/custom-location.db');
  });

  it('leaves matching values untouched (idempotent restart)', () => {
    const first = run({
      DATABASE_PROVIDER: 'postgresql',
      DATABASE_URL: 'postgresql://user:pass@db:5432/sprout_track',
      LOG_DATABASE_URL: 'postgresql://user:pass@db:5432/sprout_track_logs',
    });
    const second = run({
      DATABASE_PROVIDER: 'postgresql',
      DATABASE_URL: 'postgresql://user:pass@db:5432/sprout_track',
      LOG_DATABASE_URL: 'postgresql://user:pass@db:5432/sprout_track_logs',
    });
    expect(second).toBe(first);
  });

  it('generates secrets on first run and preserves them on later runs', () => {
    const first = parse(run());
    expect(first.ENC_HASH).toMatch(/^[0-9a-f]{64}$/);
    expect(first.JWT_SECRET).toMatch(/^[0-9a-f]{64}$/);

    const second = parse(run());
    expect(second.ENC_HASH).toBe(first.ENC_HASH);
    expect(second.JWT_SECRET).toBe(first.JWT_SECRET);
  });

  it('creates the file when missing', () => {
    expect(existsSync(envPath())).toBe(false);
    run();
    expect(existsSync(envPath())).toBe(true);
  });
});
