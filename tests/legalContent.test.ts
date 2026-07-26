import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

function read(name: string): string {
  return readFileSync(path.join(__dirname, '..', 'public', name), 'utf-8');
}

describe('legal content', () => {
  it('terms of use has the new July 2026 content', () => {
    const terms = read('terms_of_use.md');
    expect(terms).toContain('# Terms of Use');
    expect(terms).toContain('Effective Date: July 17, 2026');
    expect(terms).toContain('Open Glades LLC');
    expect(terms).toContain('State of Kansas');
    expect(terms).toContain('sprout-track@jroverton.com');
    expect(terms).toContain('## 11. International Users');
  });

  it('privacy policy has the new July 2026 content', () => {
    const privacy = read('privacy_policy.md');
    expect(privacy).toContain('# Privacy Policy');
    expect(privacy).toContain('Effective Date: July 17, 2026');
    expect(privacy).toContain('GDPR');
    expect(privacy).toContain('California Consumer Privacy Act');
    expect(privacy).toContain('We DO NOT');
    expect(privacy).toContain('sprout-track@jroverton.com');
  });

  it('uses only the markdown dialect the renderer supports', () => {
    for (const name of ['terms_of_use.md', 'privacy_policy.md']) {
      const content = read(name);
      expect(content).not.toMatch(/\[[^\]]+\]\([^)]+\)/); // no md links
      expect(content).not.toContain('<a ');               // no html
    }
  });
});
