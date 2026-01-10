#!/usr/bin/env node

/**
 * Script to add missing useLocalization hook calls to components that import it and use t()
 */

const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/components/forms/AppConfigForm/index.tsx',
  'src/components/forms/BathForm/index.tsx',
  'src/components/forms/DiaperForm/index.tsx',
  'src/components/forms/FamilyForm/index.tsx',
  'src/components/forms/FeedForm/BottleFeedForm.tsx',
  'src/components/forms/FeedForm/SolidsFeedForm.tsx',
  'src/components/forms/FeedbackForm/FeedbackMessagesView.tsx',
  'src/components/forms/FeedbackForm/FeedbackPage.tsx',
  'src/components/forms/FeedbackForm/index.tsx',
  'src/components/forms/MeasurementForm/index.tsx',
  'src/components/forms/MilestoneForm/index.tsx',
  'src/components/forms/NoteForm/index.tsx',
  'src/components/forms/SettingsForm/index.tsx',
];

function addHook(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Check if hook is already called
  if (content.includes('const { t } = useLocalization()')) {
    return false; // Already has hook
  }

  // Check if file imports useLocalization
  if (!content.includes("import") || !content.includes('useLocalization')) {
    return false; // Doesn't import it
  }

  // Find the function component
  // Pattern: export default function ComponentName({ ... }: Props) {
  const functionMatch = content.match(/(export\s+(default\s+)?function\s+\w+[^{]*\{)/);
  
  if (!functionMatch) {
    // Try arrow function pattern: const ComponentName = ({ ... }: Props) => {
    const arrowMatch = content.match(/(const\s+\w+\s*=\s*\([^)]*\)\s*:\s*\w+\s*=>\s*\{)/);
    if (!arrowMatch) {
      // Try React.FC pattern: const ComponentName: React.FC<Props> = ({ ... }) => {
      const fcMatch = content.match(/(const\s+\w+[^=]*=\s*\([^)]*\)\s*=>\s*\{)/);
      if (!fcMatch) {
        console.log(`Could not find function pattern in: ${filePath}`);
        return false;
      }
      const funcStart = fcMatch.index + fcMatch[0].length;
      const afterBrace = content.substring(funcStart);
      const lines = afterBrace.split('\n');
      let insertIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
          insertIndex = i;
          break;
        }
      }
      const indent = lines[insertIndex].match(/^(\s*)/)?.[1] || '  ';
      lines.splice(insertIndex, 0, `${indent}const { t } = useLocalization();`);
      content = content.substring(0, funcStart) + lines.join('\n');
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`Fixed: ${filePath}`);
      return true;
    }
    const funcStart = arrowMatch.index + arrowMatch[0].length;
    const afterBrace = content.substring(funcStart);
    const lines = afterBrace.split('\n');
    let insertIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
        insertIndex = i;
        break;
      }
    }
    const indent = lines[insertIndex].match(/^(\s*)/)?.[1] || '  ';
    lines.splice(insertIndex, 0, `${indent}const { t } = useLocalization();`);
    content = content.substring(0, funcStart) + lines.join('\n');
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Fixed: ${filePath}`);
    return true;
  }

  const funcStart = functionMatch.index + functionMatch[0].length;
  const afterBrace = content.substring(funcStart);
  const lines = afterBrace.split('\n');
  
  // Find first non-comment, non-empty line
  let insertIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*')) {
      insertIndex = i;
      break;
    }
  }
  
  // Get indentation from the first real line
  const indent = lines[insertIndex].match(/^(\s*)/)?.[1] || '  ';
  lines.splice(insertIndex, 0, `${indent}const { t } = useLocalization();`);
  content = content.substring(0, funcStart) + lines.join('\n');
  
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`Fixed: ${filePath}`);
  return true;
}

let fixedCount = 0;
for (const file of filesToFix) {
  if (addHook(file)) {
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} files`);
