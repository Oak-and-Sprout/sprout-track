import { describe, it, expect } from 'vitest';
import { qrLogoLayout } from '@/src/components/familymanager/short-link-qr-dialog';

describe('qrLogoLayout', () => {
  it('sizes logo at 20% with padded tile centered', () => {
    expect(qrLogoLayout(1024)).toEqual({ logoSize: 205, tileSize: 254, offset: 385, tileRadius: 38 });
  });
  it('scales for display size', () => {
    const l = qrLogoLayout(256);
    expect(l.logoSize).toBe(51);
    expect(l.offset * 2 + l.tileSize).toBeGreaterThanOrEqual(255); // stays centered within a pixel
  });
});
