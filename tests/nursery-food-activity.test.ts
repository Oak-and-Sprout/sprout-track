import { describe, it, expect } from 'vitest';
import { sortFoodsByFrequency, formatFoodLogNote } from '@/src/utils/nursery/foodActivity';

describe('sortFoodsByFrequency', () => {
  it('orders by log count descending', () => {
    const foods = [
      { id: 'a', name: 'Apple', foodLogCount: 1 },
      { id: 'b', name: 'Banana', foodLogCount: 5 },
      { id: 'c', name: 'Carrot', foodLogCount: 3 },
    ];
    expect(sortFoodsByFrequency(foods).map(f => f.name)).toEqual(['Banana', 'Carrot', 'Apple']);
  });

  it('breaks count ties alphabetically by name', () => {
    const foods = [
      { id: 'p', name: 'Pear', foodLogCount: 2 },
      { id: 'a', name: 'Avocado', foodLogCount: 2 },
    ];
    expect(sortFoodsByFrequency(foods).map(f => f.name)).toEqual(['Avocado', 'Pear']);
  });

  it('treats a missing count as zero', () => {
    const foods = [
      { id: 'o', name: 'Oatmeal' },
      { id: 'b', name: 'Banana', foodLogCount: 1 },
    ];
    expect(sortFoodsByFrequency(foods).map(f => f.name)).toEqual(['Banana', 'Oatmeal']);
  });

  it('returns a new array and handles empty input', () => {
    const foods = [{ id: 'a', name: 'Apple', foodLogCount: 1 }];
    const out = sortFoodsByFrequency(foods);
    expect(out).not.toBe(foods);
    expect(sortFoodsByFrequency([])).toEqual([]);
  });
});

describe('formatFoodLogNote', () => {
  it('formats a food name alone', () => {
    expect(formatFoodLogNote({ foodName: 'Banana' })).toBe('Banana');
  });

  it('appends the enjoyment label when present', () => {
    expect(formatFoodLogNote({ foodName: 'Banana', enjoymentLabel: 'Loved' })).toBe('Banana · Loved');
  });

  it('ignores a null enjoyment label', () => {
    expect(formatFoodLogNote({ foodName: 'Banana', enjoymentLabel: null })).toBe('Banana');
  });
});
