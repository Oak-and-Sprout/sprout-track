#!/usr/bin/env node

/**
 * Script to compare all translation files, add missing keys with blank values,
 * and then sort all files alphabetically.
 *
 * Uses en.json as the reference file. Any keys missing from other language files
 * are added with an empty string value. Also reports extra keys that exist in
 * language files but not in the reference.
 *
 * Usage: node scripts/check-missing-translations.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const TRANSLATIONS_DIR = path.join(__dirname, '../src/localization/translations');
const REFERENCE_LANG = 'en';
const SORT_SCRIPT = path.join(__dirname, 'sort-translation-files.js');

/**
 * Main function
 */
function main() {
  console.log('Checking translation files for missing keys...\n');

  if (!fs.existsSync(TRANSLATIONS_DIR)) {
    console.error(`Error: Translations directory not found: ${TRANSLATIONS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(TRANSLATIONS_DIR).filter(file => file.endsWith('.json'));

  if (files.length === 0) {
    console.log('No translation files found.');
    return;
  }

  // Load reference file
  const refFile = `${REFERENCE_LANG}.json`;
  if (!files.includes(refFile)) {
    console.error(`Error: Reference file ${refFile} not found.`);
    process.exit(1);
  }

  const refPath = path.join(TRANSLATIONS_DIR, refFile);
  const refTranslations = JSON.parse(fs.readFileSync(refPath, 'utf8'));
  const refKeys = Object.keys(refTranslations);

  console.log(`Reference: ${refFile} (${refKeys.length} keys)\n`);

  const langFiles = files.filter(file => file !== refFile);
  let totalAdded = 0;
  let totalExtra = 0;

  for (const file of langFiles) {
    const filePath = path.join(TRANSLATIONS_DIR, file);
    const translations = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const langKeys = Object.keys(translations);

    const missing = refKeys.filter(key => !(key in translations));
    const extra = langKeys.filter(key => !(key in refTranslations));

    console.log(`── ${file} (${langKeys.length} keys) ──`);

    if (missing.length === 0 && extra.length === 0) {
      console.log('  All keys match the reference file.\n');
      continue;
    }

    if (missing.length > 0) {
      totalAdded += missing.length;
      console.log(`  Added ${missing.length} missing key(s) with blank values:`);
      for (const key of missing) {
        translations[key] = '';
        console.log(`    + "${key}"`);
      }
      fs.writeFileSync(filePath, JSON.stringify(translations, null, 2) + '\n', 'utf8');
    }

    if (extra.length > 0) {
      totalExtra += extra.length;
      console.log(`  Extra ${extra.length} key(s) not in ${refFile}:`);
      for (const key of extra) {
        console.log(`    ~ "${key}"`);
      }
    }

    console.log('');
  }

  // Summary
  console.log('── Summary ──');
  if (totalAdded > 0) {
    console.log(`${totalAdded} key(s) added across all files.`);
  }
  if (totalExtra > 0) {
    console.log(`${totalExtra} extra key(s) across all files (not in ${refFile}).`);
  }
  if (totalAdded === 0 && totalExtra === 0) {
    console.log('All translation files are in sync!');
  }

  // Run the sort script
  console.log('\nSorting translation files...');
  try {
    execSync(`node "${SORT_SCRIPT}"`, { stdio: 'inherit' });
  } catch (error) {
    console.error('Error running sort script:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
