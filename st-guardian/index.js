#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const httpProxy = require('http-proxy');
const Database = require('better-sqlite3');

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  guardianPort: parseInt(process.env.ST_GUARDIAN_PORT || '3001', 10),
  appPort: parseInt(process.env.ST_APP_PORT || '3000', 10),
  guardianKey: process.env.ST_GUARDIAN_KEY || '',
  healthInterval: parseInt(process.env.ST_HEALTH_INTERVAL || '30000', 10),
  scriptsDir: path.resolve(process.env.ST_SCRIPTS_DIR || './scripts'),
  appDir: path.resolve(process.env.ST_APP_DIR || '.'),
  logBuffer: parseInt(process.env.ST_LOG_BUFFER || '500', 10),
};

const GUARDIAN_VERSION = '1.0.0';
const DOCKER_MODE = fs.existsSync('/.dockerenv');

// Read app version from package.json
let appVersion = 'unknown';
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(CONFIG.appDir, 'package.json'), 'utf8'));
  appVersion = pkg.version || 'unknown';
} catch (e) {
  log('Warning: Could not read app package.json version');
}

// Read SERVICE_NAME from app .env (same parsing as service.sh)
let serviceName = '';
try {
  const envContent = fs.readFileSync(path.join(CONFIG.appDir, '.env'), 'utf8');
  const match = envContent.match(/SERVICE_NAME="([^"]+)"/);
  if (match) serviceName = match[1];
} catch (e) {
  // Will be empty if .env doesn't exist
}

// =============================================================================
// Database
// =============================================================================

const db = new Database(path.join(__dirname, 'guardian.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS health_pings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    status INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pings_timestamp ON health_pings(timestamp);
`);

// Prune data older than 90 days on startup
db.prepare(`DELETE FROM health_pings WHERE timestamp < datetime('now', '-90 days')`).run();

const insertPing = db.prepare(`INSERT INTO health_pings (timestamp, status) VALUES (datetime('now'), ?)`);

// Cache the logo image at startup
let logoBuffer = null;
try {
  logoBuffer = fs.readFileSync(path.join(CONFIG.appDir, 'public', 'sprout-256.png'));
} catch (e) {
  // Logo won't be available
}

// =============================================================================
// State
// =============================================================================

const state = {
  maintenance: false,
  maintenanceMessage: null,
  appUp: true,
  consecutiveFailures: 0,
  restartAttempts: [], // timestamps
  updateJob: null,
  startTime: Date.now(),
};

// =============================================================================
// Logging
// =============================================================================

function log(msg) {
  console.log(`[guardian] ${new Date().toISOString()} ${msg}`);
}

// =============================================================================
// Authentication
// =============================================================================

function parseUrl(req) {
  return new URL(req.url, `http://localhost:${CONFIG.guardianPort}`);
}

function authenticate(req) {
  if (!CONFIG.guardianKey) return false;
  const url = parseUrl(req);
  const keyFromQuery = url.searchParams.get('key');
  const keyFromHeader = req.headers['x-guardian-key'];
  return keyFromQuery === CONFIG.guardianKey || keyFromHeader === CONFIG.guardianKey;
}

// =============================================================================
// Body Parser
// =============================================================================

function parseBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

// =============================================================================
// Response Helpers
// =============================================================================

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
  });
  res.end(html);
}

// =============================================================================
// Shell Helpers
// =============================================================================

function execScript(scriptPath, args = []) {
  return new Promise((resolve) => {
    const proc = spawn('bash', [scriptPath, ...args], {
      cwd: CONFIG.appDir,
      env: { ...process.env, PATH: process.env.PATH },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (exitCode) => {
      resolve({ exitCode: exitCode || 0, stdout, stderr });
    });

    proc.on('error', (err) => {
      resolve({ exitCode: 1, stdout, stderr: stderr + '\n' + err.message });
    });
  });
}

function readLogs(lines) {
  return new Promise((resolve) => {
    if (!serviceName) {
      return resolve(['SERVICE_NAME not configured — cannot read logs']);
    }

    const proc = spawn('journalctl', [
      '-u', serviceName,
      '--no-pager',
      '-n', String(lines),
      '--output=cat',
    ]);

    let output = '';
    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.stderr.on('data', (data) => { output += data.toString(); });

    proc.on('close', () => {
      resolve(output.split('\n').filter(Boolean));
    });

    proc.on('error', (err) => {
      resolve([`Error reading logs: ${err.message}`]);
    });
  });
}

// =============================================================================
// Health Check
// =============================================================================

function healthCheck() {
  return new Promise((resolve) => {
    const req = http.get(
      `http://127.0.0.1:${CONFIG.appPort}/`,
      { timeout: 5000 },
      (res) => {
        res.resume(); // consume response
        resolve(res.statusCode < 500);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

let healthIntervalId = null;

function startHealthMonitor() {
  if (DOCKER_MODE) {
    // In Docker mode, still monitor health but don't auto-restart
    healthIntervalId = setInterval(async () => {
      const healthy = await healthCheck();
      state.appUp = healthy;
      try { insertPing.run(healthy ? 1 : 0); } catch (e) {}
    }, CONFIG.healthInterval);
    return;
  }

  healthIntervalId = setInterval(async () => {
    const healthy = await healthCheck();
    try { insertPing.run(healthy ? 1 : 0); } catch (e) {}

    if (healthy) {
      state.appUp = true;
      state.consecutiveFailures = 0;
      return;
    }

    state.appUp = false;
    state.consecutiveFailures++;
    log(`Health check failed (${state.consecutiveFailures} consecutive)`);

    // Skip auto-restart during intentional maintenance
    if (state.maintenance) return;

    if (state.consecutiveFailures >= 3) {
      // Check crash-loop protection: 3+ restarts in 5 minutes
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      const recentRestarts = state.restartAttempts.filter((t) => t > fiveMinAgo);

      if (recentRestarts.length >= 3) {
        log('Crash-loop detected: 3+ restarts in 5 minutes. Entering maintenance mode.');
        state.maintenance = true;
        state.maintenanceMessage = 'Sprout Track encountered repeated failures and is awaiting manual intervention.';
        return;
      }

      log('Attempting automatic restart...');
      state.restartAttempts.push(Date.now());

      const result = await execScript(path.join(CONFIG.scriptsDir, 'service.sh'), ['restart']);

      if (result.exitCode === 0) {
        log('Restart succeeded');
        state.consecutiveFailures = 0;
        // Give the app a moment to start, then re-check
        setTimeout(async () => {
          state.appUp = await healthCheck();
        }, 5000);
      } else {
        log(`Restart failed (exit ${result.exitCode}): ${result.stderr}`);
        state.maintenance = true;
        state.maintenanceMessage = 'Sprout Track failed to restart automatically. Manual intervention required.';
      }
    }
  }, CONFIG.healthInterval);
}

// =============================================================================
// Maintenance Page
// =============================================================================

function getMaintenancePage(message) {
  const displayMessage = message || 'Sprout Track is under maintenance and will be back shortly.';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sprout Track - Maintenance</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #14b8a6 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 48px 40px;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
    }
    .logo {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      margin: 0 auto 12px;
    }
    .logo-fallback {
      font-size: 48px;
      margin-bottom: 8px;
    }
    h1 {
      color: #0f766e;
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .message {
      color: #475569;
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 28px;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e2e8f0;
      border-top-color: #0d9488;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .status-text {
      color: #94a3b8;
      font-size: 13px;
    }
    /* Update progress styles */
    .steps { text-align: left; margin: 0 0 24px; }
    .step {
      display: flex;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 14px;
      color: #94a3b8;
      transition: color 0.3s;
    }
    .step:last-child { border-bottom: none; }
    .step.active { color: #0d9488; font-weight: 600; }
    .step.done { color: #10b981; }
    .step.failed { color: #ef4444; }
    .step-icon {
      width: 24px;
      height: 24px;
      margin-right: 12px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .step-icon .mini-spinner {
      width: 18px;
      height: 18px;
      border: 2.5px solid #e2e8f0;
      border-top-color: #0d9488;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    .step-icon svg { width: 18px; height: 18px; }
    .substep {
      font-size: 12px;
      color: #94a3b8;
      margin-left: 36px;
      font-weight: 400;
      padding-top: 2px;
    }
    .step.active .substep { color: #64748b; }
    .result-banner {
      padding: 16px;
      border-radius: 10px;
      margin-bottom: 16px;
      font-size: 14px;
      font-weight: 600;
    }
    .result-banner.success {
      background: #ecfdf5;
      color: #065f46;
    }
    .result-banner.error {
      background: #fef2f2;
      color: #991b1b;
    }
    .error-logs {
      text-align: left;
      background: #1e293b;
      color: #e2e8f0;
      padding: 12px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 11px;
      max-height: 120px;
      overflow-y: auto;
      margin-top: 12px;
      line-height: 1.5;
    }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="card">
    <img class="logo" src="/uptime/logo.png" alt="" onerror="this.style.display='none';document.getElementById('logoFallback').style.display='block'">
    <div class="logo-fallback hidden" id="logoFallback">🌱</div>
    <h1 id="pageTitle">Sprout Track</h1>
    <p class="message" id="pageMessage">${escapeHtml(displayMessage)}</p>

    <!-- Generic maintenance view -->
    <div id="genericView">
      <div class="spinner"></div>
      <p class="status-text" id="genericStatus">Checking availability...</p>
    </div>

    <!-- Update progress view -->
    <div id="updateView" class="hidden">
      <div class="steps" id="stepsList"></div>
      <div id="resultBanner" class="hidden"></div>
      <div id="errorLogs" class="hidden error-logs"></div>
      <p class="status-text" id="updateStatus"></p>
    </div>
  </div>

  <script>
    const STEPS = [
      { key: 'backup', label: 'Creating backup' },
      { key: 'stopping', label: 'Stopping service' },
      { key: 'cleaning', label: 'Cleaning build files' },
      { key: 'config', label: 'Updating configuration' },
      { key: 'updating', label: 'Updating application' },
      { key: 'health-check', label: 'Verifying health' },
    ];

    const checkSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>';
    const xSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    const dotSvg = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.3"/></svg>';

    let isUpdateMode = false;

    function renderSteps(currentStep, substep, status) {
      const container = document.getElementById('stepsList');
      container.innerHTML = '';

      let reachedCurrent = false;
      let pastCurrent = false;

      for (const s of STEPS) {
        const div = document.createElement('div');
        div.className = 'step';

        const iconDiv = document.createElement('div');
        iconDiv.className = 'step-icon';

        const labelSpan = document.createElement('span');
        labelSpan.textContent = s.label;

        if (s.key === currentStep && status === 'running') {
          div.className = 'step active';
          iconDiv.innerHTML = '<div class="mini-spinner"></div>';
          reachedCurrent = true;
          // Add substep
          if (substep) {
            const sub = document.createElement('div');
            sub.className = 'substep';
            sub.textContent = substep;
            div.appendChild(iconDiv);
            div.appendChild(document.createElement('div'));
            div.lastElementChild.appendChild(labelSpan);
            div.lastElementChild.appendChild(sub);
            container.appendChild(div);
            continue;
          }
        } else if (s.key === currentStep && status !== 'running') {
          div.className = status === 'completed' ? 'step done' : 'step failed';
          iconDiv.innerHTML = status === 'completed' ? checkSvg : xSvg;
          reachedCurrent = true;
          pastCurrent = true;
        } else if (!reachedCurrent) {
          // Before current = done
          div.className = 'step done';
          iconDiv.innerHTML = checkSvg;
        } else {
          // After current = pending
          iconDiv.innerHTML = dotSvg;
        }

        div.appendChild(iconDiv);
        div.appendChild(labelSpan);
        container.appendChild(div);
      }
    }

    async function checkForUpdate() {
      try {
        const res = await fetch('/update/status');
        if (res.status === 404) return null;
        if (!res.ok) return null;
        return await res.json();
      } catch { return null; }
    }

    async function init() {
      const job = await checkForUpdate();

      if (job && (job.status === 'running' || (job.status === 'completed' && Date.now() - new Date(job.completedAt).getTime() < 60000) || job.status === 'failed')) {
        isUpdateMode = true;
        document.getElementById('genericView').classList.add('hidden');
        document.getElementById('updateView').classList.remove('hidden');
        document.getElementById('pageTitle').textContent = 'Sprout Track is Updating';
        document.getElementById('pageMessage').textContent = 'Please wait while the application is being updated.';
        pollUpdate();
      } else {
        pollHealth();
      }
    }

    async function pollUpdate() {
      const job = await checkForUpdate();
      if (!job) return setTimeout(pollUpdate, 3000);

      renderSteps(job.step, job.substep, job.status);

      if (job.status === 'completed') {
        const banner = document.getElementById('resultBanner');
        banner.className = 'result-banner success';
        banner.textContent = 'Update complete! Redirecting...';
        banner.classList.remove('hidden');
        document.getElementById('updateStatus').textContent = '';
        setTimeout(() => { window.location.href = '/'; }, 3000);
      } else if (job.status === 'failed') {
        const banner = document.getElementById('resultBanner');
        banner.className = 'result-banner error';
        banner.textContent = 'Update failed. Please check the logs.';
        banner.classList.remove('hidden');
        // Show last few log lines
        if (job.logs && job.logs.length > 0) {
          const logsDiv = document.getElementById('errorLogs');
          logsDiv.textContent = job.logs.slice(-8).join('\\n');
          logsDiv.classList.remove('hidden');
        }
        document.getElementById('updateStatus').textContent = 'Manual intervention may be required.';
      } else {
        document.getElementById('updateStatus').textContent = 'Update in progress...';
        setTimeout(pollUpdate, 3000);
      }
    }

    function pollHealth() {
      setInterval(async () => {
        try {
          const res = await fetch('/health');
          if (res.ok) {
            document.getElementById('genericStatus').textContent = 'Back online! Redirecting...';
            setTimeout(() => { window.location.href = '/'; }, 1000);
          }
        } catch (e) {}
      }, 15000);
    }

    init();
  </script>
</body>
</html>`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// =============================================================================
// Route Handlers
// =============================================================================

function handleStatus(req, res) {
  let status = 'up';
  if (state.maintenance) status = 'maintenance';
  else if (!state.appUp) status = 'down';

  sendJson(res, 200, {
    status,
    version: appVersion,
    guardianVersion: GUARDIAN_VERSION,
    uptime: Math.floor((Date.now() - state.startTime) / 1000),
    lastUpdate: state.updateJob ? state.updateJob.completedAt : null,
    dockerMode: DOCKER_MODE,
  });
}

function handleHealth(req, res) {
  if (state.maintenance || !state.appUp) {
    sendJson(res, 503, { status: 'unhealthy' });
  } else {
    sendJson(res, 200, { status: 'healthy' });
  }
}

async function handleMaintenanceEnable(req, res) {
  const body = await parseBody(req);
  state.maintenance = true;
  state.maintenanceMessage = body.message || null;
  log(`Maintenance mode enabled${body.message ? ': ' + body.message : ''}`);
  sendJson(res, 200, { maintenance: true, message: state.maintenanceMessage });
}

function handleMaintenanceDisable(req, res) {
  state.maintenance = false;
  state.maintenanceMessage = null;
  log('Maintenance mode disabled');
  sendJson(res, 200, { maintenance: false });
}

async function handleUpdate(req, res) {
  if (DOCKER_MODE) {
    return sendJson(res, 403, { error: 'Update not available in Docker mode' });
  }

  if (state.updateJob && state.updateJob.status === 'running') {
    return sendJson(res, 409, { error: 'Update already in progress', pollUrl: '/update/status' });
  }

  // Enable maintenance mode
  state.maintenance = true;
  state.maintenanceMessage = 'Sprout Track is updating...';
  log('Update triggered — entering maintenance mode');

  // Create job
  state.updateJob = {
    status: 'running',
    step: 'starting',
    substep: null,
    logs: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
    exitCode: null,
  };

  // Return immediately
  sendJson(res, 202, { message: 'Update started', pollUrl: '/update/status' });

  // Run deployment async
  const deployScript = path.join(CONFIG.scriptsDir, 'deployment.sh');
  const proc = spawn('bash', [deployScript], {
    cwd: CONFIG.appDir,
    env: { ...process.env, PATH: process.env.PATH },
  });

  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      if (state.updateJob.logs.length >= CONFIG.logBuffer) {
        state.updateJob.logs.shift();
      }
      state.updateJob.logs.push(line);
      log(`[update] ${line}`);

      // Parse step from deployment.sh output
      if (line.includes('Step 1:')) { state.updateJob.step = 'backup'; state.updateJob.substep = null; }
      else if (line.includes('Step 2:')) { state.updateJob.step = 'stopping'; state.updateJob.substep = null; }
      else if (line.includes('Step 3:')) { state.updateJob.step = 'cleaning'; state.updateJob.substep = null; }
      else if (line.includes('Step 4:')) { state.updateJob.step = 'config'; state.updateJob.substep = null; }
      else if (line.includes('Step 5:')) { state.updateJob.step = 'updating'; state.updateJob.substep = null; }
      // Parse sub-steps from update.sh output (during step 5)
      else if (line.includes('Pulling latest changes')) { state.updateJob.substep = 'Pulling latest version'; }
      else if (line.includes('Installing dependencies')) { state.updateJob.substep = 'Installing dependencies'; }
      else if (line.includes('Generating Prisma client')) { state.updateJob.substep = 'Generating database client'; }
      else if (line.includes('Running database migrations')) { state.updateJob.substep = 'Applying database updates'; }
      else if (line.includes('Seeding the database')) { state.updateJob.substep = 'Seeding database with new values'; }
      else if (line.includes('Building the application')) { state.updateJob.substep = 'Building application'; }
    }
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      if (state.updateJob.logs.length >= CONFIG.logBuffer) {
        state.updateJob.logs.shift();
      }
      state.updateJob.logs.push(`[stderr] ${line}`);
    }
  });

  proc.on('close', async (exitCode) => {
    state.updateJob.exitCode = exitCode || 0;
    state.updateJob.completedAt = new Date().toISOString();

    // Re-read app version after update
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(CONFIG.appDir, 'package.json'), 'utf8'));
      appVersion = pkg.version || appVersion;
    } catch (e) {}

    if (exitCode === 0) {
      log('Deployment script completed successfully. Waiting for app to become healthy...');
      state.updateJob.step = 'health-check';

      // Poll health up to 10 times at 5s intervals
      let healthy = false;
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        healthy = await healthCheck();
        if (healthy) break;
        log(`Post-update health check ${i + 1}/10 failed`);
      }

      if (healthy) {
        state.updateJob.status = 'completed';
        state.updateJob.step = 'done';
        state.maintenance = false;
        state.maintenanceMessage = null;
        state.appUp = true;
        state.consecutiveFailures = 0;
        log('Update complete — app is healthy, maintenance mode disabled');
      } else {
        state.updateJob.status = 'failed';
        state.updateJob.step = 'health-check-failed';
        log('Update complete but app is not healthy — staying in maintenance mode');
      }
    } else {
      state.updateJob.status = 'failed';
      state.updateJob.step = 'script-failed';
      log(`Deployment script failed (exit ${exitCode}) — staying in maintenance mode`);
    }
  });

  proc.on('error', (err) => {
    state.updateJob.status = 'failed';
    state.updateJob.step = 'error';
    state.updateJob.completedAt = new Date().toISOString();
    state.updateJob.exitCode = 1;
    state.updateJob.logs.push(`[error] ${err.message}`);
    log(`Deployment script error: ${err.message}`);
  });
}

function handleUpdateStatus(req, res) {
  if (!state.updateJob) {
    return sendJson(res, 404, { error: 'No update job found' });
  }
  sendJson(res, 200, state.updateJob);
}

async function handleLogs(req, res) {
  if (DOCKER_MODE) {
    return sendJson(res, 403, { error: 'Logs not available in Docker mode' });
  }

  const url = parseUrl(req);
  const lines = Math.min(
    parseInt(url.searchParams.get('lines') || '100', 10),
    CONFIG.logBuffer
  );

  const logLines = await readLogs(lines);
  sendJson(res, 200, { lines: logLines });
}

// =============================================================================
// Version Check
// =============================================================================

const GITHUB_REPO = 'Oak-and-Sprout/sprout-track';
let versionCache = { latestTag: null, checkedAt: 0 };

async function fetchLatestTag() {
  // Cache for 5 minutes
  if (versionCache.latestTag && Date.now() - versionCache.checkedAt < 5 * 60 * 1000) {
    return versionCache.latestTag;
  }

  try {
    const res = await new Promise((resolve, reject) => {
      const https = require('https');
      const req = https.get(
        `https://api.github.com/repos/${GITHUB_REPO}/tags?per_page=1`,
        {
          headers: {
            'User-Agent': 'st-guardian',
            'Accept': 'application/vnd.github.v3+json',
          },
          timeout: 10000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, data: JSON.parse(data) });
            } catch {
              reject(new Error('Invalid JSON from GitHub'));
            }
          });
        }
      );
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('GitHub request timeout')); });
    });

    if (res.status === 200 && Array.isArray(res.data) && res.data.length > 0) {
      const tag = res.data[0].name.replace(/^v/, '');
      versionCache = { latestTag: tag, checkedAt: Date.now() };
      return tag;
    }
    return null;
  } catch (err) {
    log(`Version check failed: ${err.message}`);
    return null;
  }
}

function compareVersions(current, latest) {
  if (!current || !latest) return 0;
  const a = current.split('.').map(Number);
  const b = latest.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

async function handleVersionCheck(req, res) {
  const latestTag = await fetchLatestTag();

  const result = {
    currentVersion: appVersion,
    latestVersion: latestTag,
    updateAvailable: latestTag ? compareVersions(appVersion, latestTag) < 0 : null,
    repository: `https://github.com/${GITHUB_REPO}`,
  };

  sendJson(res, 200, result);
}

// =============================================================================
// Uptime Page
// =============================================================================

function handleLogo(req, res) {
  if (!logoBuffer) {
    res.writeHead(404);
    return res.end('Logo not found');
  }
  res.writeHead(200, {
    'Content-Type': 'image/png',
    'Content-Length': logoBuffer.length,
    'Cache-Control': 'public, max-age=86400',
  });
  res.end(logoBuffer);
}

function handleUptimeData(req, res) {
  // Get per-day stats for last 60 days
  const days = db.prepare(`
    SELECT
      date(timestamp) as date,
      COUNT(*) as total,
      SUM(status) as up
    FROM health_pings
    WHERE timestamp >= datetime('now', '-60 days')
    GROUP BY date(timestamp)
    ORDER BY date(timestamp) ASC
  `).all().map((row) => ({
    date: row.date,
    total: row.total,
    up: row.up,
    pct: row.total > 0 ? Math.round((row.up / row.total) * 10000) / 100 : 100,
  }));

  // Fill in missing days with no data
  const dayMap = new Map(days.map((d) => [d.date, d]));
  const filledDays = [];
  for (let i = 59; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    filledDays.push(dayMap.get(dateStr) || { date: dateStr, total: 0, up: 0, pct: null });
  }

  // Overall uptime
  const totals = db.prepare(`
    SELECT COUNT(*) as total, SUM(status) as up
    FROM health_pings
    WHERE timestamp >= datetime('now', '-60 days')
  `).get();
  const overall = totals.total > 0
    ? Math.round((totals.up / totals.total) * 10000) / 100
    : null;

  // Incidents: consecutive down pings
  const downPings = db.prepare(`
    SELECT timestamp FROM health_pings
    WHERE status = 0 AND timestamp >= datetime('now', '-60 days')
    ORDER BY timestamp ASC
  `).all();

  const incidents = [];
  if (downPings.length > 0) {
    // Group consecutive pings (gap > 2x health interval = separate incident)
    const maxGap = CONFIG.healthInterval * 2.5;
    let start = new Date(downPings[0].timestamp + 'Z');
    let end = start;

    for (let i = 1; i < downPings.length; i++) {
      const ts = new Date(downPings[i].timestamp + 'Z');
      if (ts - end <= maxGap) {
        end = ts;
      } else {
        incidents.push({
          start: start.toISOString(),
          end: end.toISOString(),
          duration: Math.round((end - start) / 1000),
        });
        start = ts;
        end = ts;
      }
    }
    incidents.push({
      start: start.toISOString(),
      end: end.toISOString(),
      duration: Math.round((end - start) / 1000),
    });
  }

  let currentStatus = 'up';
  if (state.maintenance) currentStatus = 'maintenance';
  else if (!state.appUp) currentStatus = 'down';

  sendJson(res, 200, { days: filledDays, overall, incidents: incidents.reverse(), currentStatus });
}

function handleUptime(req, res) {
  sendHtml(res, 200, getUptimePage());
}

function getUptimePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sprout Track - Uptime</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      min-height: 100vh;
      color: #1e293b;
    }
    .header {
      background: linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #14b8a6 100%);
      padding: 32px 20px;
      text-align: center;
      color: white;
    }
    .header img {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      margin-bottom: 12px;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .header p {
      font-size: 14px;
      opacity: 0.85;
    }
    .container {
      max-width: 720px;
      margin: 0 auto;
      padding: 24px 20px;
    }
    .status-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: white;
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .status-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .status-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .status-dot.up { background: #10b981; box-shadow: 0 0 8px rgba(16,185,129,0.4); }
    .status-dot.down { background: #ef4444; box-shadow: 0 0 8px rgba(239,68,68,0.4); }
    .status-dot.maintenance { background: #eab308; box-shadow: 0 0 8px rgba(234,179,8,0.4); }
    .status-label { font-size: 16px; font-weight: 600; }
    .overall-pct {
      font-size: 28px;
      font-weight: 700;
      color: #0f766e;
    }
    .chart-section {
      background: white;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .chart-title {
      font-size: 14px;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .bars {
      display: flex;
      gap: 2px;
      align-items: flex-end;
      height: 48px;
      margin-bottom: 8px;
    }
    .bar {
      flex: 1;
      height: 100%;
      border-radius: 2px;
      cursor: pointer;
      position: relative;
      min-width: 4px;
      transition: opacity 0.15s;
    }
    .bar:hover { opacity: 0.8; }
    .bar.green { background: #10b981; }
    .bar.yellow { background: #eab308; }
    .bar.red { background: #ef4444; }
    .bar.empty { background: #e2e8f0; }
    .bar-tooltip {
      display: none;
      position: absolute;
      bottom: 56px;
      left: 50%;
      transform: translateX(-50%);
      background: #1e293b;
      color: white;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      white-space: nowrap;
      z-index: 10;
      pointer-events: none;
    }
    .bar:hover .bar-tooltip { display: block; }
    .chart-labels {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #94a3b8;
    }
    .incidents-section {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .incident-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 14px;
    }
    .incident-row:last-child { border-bottom: none; }
    .incident-time { color: #64748b; }
    .incident-duration {
      font-weight: 600;
      color: #ef4444;
      background: #fef2f2;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 13px;
    }
    .no-incidents {
      text-align: center;
      color: #94a3b8;
      padding: 24px 0;
      font-size: 14px;
    }
    .footer {
      text-align: center;
      padding: 24px;
      font-size: 12px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="header">
    <img src="/uptime/logo.png" alt="Sprout Track" onerror="this.style.display='none'">
    <h1>Sprout Track</h1>
    <p>Service Status</p>
  </div>
  <div class="container">
    <div class="status-banner">
      <div class="status-left">
        <div class="status-dot" id="statusDot"></div>
        <span class="status-label" id="statusLabel">Loading...</span>
      </div>
      <div class="overall-pct" id="overallPct">—</div>
    </div>
    <div class="chart-section">
      <div class="chart-title">60-Day Uptime History</div>
      <div class="bars" id="bars"></div>
      <div class="chart-labels">
        <span id="labelOldest">—</span>
        <span>Today</span>
      </div>
    </div>
    <div class="incidents-section">
      <div class="chart-title">Recent Incidents</div>
      <div id="incidents"><div class="no-incidents">Loading...</div></div>
    </div>
  </div>
  <div class="footer">Powered by ST-Guardian</div>
  <script>
    function formatDuration(seconds) {
      if (seconds < 60) return seconds + 's';
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      if (m < 60) return m + 'm ' + (s > 0 ? s + 's' : '');
      const h = Math.floor(m / 60);
      const rm = m % 60;
      return h + 'h ' + (rm > 0 ? rm + 'm' : '');
    }

    function formatDate(iso) {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    async function loadData() {
      try {
        const res = await fetch('/uptime/data');
        const data = await res.json();

        // Status banner
        const dot = document.getElementById('statusDot');
        const label = document.getElementById('statusLabel');
        dot.className = 'status-dot ' + data.currentStatus;
        const labels = { up: 'All Systems Operational', down: 'Service Disruption', maintenance: 'Under Maintenance' };
        label.textContent = labels[data.currentStatus] || data.currentStatus;

        // Overall
        const pctEl = document.getElementById('overallPct');
        pctEl.textContent = data.overall !== null ? data.overall + '%' : 'No data';
        if (data.overall !== null) {
          if (data.overall < 99) pctEl.style.color = '#ef4444';
          else if (data.overall < 100) pctEl.style.color = '#eab308';
          else pctEl.style.color = '#0f766e';
        }

        // Bars
        const barsEl = document.getElementById('bars');
        barsEl.innerHTML = '';
        data.days.forEach(day => {
          const bar = document.createElement('div');
          bar.className = 'bar';
          if (day.total === 0) {
            bar.classList.add('empty');
          } else if (day.pct >= 100) {
            bar.classList.add('green');
          } else if (day.pct >= 99) {
            bar.classList.add('yellow');
          } else {
            bar.classList.add('red');
          }
          const tooltip = document.createElement('div');
          tooltip.className = 'bar-tooltip';
          tooltip.textContent = day.date + (day.total > 0 ? ' — ' + day.pct + '%' : ' — No data');
          bar.appendChild(tooltip);
          barsEl.appendChild(bar);
        });

        // Oldest label
        if (data.days.length > 0) {
          document.getElementById('labelOldest').textContent = data.days[0].date;
        }

        // Incidents
        const incEl = document.getElementById('incidents');
        if (data.incidents.length === 0) {
          incEl.innerHTML = '<div class="no-incidents">No incidents in the last 60 days</div>';
        } else {
          incEl.innerHTML = data.incidents.map(inc =>
            '<div class="incident-row">' +
              '<div class="incident-time">' + formatDate(inc.start) +
                (inc.duration > 0 ? ' — ' + formatDate(inc.end) : '') +
              '</div>' +
              '<span class="incident-duration">' + formatDuration(inc.duration || 0) + '</span>' +
            '</div>'
          ).join('');
        }
      } catch (e) {
        console.error('Failed to load uptime data:', e);
      }
    }

    loadData();
    setInterval(loadData, 60000);
  </script>
</body>
</html>`;
}

// =============================================================================
// Router & Proxy
// =============================================================================

const proxy = httpProxy.createProxyServer({
  target: `http://127.0.0.1:${CONFIG.appPort}`,
  ws: true,
});

proxy.on('error', (err, req, res) => {
  state.appUp = false;
  if (res && !res.headersSent && res.writeHead) {
    sendHtml(res, 502, getMaintenancePage('Sprout Track is temporarily unavailable.'));
  }
});

const ROUTES = {
  'GET /status': handleStatus,
  'GET /health': handleHealth,
  'GET /uptime': handleUptime,
  'GET /uptime/data': handleUptimeData,
  'GET /uptime/logo.png': handleLogo,
  'GET /version': handleVersionCheck,
  'POST /maintenance': { handler: handleMaintenanceEnable, auth: true },
  'DELETE /maintenance': { handler: handleMaintenanceDisable, auth: true },
  'POST /update': { handler: handleUpdate, auth: true },
  'GET /update/status': { handler: handleUpdateStatus, auth: true },
  'GET /logs': { handler: handleLogs, auth: true },
};

const server = http.createServer(async (req, res) => {
  const url = parseUrl(req);
  const routeKey = `${req.method} ${url.pathname}`;

  // Check management routes
  const route = ROUTES[routeKey];
  if (route) {
    if (typeof route === 'function') {
      // Public route
      return route(req, res);
    }

    // Authenticated route
    if (route.auth) {
      if (!CONFIG.guardianKey) {
        return sendJson(res, 500, { error: 'ST_GUARDIAN_KEY not configured' });
      }
      if (!authenticate(req)) {
        return sendJson(res, 401, { error: 'Unauthorized' });
      }
    }
    return route.handler(req, res);
  }

  // Maintenance mode — serve maintenance page
  if (state.maintenance) {
    return sendHtml(res, 503, getMaintenancePage(state.maintenanceMessage));
  }

  // Proxy to Next.js
  proxy.web(req, res);
});

// WebSocket upgrade support
server.on('upgrade', (req, socket, head) => {
  if (state.maintenance) {
    socket.destroy();
    return;
  }
  proxy.ws(req, socket, head);
});

// =============================================================================
// Graceful Shutdown
// =============================================================================

async function shutdown(signal) {
  log(`Received ${signal} — shutting down`);

  if (healthIntervalId) {
    clearInterval(healthIntervalId);
  }

  if (!DOCKER_MODE && serviceName) {
    log('Stopping application service...');
    await execScript(path.join(CONFIG.scriptsDir, 'service.sh'), ['stop']).catch(() => {});
  }

  server.close(() => {
    try { db.close(); } catch (e) {}
    log('Server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    log('Forcing exit');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// =============================================================================
// Startup
// =============================================================================

(async function startup() {
  log(`Starting st-guardian v${GUARDIAN_VERSION} in ${DOCKER_MODE ? 'Docker' : 'standalone'} mode`);
  log(`Guardian port: ${CONFIG.guardianPort}`);
  log(`App port: ${CONFIG.appPort}`);
  log(`Health interval: ${CONFIG.healthInterval}ms`);
  log(`Scripts dir: ${CONFIG.scriptsDir}`);
  log(`App dir: ${CONFIG.appDir}`);

  if (DOCKER_MODE) {
    log('Docker mode: update, logs, and process management are disabled');
  }

  if (!CONFIG.guardianKey) {
    log('WARNING: ST_GUARDIAN_KEY is not set — all authenticated management routes will return 500');
  }

  if (!serviceName && !DOCKER_MODE) {
    log('WARNING: SERVICE_NAME not found in .env — log reading and process management may not work');
  }

  // Initial health check
  state.appUp = await healthCheck();
  try { insertPing.run(state.appUp ? 1 : 0); } catch (e) {}
  log(`Initial health check: app is ${state.appUp ? 'up' : 'down'}`);

  // Start health monitor
  startHealthMonitor();

  server.listen(CONFIG.guardianPort, () => {
    log(`Listening on port ${CONFIG.guardianPort}`);
  });
})();
