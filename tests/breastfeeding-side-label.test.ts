import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const TRANSLATIONS_DIR = path.join(ROOT, 'src/localization/translations');

// Issue #166: the breastfeeding side label was built by translating fragments and
// composing them ("Left" + t('Side') → "Left Côté", then t(side) + " Side" →
// "Gauche Side"). The t() fallback returns unknown keys verbatim, so composed keys
// silently render half-translated. Guard the whole-phrase-key approach.
describe('breastfeeding side label localization (issue #166)', () => {
  it('every language file translates the whole-phrase keys "Left Side" and "Right Side"', () => {
    const files = readdirSync(TRANSLATIONS_DIR).filter(f => f.endsWith('.json'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const translations = JSON.parse(readFileSync(path.join(TRANSLATIONS_DIR, file), 'utf8'));
      expect(translations['Left Side'], `"Left Side" missing/empty in ${file}`).toBeTruthy();
      expect(translations['Right Side'], `"Right Side" missing/empty in ${file}`).toBeTruthy();
    }
  });

  it('TimelineV2ActivityList uses whole-phrase side keys, not composed translation keys', () => {
    const source = readFileSync(
      path.join(ROOT, 'src/components/Timeline/TimelineV2/TimelineV2ActivityList.tsx'),
      'utf8'
    );
    // The regression that shipped in v1.3.4: t(`${side} Side`) where `side` was already translated
    expect(source).not.toMatch(/t\(`\$\{[^}]*\} Side`\)/);
    expect(source).toContain("t(activity.side === 'LEFT' ? 'Left Side' : 'Right Side')");
  });
});
