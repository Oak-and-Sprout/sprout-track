import { describe, it, expect } from 'vitest';
import { sortFoodsByName, filterFoodsByQuery, formatFoodLogNote } from '@/src/utils/nursery/foodActivity';

describe('sortFoodsByName', () => {
  it('orders alphabetically by name', () => {
    const foods = [
      { id: 'c', name: 'Carrot' },
      { id: 'a', name: 'Apple' },
      { id: 'b', name: 'Banana' },
    ];
    expect(sortFoodsByName(foods).map(f => f.name)).toEqual(['Apple', 'Banana', 'Carrot']);
  });

  it('returns a new array and handles empty input', () => {
    const foods = [{ id: 'a', name: 'Apple' }];
    const out = sortFoodsByName(foods);
    expect(out).not.toBe(foods);
    expect(sortFoodsByName([])).toEqual([]);
  });
});

describe('filterFoodsByQuery', () => {
  const foods = [
    { id: 'a', name: 'Apple sauce' },
    { id: 'b', name: 'Banana purée' },
    { id: 'c', name: 'Sweet potato' },
  ];

  it('matches case-insensitive substrings', () => {
    expect(filterFoodsByQuery(foods, 'APPLE').map(f => f.id)).toEqual(['a']);
    expect(filterFoodsByQuery(foods, 'pot').map(f => f.id)).toEqual(['c']);
  });

  it('trims surrounding whitespace from the query', () => {
    expect(filterFoodsByQuery(foods, '  banana ').map(f => f.id)).toEqual(['b']);
  });

  it('returns everything for a blank query', () => {
    expect(filterFoodsByQuery(foods, '')).toEqual(foods);
    expect(filterFoodsByQuery(foods, '   ')).toEqual(foods);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterFoodsByQuery(foods, 'zucchini')).toEqual([]);
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
