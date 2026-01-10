#!/usr/bin/env node

/**
 * Script to fix hook placement issues where useLocalization hook
 * was incorrectly placed in function parameter lists
 */

const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/components/ui/time-entry/index.tsx',
  'src/components/ui/account-expiration-banner/index.tsx',
  'src/components/Calendar/index.tsx',
  'src/components/forms/AppConfigForm/index.tsx',
  'src/components/forms/FamilyForm/index.tsx',
  'src/components/forms/FeedForm/index.tsx',
  'src/components/forms/FeedForm/BottleFeedForm.tsx',
  'src/components/forms/FeedForm/SolidsFeedForm.tsx',
  'src/components/forms/MilestoneForm/index.tsx',
  'src/components/forms/PumpForm/index.tsx',
  'src/components/forms/NoteForm/index.tsx',
  'src/components/forms/SettingsForm/index.tsx',
  'src/components/forms/SleepForm/index.tsx',
  'src/components/forms/BathForm/index.tsx',
  'src/components/forms/BabyForm/BabyForm.tsx',
  'src/components/forms/FeedbackForm/index.tsx',
  'src/components/forms/FeedbackForm/FeedbackPage.tsx',
  'src/components/forms/FeedbackForm/FeedbackMessagesView.tsx',
  'src/components/forms/MeasurementForm/index.tsx',
  'src/components/forms/CaretakerForm/CaretakerForm.tsx',
  'src/components/forms/DiaperForm/index.tsx',
  'src/components/familymanager/ActiveInviteView.tsx',
  'src/components/familymanager/FamilyView.tsx',
  'src/components/familymanager/BetaSubscriberView.tsx',
  'src/components/familymanager/AccountView.tsx',
  'src/components/modals/CaretakerModal.tsx',
  'src/components/modals/ChangePinModal.tsx',
  'src/components/modals/BabyModal.tsx',
  'src/components/modals/FeedModal.tsx',
  'src/components/modals/AccountModal/index.tsx',
  'src/components/modals/SettingsModal.tsx',
  'src/components/modals/NoteModal.tsx',
  'src/components/debugTimezone/index.tsx',
  'src/components/LoginSecurity/PinLogin.tsx',
  'src/components/LoginSecurity/AccountLogin.tsx',
  'src/components/ExpiredAccountMessage/index.tsx',
  'app/family-select/page.tsx',
  'app/setup/[token]/page.tsx',
  'app/setup/page.tsx',
  'app/family-manager/page.tsx',
  'app/account/family-setup/page.tsx',
  'app/account/payment-cancelled/page.tsx',
];

function fixFile(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  // Pattern 1: export default function ComponentName({  const { t } = useLocalization();
  const pattern1 = /(export\s+(default\s+)?function\s+\w+\s*\(\{)\s*const\s+\{\s*t\s*\}\s*=\s*useLocalization\(\);/g;
  if (pattern1.test(content)) {
    content = content.replace(pattern1, '$1');
    modified = true;
  }

  // Pattern 2: export function ComponentName({  const { t } = useLocalization();
  const pattern2 = /(export\s+function\s+\w+\s*\(\{)\s*const\s+\{\s*t\s*\}\s*=\s*useLocalization\(\);/g;
  if (pattern2.test(content)) {
    content = content.replace(pattern2, '$1');
    modified = true;
  }

  // Pattern 3: export default function ComponentName() {  const { t } = useLocalization();
  const pattern3 = /(export\s+(default\s+)?function\s+\w+\s*\(\)\s*\{)\s*const\s+\{\s*t\s*\}\s*=\s*useLocalization\(\);/g;
  if (pattern3.test(content)) {
    content = content.replace(pattern3, '$1\n  const { t } = useLocalization();');
    modified = true;
  }

  // Now we need to add the hook call inside the function body if it's missing
  // Look for function body opening brace and add hook if not present
  const functionBodyPattern = /(export\s+(default\s+)?function\s+\w+[^{]*\{)\s*([^}]*?)(const\s+\[|const\s+\{|\/\/|if\s*\(|return|useState|useEffect)/;
  
  // Check if hook is already in function body
  if (!content.includes('const { t } = useLocalization()') || content.match(/export.*function.*\{.*const { t } = useLocalization()/)) {
    // Find the function and add hook after opening brace
    const functionMatch = content.match(/(export\s+(default\s+)?function\s+\w+[^{]*\{)/);
    if (functionMatch) {
      const funcStart = functionMatch.index + functionMatch[0].length;
      const afterBrace = content.substring(funcStart);
      
      // Check if hook is already there
      if (!afterBrace.trim().startsWith('const { t } = useLocalization()')) {
        // Find first non-whitespace line after opening brace
        const lines = afterBrace.split('\n');
        let insertIndex = 0;
        for (let i = 0; i < lines.length; i++) {
          const trimmed = lines[i].trim();
          if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
            insertIndex = i;
            break;
          }
        }
        
        // Insert hook call
        const indent = lines[insertIndex].match(/^(\s*)/)?.[1] || '  ';
        lines.splice(insertIndex, 0, `${indent}const { t } = useLocalization();`);
        content = content.substring(0, funcStart) + lines.join('\n');
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

let fixedCount = 0;
for (const file of filesToFix) {
  if (fixFile(file)) {
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} files`);
