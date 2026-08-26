import { describe, it, expect } from 'vitest';
import { qrLogoLayout, shouldDrawQr, qrSlugLabelLayout, drawSlugLabel } from '@/src/components/familymanager/short-link-qr-dialog';

describe('qrSlugLabelLayout', () => {
  it('scales font and paddings with QR size', () => {
    const big = qrSlugLabelLayout(1024);
    const small = qrSlugLabelLayout(256);
    expect(big.fontPx).toBeGreaterThan(small.fontPx);
    expect(big.boxPadX).toBeGreaterThan(0);
    expect(big.boxPadY).toBeGreaterThan(0);
    expect(big.rightPad).toBeGreaterThan(0);
    expect(big.bottomPad).toBeGreaterThan(0);
  });
});

describe('drawSlugLabel', () => {
  function makeCtx() {
    const calls: { fillText: unknown[][]; roundRect: number; fillRect: number } = { fillText: [], roundRect: 0, fillRect: 0 };
    const ctx = {
      font: '', textAlign: '', textBaseline: '', fillStyle: '',
      save() {}, restore() {},
      measureText: () => ({ width: 120 }),
      beginPath() {}, fill() {},
      roundRect() { calls.roundRect++; },
      fillRect() { calls.fillRect++; },
      fillText(...args: unknown[]) { calls.fillText.push(args); },
    } as unknown as CanvasRenderingContext2D;
    return { ctx, calls };
  }

  it('draws the slug on a backing box within the QR bounds', () => {
    const { ctx, calls } = makeCtx();
    drawSlugLabel(ctx, 'e4e9508d', 1024);
    expect(calls.roundRect).toBe(1);
    expect(calls.fillText).toHaveLength(1);
    const [text, x] = calls.fillText[0] as [string, number];
    expect(text).toBe('e4e9508d');
    expect(x).toBeLessThanOrEqual(1024); // stays inside the right edge
  });

  it('no-ops for an empty slug', () => {
    const { ctx, calls } = makeCtx();
    drawSlugLabel(ctx, '', 1024);
    expect(calls.fillText).toHaveLength(0);
  });

  it('falls back to a square box when roundRect is unavailable', () => {
    const { ctx, calls } = makeCtx();
    (ctx as unknown as { roundRect?: unknown }).roundRect = undefined;
    drawSlugLabel(ctx, 'abc12345', 1024);
    expect(calls.fillRect).toBe(1);
    expect(calls.fillText).toHaveLength(1);
  });
});

describe('shouldDrawQr', () => {
  const canvas = {} as HTMLCanvasElement;

  it('draws when canvas is mounted, dialog open, and url present', () => {
    expect(shouldDrawQr(canvas, true, 'https://x/go/abc')).toBe(true);
  });

  // Regression: the canvas lives in a portaled Radix DialogContent that mounts
  // after `open` flips, so the callback ref can fire while the ref is still null.
  it('does not draw when the canvas node is not yet mounted', () => {
    expect(shouldDrawQr(null, true, 'https://x/go/abc')).toBe(false);
  });

  it('does not draw when the dialog is closed', () => {
    expect(shouldDrawQr(canvas, false, 'https://x/go/abc')).toBe(false);
  });

  it('does not draw when the url is empty', () => {
    expect(shouldDrawQr(canvas, true, '')).toBe(false);
  });
});

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
