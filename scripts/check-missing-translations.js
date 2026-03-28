#!/usr/bin/env node

/**
 * Compare all translation JSON files to en.json, add missing keys (empty string values),
 * and run sort-translation-files.js.
 *
 * - Empty files: treated as {} then all reference keys are added.
 * - Invalid JSON or non-object root: file is replaced with all reference keys (empty values).
 *
 * Do NOT run with bash. Use:
 *   node scripts/check-missing-translations.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TRANSLATIONS_DIR = path.join(__dirname, '../src/localization/translations');
const REFERENCE_LANG = 'en';
const SORT_SCRIPT = path.join(__dirname, 'sort-translation-files.js');

/**
 * @returns {{ translations: Record<string, string>, status: 'ok' | 'empty' | 'invalid', detail?: string }}
 */
function loadTranslationsFile(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return { translations: {}, status: 'invalid', detail: 'could not read file' };
  }

  if (raw.trim() === '') {
    return { translations: {}, status: 'empty' };
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { translations: {}, status: 'invalid', detail: 'root must be a JSON object' };
    }
    const translations = {};
    for (const [k, v] of Object.entries(parsed)) {
      translations[k] = typeof v === 'string' ? v : v == null ? '' : String(v);
    }
    return { translations, status: 'ok' };
  } catch (e) {
    return { translations: {}, status: 'invalid', detail: e.message };
  }
}

function main() {
  console.log('Checking translation files for missing keys...\n');

  if (!fs.existsSync(TRANSLATIONS_DIR)) {
    console.error(`Error: Translations directory not found: ${TRANSLATIONS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(TRANSLATIONS_DIR).filter((file) => file.endsWith('.json'));

  if (files.length === 0) {
    console.log('No translation files found.');
    return;
  }

  const refFile = `${REFERENCE_LANG}.json`;
  if (!files.includes(refFile)) {
    console.error(`Error: Reference file ${refFile} not found.`);
    process.exit(1);
  }

  const refPath = path.join(TRANSLATIONS_DIR, refFile);
  const refTranslations = JSON.parse(fs.readFileSync(refPath, 'utf8'));
  const refKeys = Object.keys(refTranslations);

  console.log(`Reference: ${refFile} (${refKeys.length} keys)\n`);

  const langFiles = files.filter((file) => file !== refFile);
  let totalAdded = 0;
  let totalExtra = 0;
  let totalFromScratch = 0;

  for (const file of langFiles) {
    const filePath = path.join(TRANSLATIONS_DIR, file);
    const { translations, status, detail } = loadTranslationsFile(filePath);

    if (status === 'invalid') {
      totalFromScratch++;
      console.log(`── ${file} ──`);
      console.log(`  Invalid or unreadable JSON (${detail}). Replacing with keys from ${refFile} (empty values).\n`);
    } else if (status === 'empty') {
      totalFromScratch++;
      console.log(`── ${file} ──`);
      console.log(`  Empty file. Filling with all keys from ${refFile} (empty values).\n`);
    }

    const langKeys = Object.keys(translations);
    const missing = refKeys.filter((key) => !(key in translations));
    const extra = langKeys.filter((key) => !(key in refTranslations));

    if (status === 'ok') {
      console.log(`── ${file} (${langKeys.length} keys) ──`);
    }

    if (missing.length === 0 && extra.length === 0 && status === 'ok') {
      console.log('  All keys match the reference file.\n');
      continue;
    }

    if (missing.length > 0) {
      totalAdded += missing.length;
      console.log(`  Added ${missing.length} missing key(s) with blank values:`);
      for (const key of missing) {
        translations[key] = '';
      }
      const preview = missing.length > 20 ? missing.slice(0, 20) : missing;
      for (const key of preview) {
        console.log(`    + "${key}"`);
      }
      if (missing.length > 20) {
        console.log(`    ... and ${missing.length - 20} more`);
      }
      fs.writeFileSync(filePath, JSON.stringify(translations, null, 2) + '\n', 'utf8');
    }

    if (extra.length > 0) {
      totalExtra += extra.length;
      console.log(`  Extra ${extra.length} key(s) not in ${refFile}:`);
      for (const key of extra.slice(0, 15)) {
        console.log(`    ~ "${key}"`);
      }
      if (extra.length > 15) {
        console.log(`    ... and ${extra.length - 15} more`);
      }
    }

    console.log('');
  }

  console.log('── Summary ──');
  if (totalFromScratch > 0) {
    console.log(`${totalFromScratch} file(s) were empty or invalid and filled from ${refFile}.`);
  }
  if (totalAdded > 0) {
    console.log(`${totalAdded} key(s) added across all files.`);
  }
  if (totalExtra > 0) {
    console.log(`${totalExtra} extra key(s) across all files (not in ${refFile}).`);
  }
  if (totalAdded === 0 && totalExtra === 0 && totalFromScratch === 0) {
    console.log('All translation files are in sync!');
  }

  console.log('\nSorting translation files...');
  try {
    execSync(`node "${SORT_SCRIPT}"`, { stdio: 'inherit' });
  } catch (error) {
    console.error('Error running sort script:', error.message);
    process.exit(1);
  }
}

main();
