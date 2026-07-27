import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PWA_ICONS, APPLE_TOUCH_ICON, buildManifestIcons } from '@/src/utils/pwa-icons';

const publicDir = path.join(process.cwd(), 'public');
const staticManifest = JSON.parse(
  fs.readFileSync(path.join(publicDir, 'manifest.json'), 'utf8')
);

describe('PWA icons', () => {
  it('advertises the square artwork, not the round favicon set', () => {
    for (const icon of PWA_ICONS) {
      expect(icon.src).toMatch(/^\/sprout-track-square-\d+\.png$/);
    }
    expect(APPLE_TOUCH_ICON).toMatch(/^\/sprout-track-square-\d+\.png$/);
  });

  it('references files that exist in public/', () => {
    for (const src of [...PWA_ICONS.map((i) => i.src), APPLE_TOUCH_ICON]) {
      expect(fs.existsSync(path.join(publicDir, src.slice(1)))).toBe(true);
    }
  });

  it('covers the sizes installers require, including a maskable 512', () => {
    const sizes = new Set(PWA_ICONS.map((i) => i.sizes));
    expect(sizes.has('192x192')).toBe(true);
    expect(sizes.has('512x512')).toBe(true);
    expect(
      PWA_ICONS.some((i) => i.sizes === '512x512' && i.purpose === 'maskable')
    ).toBe(true);
  });

  it('keeps the static manifest in sync with the per-family manifest route', () => {
    expect(staticManifest.icons).toEqual(buildManifestIcons());
  });
});
