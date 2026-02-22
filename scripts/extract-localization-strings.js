#!/usr/bin/env node

/**
 * Script to extract hardcoded strings from components and pages,
 * add them to per-language translation files, and replace them with t() calls.
 * 
 * Usage: node scripts/extract-localization-strings.js [--dry-run] [--path <path>]
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

// Configuration
const TRANSLATIONS_DIR = path.join(__dirname, '../src/localization/translations');
const SUPPORTED_LANGUAGES_FILE = path.join(__dirname, '../src/localization/supported-languages.json');
const SOURCE_DIRS = [
  path.join(__dirname, '../src'),
  path.join(__dirname, '../app')
];
const EXCLUDE_DIRS = [
  'node_modules',
  '.next',
  'dist',
  'localization'
];
const EXCLUDE_FILES = [
  'localization.tsx',
  'localization.ts'
];

// Strings to skip (common code strings that shouldn't be translated)
const SKIP_STRINGS = new Set([
  'className', 'id', 'key', 'type', 'name', 'value', 'href', 'src', 'alt',
  'aria-label', 'data-', 'useState', 'useEffect', 'useCallback', 'useMemo',
  'import', 'export', 'default', 'const', 'let', 'var', 'function', 'return',
  'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue',
  'true', 'false', 'null', 'undefined', 'this', 'super', 'new', 'typeof',
  'instanceof', 'in', 'of', 'async', 'await', 'try', 'catch', 'finally',
  'throw', 'extends', 'implements', 'interface', 'type', 'enum', 'namespace',
  'module', 'declare', 'public', 'private', 'protected', 'static', 'readonly',
  'abstract', 'get', 'set', 'constructor', 'super', 'this'
].map(s => s.toLowerCase()));

// Minimum string length to consider for translation
const MIN_STRING_LENGTH = 2;

// Maximum string length to consider (to avoid code blocks)
const MAX_STRING_LENGTH = 200;

/**
 * Check if a string should be skipped
 */
function shouldSkipString(str) {
  // Skip empty or very short strings
  if (!str || str.length < MIN_STRING_LENGTH || str.length > MAX_STRING_LENGTH) {
    return true;
  }

  // Skip strings that are already translation keys (contain t(' or t(")
  if (str.includes("t('") || str.includes('t("')) {
    return true;
  }

  // Skip common code patterns
  if (SKIP_STRINGS.has(str.toLowerCase())) {
    return true;
  }

  // Skip strings that look like code identifiers (common in props, ids, etc.)
  // - lowerCamelCase / camelCase / snake_case / kebab-case
  // - long "test-id" / "css-class" / "data-key" style tokens
  if (/^[a-z_$][a-zA-Z0-9_$]*$/.test(str) && str.length < 40) {
    return true;
  }
  // Skip long kebab/snake-case tokens (common for css/test ids). Avoid false positives like "E-mail".
  if (
    !str.includes(' ') &&
    /^[a-z0-9]+(?:[-_][a-z0-9]+)+$/.test(str) &&
    (str.match(/[-_]/g) || []).length >= 2
  ) {
    return true;
  }

  // Skip strings that are mostly numbers or special characters
  if (/^[\d\s\-_.,;:!?@#$%^&*()]+$/.test(str)) {
    return true;
  }

  // Skip URLs and file paths
  if (str.startsWith('http://') || str.startsWith('https://') || 
      str.startsWith('/') || str.includes('\\') || str.includes('./') ||
      // module-ish paths like "@/foo/bar" or "../foo"
      str.startsWith('@/') || str.startsWith('./') || str.startsWith('../') ||
      // any slash-delimited token with no spaces is almost always a path
      (str.includes('/') && !str.includes(' '))) {
    return true;
  }

  return false;
}

function getScriptKind(filePath) {
  if (filePath.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (filePath.endsWith('.ts')) return ts.ScriptKind.TS;
  return ts.ScriptKind.Unknown;
}

function parseSourceFile(filePath, content) {
  return ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath)
  );
}

function normalizeJsxText(raw) {
  if (!raw) return '';
  return decodeCommonHtmlEntities(raw).replace(/\s+/g, ' ').trim();
}

function looksLikeUserFacingText(str) {
  if (!str) return false;
  // Must include at least one letter
  if (!/[A-Za-z]/.test(str)) return false;
  // Avoid single token lowerCamelCase identifiers
  if (/^[a-z_$][a-zA-Z0-9_$]*$/.test(str)) return false;
  // Avoid CSS/test ids
  if (
    !str.includes(' ') &&
    /^[a-z0-9]+(?:[-_][a-z0-9]+)+$/.test(str) &&
    (str.match(/[-_]/g) || []).length >= 2
  ) {
    return false;
  }
  return true;
}

function decodeCommonHtmlEntities(str) {
  return String(str)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
}

function getContextSnippet(lines, startLine, endLine, radius = 1) {
  const from = Math.max(0, startLine - radius);
  const to = Math.min(lines.length - 1, endLine + radius);
  return {
    fromLine: from + 1,
    toLine: to + 1,
    text: lines.slice(from, to + 1).join('\n')
  };
}

/**
 * Get line number from content and index
 */
function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

/**
 * Check if a string is already wrapped in t() call
 */
function isAlreadyLocalized(content, text, startPos, endPos) {
  // Get surrounding context to check if already in t() call
  const beforeContext = content.substring(Math.max(0, startPos - 50), startPos);
  const afterContext = content.substring(endPos, Math.min(content.length, endPos + 50));
  
  // Check if the text is already inside {t('...')} or {t("...")}
  // Look for patterns like {t('Text')} or {t("Text")} around this position
  const fullContext = beforeContext + text + afterContext;
  
  // Check if we're inside a t() call
  // Pattern: {t('text')} or {t("text")}
  const tCallPattern = /\{t\(['"]([^'"]*)['"]\)\}/g;
  let match;
  while ((match = tCallPattern.exec(fullContext)) !== null) {
    const matchText = match[1];
    // Check if our text is contained in this t() call
    if (matchText.includes(text) || text.includes(matchText)) {
      // Verify the match position overlaps with our text position
      const matchStart = beforeContext.length + match.index - 2; // -2 for {t
      const matchEnd = matchStart + match[0].length;
      if (startPos >= matchStart && endPos <= matchEnd) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Extract strings from a file with line number tracking
 * Only returns strings that are NOT already localized
 */
function extractStrings(filePath, content) {
  const strings = new Set();
  const stringDetails = []; // Store details for logging
  
  // Extract JSX rendered text only:
  // We walk the TSX AST and collect JsxText nodes (what appears between tags),
  // instead of regexing string literals (which pulls in import paths, classnames, etc).
  const sourceFile = parseSourceFile(filePath, content);
  const lines = content.split('\n');

  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const raw = node.getText(sourceFile);
      const text = normalizeJsxText(raw);

      if (
        text &&
        !shouldSkipString(text) &&
        looksLikeUserFacingText(text)
      ) {
        const startPos = node.getStart(sourceFile);
        const endPos = node.getEnd();
        
        // Check if this string is already wrapped in t() call
        if (isAlreadyLocalized(content, text, startPos, endPos)) {
          return; // Skip already localized strings
        }
        
        const lcStart = sourceFile.getLineAndCharacterOfPosition(startPos);
        const lcEnd = sourceFile.getLineAndCharacterOfPosition(endPos);
        const context = getContextSnippet(lines, lcStart.line, lcEnd.line, 1);
        const leading = raw.match(/^\s*/)?.[0] ?? '';
        const trailing = raw.match(/\s*$/)?.[0] ?? '';
        const replacementPreview = `${leading}{t('${escapeForSingleQuotedJsString(text)}')}${trailing}`;

        strings.add(text);
        stringDetails.push({
          type: 'jsx-text',
          text,
          line: lcStart.line + 1,
          original: raw,
          replacementPreview,
          context
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return { strings: Array.from(strings), details: stringDetails };
}

/**
 * Load existing translations
 */
function loadLanguageFile(lang) {
  try {
    const filePath = path.join(TRANSLATIONS_DIR, `${lang}.json`);
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading translations (${lang}): ${error.message}`);
    return {};
  }
}

/**
 * Save translations
 */
function saveLanguageFile(lang, translations) {
  // Sort keys alphabetically
  const sorted = {};
  Object.keys(translations).sort().forEach(key => {
    sorted[key] = translations[key];
  });

  const filePath = path.join(TRANSLATIONS_DIR, `${lang}.json`);
  fs.writeFileSync(filePath, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
}

function ensureTranslationsDirExists() {
  if (!fs.existsSync(TRANSLATIONS_DIR)) {
    fs.mkdirSync(TRANSLATIONS_DIR, { recursive: true });
  }
}

function loadSupportedLanguages() {
  try {
    const content = fs.readFileSync(SUPPORTED_LANGUAGES_FILE, 'utf8');
    const parsed = JSON.parse(content);
    const langs = Array.isArray(parsed) ? parsed.filter(l => typeof l === 'string') : [];
    const unique = Array.from(new Set(langs));
    return unique.includes('en') ? unique : ['en', ...unique];
  } catch {
    // Fallback to current app default if config file is missing/invalid
    return ['en', 'es', 'fr'];
  }
}

/**
 * Check if file already imports useLocalization
 */
function hasLocalizationImport(content) {
  return content.includes("useLocalization") || content.includes("from '@/src/context/localization'");
}

/**
 * Add useLocalization import if needed
 */
function addLocalizationImport(content) {
  if (hasLocalizationImport(content)) {
    return content;
  }

  // Find the last import statement
  const importRegex = /^import\s+.*from\s+['"].*['"];?\s*$/gm;
  const imports = content.match(importRegex);
  
  if (imports && imports.length > 0) {
    const lastImport = imports[imports.length - 1];
    const lastImportIndex = content.lastIndexOf(lastImport);
    const afterLastImport = content.substring(lastImportIndex + lastImport.length);
    
    // Add the import after the last import
    const newImport = "import { useLocalization } from '@/src/context/localization';\n";
    return content.substring(0, lastImportIndex + lastImport.length) + newImport + afterLastImport;
  } else {
    // No imports found, add at the top
    return "import { useLocalization } from '@/src/context/localization';\n" + content;
  }
}

/**
 * Add useLocalization hook call if needed
 */
function addLocalizationHook(content) {
  if (content.includes('const { t } = useLocalization()') || 
      content.includes('const { t } = useLocalization();')) {
    return content;
  }

  // Find the first function component or hook
  const functionMatch = content.match(/(export\s+)?(default\s+)?function\s+\w+|const\s+\w+\s*=\s*\([^)]*\)\s*=>|const\s+\w+\s*=\s*\([^)]*\)\s*:\s*\w+\s*=>/);
  
  if (functionMatch) {
    const matchIndex = functionMatch.index + functionMatch[0].length;
    const afterMatch = content.substring(matchIndex);
    
    // Find the opening brace
    const braceIndex = afterMatch.indexOf('{');
    if (braceIndex !== -1) {
      const insertIndex = matchIndex + braceIndex + 1;
      const hookCall = "  const { t } = useLocalization();\n";
      return content.substring(0, insertIndex) + hookCall + content.substring(insertIndex);
    }
  }

  return content;
}

function escapeForSingleQuotedJsString(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Replace strings in file content with t() calls
 */
function replaceStringsInFile(content, filePath, translations) {
  let modified = content;
  let hasChanges = false;
  const needsImport = !hasLocalizationImport(content);

  // Replace JSX rendered text only, using AST node positions.
  const sourceFile = parseSourceFile(filePath, modified);
  const replacements = [];

  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const raw = node.getText(sourceFile);
      const text = normalizeJsxText(raw);

      if (
        text &&
        translations[text] &&
        !shouldSkipString(text) &&
        looksLikeUserFacingText(text)
      ) {
        const leading = raw.match(/^\s*/)?.[0] ?? '';
        const trailing = raw.match(/\s*$/)?.[0] ?? '';
        const escaped = escapeForSingleQuotedJsString(text);
        const replacement = `${leading}{t('${escaped}')}${trailing}`;

        replacements.push({
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          replacement
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  // Apply in reverse order to keep indices stable
  replacements.sort((a, b) => b.start - a.start);
  for (const { start, end, replacement } of replacements) {
    modified = modified.substring(0, start) + replacement + modified.substring(end);
    hasChanges = true;
  }

  // Add import and hook if we made changes
  if (hasChanges && needsImport) {
    modified = addLocalizationImport(modified);
    modified = addLocalizationHook(modified);
  }

  return { content: modified, hasChanges };
}

/**
 * Recursively find all TypeScript/TSX files
 */
function findFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) {
    return fileList;
  }

  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip excluded directories
      if (!EXCLUDE_DIRS.includes(file)) {
        findFiles(filePath, fileList);
      }
    } else if (stat.isFile()) {
      // Only include .ts and .tsx files
      if ((file.endsWith('.ts') || file.endsWith('.tsx')) && 
          !EXCLUDE_FILES.includes(file) &&
          !file.includes('.test.') &&
          !file.includes('.spec.')) {
        fileList.push(filePath);
      }
    }
  });

  return fileList;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const pathArg = args.find(arg => arg.startsWith('--path='));
  const targetPath = pathArg ? pathArg.split('=')[1] : null;

  console.log('Scanning for hardcoded strings...\n');

  // Load existing translations (per-language files)
  ensureTranslationsDirExists();
  const supportedLanguages = loadSupportedLanguages();
  const translationsByLang = Object.fromEntries(
    supportedLanguages.map(lang => [lang, loadLanguageFile(lang)])
  );
  const translationsEn = translationsByLang.en || {};

  // Find all source files
  const files = (() => {
    if (!targetPath) return SOURCE_DIRS.flatMap(dir => findFiles(dir));
    const resolved = path.resolve(targetPath);
    try {
      const stat = fs.statSync(resolved);
      return stat.isDirectory() ? findFiles(resolved) : [resolved];
    } catch {
      return [resolved];
    }
  })();

  console.log(`Found ${files.length} files to scan\n`);

  // Extract strings from each file
  const allStrings = new Set();
  const fileStrings = new Map();
  const fileDetails = new Map(); // Store details for each file

  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const { strings, details } = extractStrings(filePath, content);
      
      if (strings.length > 0) {
        fileStrings.set(filePath, strings);
        fileDetails.set(filePath, details);
        strings.forEach(s => allStrings.add(s));
      }
    } catch (error) {
      console.error(`Error reading ${filePath}: ${error.message}`);
    }
  }

  console.log(`Found ${allStrings.size} unique strings\n`);

  // Add new strings (keys) to language files
  const newStrings = [];
  for (const str of allStrings) {
    if (!translationsEn[str]) {
      translationsByLang.en[str] = str;
      for (const lang of supportedLanguages) {
        if (lang === 'en') continue;
        if (!translationsByLang[lang][str]) {
          translationsByLang[lang][str] = '';
        }
      }
      newStrings.push(str);
    }
  }
  const addedCount = newStrings.length;

  // Save translations
  if (!dryRun && addedCount > 0) {
    for (const lang of supportedLanguages) {
      saveLanguageFile(lang, translationsByLang[lang]);
    }
    console.log(`[SUCCESS] Added ${addedCount} new strings to language files`);
    console.log(`   Total translation keys: ${Object.keys(translationsByLang.en).length}\n`);
  } else if (dryRun) {
    console.log(`[DRY RUN] Would add ${addedCount} new strings to language files\n`);
    
    // Create detailed log file
    const logFile = path.join(__dirname, '../localization-extraction-log.txt');
    const logLines = [];
    logLines.push('='.repeat(80));
    logLines.push('LOCALIZATION STRING EXTRACTION LOG');
    logLines.push('Generated: ' + new Date().toISOString());
    logLines.push('Mode: DRY RUN (no files were modified)');
    logLines.push('='.repeat(80));
    logLines.push('');
    logLines.push(`Summary: ${addedCount} new strings would be added to language files`);
    logLines.push(`Total files scanned: ${files.length}`);
    logLines.push(`Files with strings: ${fileDetails.size}`);
    logLines.push('');

    const sortedFileEntries = Array.from(fileDetails.entries()).sort(([a], [b]) => {
      const ra = path.relative(process.cwd(), a);
      const rb = path.relative(process.cwd(), b);
      return ra.localeCompare(rb);
    });

    logLines.push('='.repeat(80));
    logLines.push('FILES WITH STRINGS');
    logLines.push('='.repeat(80));
    logLines.push('');

    sortedFileEntries.forEach(([filePath, details]) => {
      const relativePath = path.relative(process.cwd(), filePath);
      logLines.push(`- ${relativePath} (${details.length})`);
    });

    logLines.push('');
    logLines.push('='.repeat(80));
    logLines.push('FILE CHANGES (GROUPED BY FILE AND LINE)');
    logLines.push('='.repeat(80));
    logLines.push('');

    // List changes per file
    for (const [filePath, details] of sortedFileEntries) {
      const relativePath = path.relative(process.cwd(), filePath);
      logLines.push(`File: ${relativePath}`);
      logLines.push('-'.repeat(80));
      
      // Group by line number
      const byLine = {};
      details.forEach(detail => {
        if (!byLine[detail.line]) {
          byLine[detail.line] = [];
        }
        byLine[detail.line].push(detail);
      });
      
      // Sort by line number
      const sortedLines = Object.keys(byLine).sort((a, b) => parseInt(a) - parseInt(b));
      
      sortedLines.forEach(lineNum => {
        byLine[lineNum].forEach(detail => {
          logLines.push(`  Line ${lineNum} (${detail.type}):`);
          if (detail.context && detail.context.text) {
            logLines.push(`    Context (lines ${detail.context.fromLine}-${detail.context.toLine}):`);
            detail.context.text.split('\n').forEach(ctxLine => {
              logLines.push(`      ${ctxLine}`);
            });
          }
          logLines.push(`    Original text node: ${detail.original}`);
          logLines.push(`    Extracted string:   "${detail.text}"`);
          if (detail.replacementPreview) {
            logLines.push(`    Replacement preview: ${detail.replacementPreview}`);
          } else {
            logLines.push(`    Replacement preview: {t('${detail.text}')}`);
          }
          logLines.push('');
        });
      });
      
      logLines.push('');
    }

    logLines.push('='.repeat(80));
    logLines.push('NEW TRANSLATIONS TO BE ADDED (UNIQUE KEYS)');
    logLines.push('='.repeat(80));
    logLines.push('');

    // List new strings
    newStrings.slice().sort().forEach(str => {
      logLines.push(`  "${str}"`);
      logLines.push('');
    });
    
    logLines.push('='.repeat(80));
    logLines.push('END OF LOG');
    logLines.push('='.repeat(80));
    
    fs.writeFileSync(logFile, logLines.join('\n'), 'utf8');
    console.log(`[LOG] Detailed log written to: ${path.relative(process.cwd(), logFile)}`);
    console.log('');
  } else {
    console.log(`[INFO] No new strings to add\n`);
  }

  // Replace strings in files
  if (!dryRun) {
    console.log('Replacing strings in files...\n');
    let modifiedFiles = 0;

    for (const [filePath, strings] of fileStrings.entries()) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const { content: modified, hasChanges } = replaceStringsInFile(content, filePath, translationsEn);

        if (hasChanges) {
          fs.writeFileSync(filePath, modified, 'utf8');
          modifiedFiles++;
          console.log(`   Modified: ${path.relative(process.cwd(), filePath)}`);
        }
      } catch (error) {
        console.error(`   Error processing ${filePath}: ${error.message}`);
      }
    }

    if (modifiedFiles > 0) {
      console.log(`\n[SUCCESS] Modified ${modifiedFiles} files`);
    } else {
      console.log(`\n[INFO] No files needed modification`);
    }
  } else {
    console.log('[DRY RUN] Dry run mode - files were not modified');
  }

  // Generate list of files that still need updates
  const filesNeedingUpdates = Array.from(fileStrings.entries())
    .filter(([filePath, strings]) => {
      return strings && Array.isArray(strings) && strings.length > 0;
    })
    .map(([filePath, strings]) => {
      const relativePath = path.relative(process.cwd(), filePath);
      const count = Array.isArray(strings) ? strings.length : 0;
      return { path: relativePath, absolutePath: filePath, count };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  if (filesNeedingUpdates.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('FILES STILL NEEDING LOCALIZATION UPDATES');
    console.log('='.repeat(80));
    console.log(`\nTotal: ${filesNeedingUpdates.length} file(s)\n`);
    filesNeedingUpdates.forEach(({ path: filePath, count }) => {
      console.log(`  - ${filePath} (${count} string${count !== 1 ? 's' : ''})`);
    });
    console.log('\n' + '='.repeat(80));
    
    // Write to a file for easy reference
    const remainingFilesPath = path.join(__dirname, '../localization-remaining-files.txt');
    const fileListContent = [
      '# Files Still Needing Localization Updates',
      `# Generated: ${new Date().toISOString()}`,
      `# Total: ${filesNeedingUpdates.length} file(s)`,
      '',
      ...filesNeedingUpdates.map(({ path: filePath, count }) => {
        return `${filePath} (${count} string${count !== 1 ? 's' : ''})`;
      })
    ].join('\n');
    fs.writeFileSync(remainingFilesPath, fileListContent, 'utf8');
    console.log(`\n[INFO] List of remaining files written to: ${path.relative(process.cwd(), remainingFilesPath)}`);
  } else {
    console.log('\n[SUCCESS] All files have been localized! No remaining files need updates.');
  }

  console.log('\nComplete!');
}

// Run the script
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
