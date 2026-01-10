#!/usr/bin/env node

/**
 * Script to fix hook placement issues where useLocalization hook
 * was incorrectly placed in function parameter lists (version 2 - handles blank lines)
 */

const fs = require('fs');
const path = require('path');

// Find all files with the issue
const { execSync } = require('child_process');

function findFilesWithIssue() {
  try {
    const result = execSync(
      `find src app -type f \\( -name "*.tsx" -o -name "*.ts" \\) -exec grep -l "export.*function.*{.*\\n.*const { t } = useLocalization()" {} \\;`,
      { encoding: 'utf8', cwd: path.join(__dirname, '..') }
    );
    return result.trim().split('\n').filter(f => f);
  } catch (error) {
    // If grep doesn't find anything, return empty array
    return [];
  }
}

function fixFile(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  // Pattern: export default function ComponentName({
  //            (blank line)
  //            const { t } = useLocalization();
  //            param1,
  const pattern1 = /(export\s+(default\s+)?function\s+\w+\s*\(\{)\s*\n\s*const\s+\{\s*t\s*\}\s*=\s*useLocalization\(\);/g;
  if (pattern1.test(content)) {
    content = content.replace(pattern1, '$1');
    modified = true;
  }

  // Pattern: export default function ComponentName({
  // const { t } = useLocalization();
  // param1,
  const pattern2 = /(export\s+(default\s+)?function\s+\w+\s*\(\{)\s*\n\s*const\s+\{\s*t\s*\}\s*=\s*useLocalization\(\);/g;
  if (pattern2.test(content)) {
    content = content.replace(pattern2, '$1');
    modified = true;
  }

  // Pattern: export function ComponentName({
  //            (blank line)
  //            const { t } = useLocalization();
  //            param1,
  const pattern3 = /(export\s+function\s+\w+\s*\(\{)\s*\n\s*const\s+\{\s*t\s*\}\s*=\s*useLocalization\(\);/g;
  if (pattern3.test(content)) {
    content = content.replace(pattern3, '$1');
    modified = true;
  }

  // Pattern: export default function ComponentName() {
  //            (blank line)
  //            const { t } = useLocalization();
  const pattern4 = /(export\s+(default\s+)?function\s+\w+\s*\(\)\s*\{)\s*\n\s*const\s+\{\s*t\s*\}\s*=\s*useLocalization\(\);/g;
  if (pattern4.test(content)) {
    content = content.replace(pattern4, '$1\n  const { t } = useLocalization();');
    modified = true;
  }

  // Now add the hook call inside the function body if it's missing
  // Look for function body opening brace and add hook if not present
  const functionBodyPattern = /(export\s+(default\s+)?function\s+\w+[^{]*\{)\s*([^}]*?)(const\s+\[|const\s+\{|\/\/|if\s*\(|return|useState|useEffect)/;
  
  // Check if hook is already in function body (not in parameter list)
  const hasHookInBody = content.match(/export.*function[^{]*\{[^}]*const { t } = useLocalization()/);
  const hasHookInParams = content.match(/export.*function.*\{.*const { t } = useLocalization()/);
  
  if (hasHookInParams && !hasHookInBody) {
    // Find the function and add hook after opening brace
    const functionMatch = content.match(/(export\s+(default\s+)?function\s+\w+[^{]*\{)/);
    if (functionMatch) {
      const funcStart = functionMatch.index + functionMatch[0].length;
      const afterBrace = content.substring(funcStart);
      
      // Check if hook is already there in body
      const bodyLines = afterBrace.split('\n');
      let hasHookInBodyAfterBrace = false;
      for (let i = 0; i < Math.min(10, bodyLines.length); i++) {
        if (bodyLines[i].includes('const { t } = useLocalization()')) {
          hasHookInBodyAfterBrace = true;
          break;
        }
      }
      
      if (!hasHookInBodyAfterBrace) {
        // Find first non-whitespace, non-comment line after opening brace
        let insertIndex = 0;
        for (let i = 0; i < bodyLines.length; i++) {
          const trimmed = bodyLines[i].trim();
          if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*')) {
            insertIndex = i;
            break;
          }
        }
        
        // Insert hook call
        const indent = bodyLines[insertIndex].match(/^(\s*)/)?.[1] || '  ';
        bodyLines.splice(insertIndex, 0, `${indent}const { t } = useLocalization();`);
        content = content.substring(0, funcStart) + bodyLines.join('\n');
        modified = true;
      }
    }
  }

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Fixed: ${filePath}`);
    return true;
  }

  return false;
}

// Manual list of files that need fixing based on grep results
const filesToFix = [
  'src/components/ExpiredAccountMessage/index.tsx',
  'src/components/LoginSecurity/AccountLogin.tsx',
  'src/components/LoginSecurity/PinLogin.tsx',
  'src/components/modals/NoteModal.tsx',
  'src/components/modals/SettingsModal.tsx',
  'src/components/modals/AccountModal/index.tsx',
  'src/components/modals/FeedModal.tsx',
  'src/components/modals/BabyModal.tsx',
  'src/components/modals/ChangePinModal.tsx',
  'src/components/modals/CaretakerModal.tsx',
  'src/components/familymanager/AccountView.tsx',
  'src/components/familymanager/BetaSubscriberView.tsx',
  'src/components/familymanager/FamilyView.tsx',
  'src/components/familymanager/ActiveInviteView.tsx',
  'src/components/forms/DiaperForm/index.tsx',
  'src/components/forms/MeasurementForm/index.tsx',
  'src/components/forms/FeedbackForm/FeedbackMessagesView.tsx',
  'src/components/forms/FeedbackForm/FeedbackPage.tsx',
  'src/components/forms/FeedbackForm/index.tsx',
  'src/components/forms/BathForm/index.tsx',
  'src/components/forms/SleepForm/index.tsx',
  'src/components/forms/SettingsForm/index.tsx',
  'src/components/forms/NoteForm/index.tsx',
  'src/components/forms/PumpForm/index.tsx',
  'src/components/forms/MilestoneForm/index.tsx',
  'src/components/forms/FeedForm/SolidsFeedForm.tsx',
  'src/components/forms/FeedForm/BottleFeedForm.tsx',
  'src/components/forms/FeedForm/index.tsx',
  'src/components/forms/FamilyForm/index.tsx',
  'src/components/forms/AppConfigForm/index.tsx',
  'src/components/Calendar/index.tsx',
  'src/components/ui/account-expiration-banner/index.tsx',
  'src/components/ui/time-entry/index.tsx',
  'app/setup/[token]/page.tsx',
];

let fixedCount = 0;
for (const file of filesToFix) {
  if (fixFile(file)) {
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} files`);
