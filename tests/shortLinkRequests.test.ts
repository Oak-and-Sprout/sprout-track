import { describe, it, expect } from 'vitest';
import { parseShortLinkInput, generateSlug } from '@/app/api/utils/short-links';

describe('parseShortLinkInput', () => {
  it('accepts a valid body and trims strings', () => {
    expect(parseShortLinkInput({ url: ' https://x.com/p ', name: ' Podcast ', description: '', tag: ' summer ' }))
      .toEqual({ url: 'https://x.com/p', name: 'Podcast', description: null, tag: 'summer' });
  });
  it('rejects missing/invalid url', () => {
    expect(() => parseShortLinkInput({ url: 'javascript:alert(1)', name: 'x' })).toThrow(/url/i);
    expect(() => parseShortLinkInput({ name: 'x' })).toThrow(/url/i);
  });
  it('rejects empty name', () => {
    expect(() => parseShortLinkInput({ url: 'https://x.com', name: '  ' })).toThrow(/name/i);
  });
  it('rejects overlong fields', () => {
    expect(() => parseShortLinkInput({ url: 'https://x.com', name: 'a'.repeat(201) })).toThrow(/name/i);
    expect(() => parseShortLinkInput({ url: 'https://x.com', name: 'x', tag: 'a'.repeat(101) })).toThrow(/tag/i);
  });
});

describe('generateSlug', () => {
  it('produces 8 lowercase hex chars, different across calls', () => {
    const a = generateSlug();
    const b = generateSlug();
    expect(a).toMatch(/^[0-9a-f]{8}$/);
    expect(new Set([a, b, generateSlug(), generateSlug()]).size).toBeGreaterThan(1);
  });
});
