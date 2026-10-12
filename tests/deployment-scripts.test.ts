import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, copyFileSync, chmodSync, rmSync } from 'fs';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import path from 'path';

/**
 * Guards for the bare-metal deployment chain (deployment.sh -> update.sh -> service.sh),
 * which st-guardian runs non-interactively via POST /update.
 */
const updateSh = readFileSync(path.join(process.cwd(), 'scripts/update.sh'), 'utf-8');

describe('update.sh', () => {
  it('applies migrations with prisma migrate deploy, never migrate dev', () => {
    // migrate dev offers to reset (wipe) the DB on drift in a terminal and refuses to run
    // non-interactively, which is how st-guardian invokes this script.
    expect(updateSh).toContain('npx prisma migrate deploy');
    expect(updateSh).not.toMatch(/prisma migrate dev|npm run prisma:migrate\b/);
  });

  it('only pops a stash that this run created', () => {
    // `git stash` exits 0 with "No local changes to save"; popping on that would apply an
    // unrelated older stash on top of the freshly pulled code.
    expect(updateSh).not.toContain('STASH_RESULT');
    expect(updateSh).toMatch(/git stash list \| wc -l/);
    for (const pop of updateSh.matchAll(/git stash pop/g)) {
      const before = updateSh.slice(Math.max(0, pop.index! - 120), pop.index);
      expect(before).toContain('STASHED');
    }
  });

  it('does not start the service after a failed build', () => {
    const buildIdx = updateSh.indexOf('npm run build');
    const failIdx = updateSh.indexOf('if [ $BUILD_STATUS -ne 0 ]', buildIdx);
    const startIdx = updateSh.indexOf('"$SCRIPT_DIR/service.sh" start', buildIdx);
    expect(failIdx).toBeGreaterThan(buildIdx);
    // the build-failure exit comes before the post-update service start
    expect(failIdx).toBeLessThan(startIdx);
    expect(updateSh.slice(failIdx, startIdx)).toMatch(/exit 1/);
  });
});

describe('deployment scripts are executable in git', () => {
  // deployment.sh/backup.sh/update.sh call each other directly ("$SCRIPT_DIR/service.sh"), so a
  // script checked out as 0644 fails with "Permission denied" (servers with core.fileMode=false
  // can't rely on a local chmod surviving a pull).
  it('every scripts/*.sh is stored with mode 100755', () => {
    const out = spawnSync('git', ['ls-files', '-s', 'scripts/*.sh'], { encoding: 'utf-8' }).stdout;
    const notExecutable = out.trim().split('\n')
      .map((line) => line.split(/\s+/))
      .filter(([mode]) => mode !== '100755')
      .map((parts) => parts[3]);
    expect(notExecutable).toEqual([]);
  });
});

describe('service.sh exit codes', () => {
  let root: string;
  const run = (action: string, sudoExit: number) =>
    spawnSync('bash', [path.join(root, 'scripts/service.sh'), action], {
      env: { ...process.env, PATH: `${path.join(root, 'bin')}:${process.env.PATH}`, SUDO_EXIT: String(sudoExit) },
      encoding: 'utf-8',
    });

  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), 'service-sh-'));
    mkdirSync(path.join(root, 'scripts'));
    mkdirSync(path.join(root, 'bin'));
    copyFileSync(path.join(process.cwd(), 'scripts/service.sh'), path.join(root, 'scripts/service.sh'));
    writeFileSync(path.join(root, '.env'), 'SERVICE_NAME="sprout-track-test"\n');
    // stub sudo: exits with $SUDO_EXIT instead of touching systemd
    writeFileSync(path.join(root, 'bin/sudo'), '#!/bin/bash\nexit "${SUDO_EXIT:-0}"\n');
    chmodSync(path.join(root, 'bin/sudo'), 0o755);
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  for (const action of ['start', 'stop', 'restart']) {
    it(`${action} exits non-zero when systemctl fails`, () => {
      const res = run(action, 5);
      expect(res.status).not.toBe(0);
      expect(res.stdout).not.toMatch(/successfully/);
    });

    it(`${action} exits 0 when systemctl succeeds`, () => {
      expect(run(action, 0).status).toBe(0);
    });
  }
});
