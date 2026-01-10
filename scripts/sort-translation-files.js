#!/usr/bin/env node

/**
 * Script to sort all translation files alphabetically by their keys.
 * 
 * This ensures consistent ordering across all language files, making it easier
 * to find and maintain translations.
 * 
 * Usage: node scripts/sort-translation-files.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const TRANSLATIONS_DIR = path.join(__dirname, '../src/localization/translations');

/**
 * Sort a translation object by its keys alphabetically
 * @param {Object} translations - The translation object to sort
 * @returns {Object} - A new object with sorted keys
 */
function sortTranslations(translations) {
  const sortedKeys = Object.keys(translations).sort((a, b) => {
    // Case-insensitive alphabetical sort
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });

  const sorted = {};
  for (const key of sortedKeys) {
    sorted[key] = translations[key];
  }

  return sorted;
}

/**
 * Sort a translation file
 * @param {string} filePath - Path to the translation file
 * @returns {boolean} - True if file was modified, false otherwise
 */
function sortTranslationFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const translations = JSON.parse(content);
    
    const sorted = sortTranslations(translations);
    const sortedContent = JSON.stringify(sorted, null, 2) + '\n';
    
    // Only write if content changed
    if (content !== sortedContent) {
      fs.writeFileSync(filePath, sortedContent, 'utf8');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Main function
 */
function main() {
  console.log('Sorting translation files...\n');

  if (!fs.existsSync(TRANSLATIONS_DIR)) {
    console.error(`Error: Translations directory not found: ${TRANSLATIONS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(TRANSLATIONS_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(TRANSLATIONS_DIR, file));

  if (files.length === 0) {
    console.log('No translation files found.');
    return;
  }

  let modifiedCount = 0;
  for (const filePath of files) {
    const fileName = path.basename(filePath);
    const wasModified = sortTranslationFile(filePath);
    
    if (wasModified) {
      console.log(`✓ Sorted: ${fileName}`);
      modifiedCount++;
    } else {
      console.log(`- Already sorted: ${fileName}`);
    }
  }

  console.log(`\n${modifiedCount} file(s) sorted.`);
  console.log('All translation files are now alphabetically sorted by key.');
}

// Run the script
main();
