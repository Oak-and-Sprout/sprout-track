import { describe, it, expect } from 'vitest';
import { formatAmount } from '@/src/utils/formatAmount';

describe('formatAmount (issue #280)', () => {
  it('removes float accumulation error', () => {
    expect(formatAmount(0.1 + 0.2)).toBe('0.3');
    expect(formatAmount(0.3 * 3)).toBe('0.9');
    expect(formatAmount(0.3 + 0.3 + 0.3)).toBe('0.9');
  });

  it('keeps integers and strips trailing zeros', () => {
    expect(formatAmount(3)).toBe('3');
    expect(formatAmount(2.5)).toBe('2.5');
    expect(formatAmount(1.2)).toBe('1.2');
    expect(formatAmount(0)).toBe('0');
  });

  it('rounds to two decimals', () => {
    expect(formatAmount(1.236)).toBe('1.24');
    expect(formatAmount(1.004)).toBe('1');
  });

  it('handles large and negative values', () => {
    expect(formatAmount(123456.7)).toBe('123456.7');
    expect(formatAmount(1e6 + 0.1 + 0.2)).toBe('1000000.3');
    expect(formatAmount(-0.1 - 0.2)).toBe('-0.3');
  });

  it('does not emit "-0" or throw on non-finite input', () => {
    expect(formatAmount(-0.001)).toBe('0');
    expect(formatAmount(NaN)).toBe('0');
    expect(formatAmount(Infinity)).toBe('0');
  });
});
