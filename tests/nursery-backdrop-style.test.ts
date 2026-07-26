import { describe, it, expect } from 'vitest';
import { backdropStyle, isRug } from '@/src/components/features/nursery-mode/scenes/backdropStyle';
import { backdropTint } from '@/src/utils/nursery/colorMath';

const BASE = '#f2e9d8';
const TINT = backdropTint(BASE);

describe('backdropStyle', () => {
  it('vstripe/hstripe/dstripe: repeating-linear-gradient at 90/0/45deg', () => {
    expect(backdropStyle('vstripe', BASE)).toEqual({
      background: `repeating-linear-gradient(90deg, ${BASE} 0 30px, ${TINT} 30px 37px)`,
    });
    expect(backdropStyle('hstripe', BASE)).toEqual({
      background: `repeating-linear-gradient(0deg, ${BASE} 0 30px, ${TINT} 30px 37px)`,
    });
    expect(backdropStyle('dstripe', BASE)).toEqual({
      background: `repeating-linear-gradient(45deg, ${BASE} 0 30px, ${TINT} 30px 37px)`,
    });
  });

  it('zigzag: four-gradient chevron with offset positions', () => {
    const style = backdropStyle('zigzag', BASE);
    expect(style.backgroundColor).toBe(BASE);
    expect(style.backgroundImage).toBe(
      `linear-gradient(135deg, ${TINT} 25%, transparent 25%),linear-gradient(225deg, ${TINT} 25%, transparent 25%),linear-gradient(315deg, ${TINT} 25%, transparent 25%),linear-gradient(45deg, ${TINT} 25%, transparent 25%)`,
    );
    expect(style.backgroundPosition).toBe('-26px 0,-26px 0,0 0,0 0');
    expect(style.backgroundSize).toBe('52px 52px');
  });

  it('dots: two offset radial-gradient dot layers', () => {
    const style = backdropStyle('dots', BASE);
    expect(style.backgroundColor).toBe(BASE);
    expect(style.backgroundImage).toBe(
      `radial-gradient(${TINT} 4px, transparent 5px),radial-gradient(${TINT} 4px, transparent 5px)`,
    );
    expect(style.backgroundSize).toBe('46px 46px');
    expect(style.backgroundPosition).toBe('0 0,23px 23px');
  });

  it('checks: repeating-conic-gradient block pattern', () => {
    const style = backdropStyle('checks', BASE);
    expect(style.backgroundColor).toBe(BASE);
    expect(style.backgroundImage).toBe(`repeating-conic-gradient(${TINT} 0 25%, transparent 0 50%)`);
    expect(style.backgroundSize).toBe('68px 68px');
  });

  it('scallops: two offset radial-gradient scallop layers', () => {
    const style = backdropStyle('scallops', BASE);
    expect(style.backgroundColor).toBe(BASE);
    expect(style.backgroundImage).toBe(
      `radial-gradient(circle at 50% 120%, ${TINT} 0 14px, transparent 15px 100%),radial-gradient(circle at 50% 120%, ${TINT} 0 14px, transparent 15px 100%)`,
    );
    expect(style.backgroundSize).toBe('48px 24px');
    expect(style.backgroundPosition).toBe('0 0,24px 12px');
  });

  it('plain and unknown kinds fall back to a flat background', () => {
    expect(backdropStyle('plain', BASE)).toEqual({ background: BASE });
    expect(backdropStyle('nonsense', BASE)).toEqual({ background: BASE });
  });
});

describe('isRug', () => {
  it('identifies rug: prefixed ids', () => {
    expect(isRug('rug:paisley-1')).toBe(true);
    expect(isRug('vstripe')).toBe(false);
    expect(isRug('plain')).toBe(false);
  });
});
