import { describe, it, expect } from 'vitest';
import {
  FEED_TIMER_CATEGORIES,
  parseFeedTimerTypes,
  isValidFeedTimerTypes,
  feedCountsForTimer,
  foodCountsForTimer,
  buildFeedTimerWhere,
} from '@/src/utils/feedTimerConfig';

// Issue #225: per-baby configuration of which feed categories reset the
// "time since last feed" timer (breast feeds, breast-milk bottles, formula
// bottles, other bottles, food). null/invalid config = count everything.
// The legacy 'SOLIDS' category maps to 'FOOD' (solids became FoodLog, #203).

describe('FEED_TIMER_CATEGORIES', () => {
  it('exposes the five supported categories', () => {
    expect(FEED_TIMER_CATEGORIES).toEqual([
      'BREAST',
      'BOTTLE_BREAST_MILK',
      'BOTTLE_FORMULA',
      'BOTTLE_OTHER',
      'FOOD',
    ]);
  });
});

describe('parseFeedTimerTypes', () => {
  it('returns null for null/undefined (all feeds count)', () => {
    expect(parseFeedTimerTypes(null)).toBeNull();
    expect(parseFeedTimerTypes(undefined)).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseFeedTimerTypes('not-json')).toBeNull();
    expect(parseFeedTimerTypes('{"foo": 1}')).toBeNull();
    expect(parseFeedTimerTypes('')).toBeNull();
  });

  it('returns null for an empty array (treated as "all")', () => {
    expect(parseFeedTimerTypes('[]')).toBeNull();
  });

  it('parses a valid category list', () => {
    expect(parseFeedTimerTypes('["BREAST","FOOD"]')).toEqual(['BREAST', 'FOOD']);
  });

  it('maps the legacy SOLIDS category to FOOD', () => {
    expect(parseFeedTimerTypes('["BREAST","SOLIDS"]')).toEqual(['BREAST', 'FOOD']);
    expect(parseFeedTimerTypes('["SOLIDS"]')).toEqual(['FOOD']);
  });

  it('drops unknown values and returns null if none survive', () => {
    expect(parseFeedTimerTypes('["BREAST","NOPE"]')).toEqual(['BREAST']);
    expect(parseFeedTimerTypes('["NOPE"]')).toBeNull();
  });
});

describe('isValidFeedTimerTypes', () => {
  it('accepts null/undefined (all feeds count)', () => {
    expect(isValidFeedTimerTypes(null)).toBe(true);
    expect(isValidFeedTimerTypes(undefined)).toBe(true);
  });

  it('accepts a non-empty JSON array of known categories', () => {
    expect(isValidFeedTimerTypes('["BREAST"]')).toBe(true);
    expect(isValidFeedTimerTypes(JSON.stringify(FEED_TIMER_CATEGORIES))).toBe(true);
  });

  it('rejects malformed JSON and non-array JSON', () => {
    expect(isValidFeedTimerTypes('not-json')).toBe(false);
    expect(isValidFeedTimerTypes('')).toBe(false);
    expect(isValidFeedTimerTypes('{"BREAST":true}')).toBe(false);
    expect(isValidFeedTimerTypes('"BREAST"')).toBe(false);
  });

  it('rejects empty arrays (client stores null for "all")', () => {
    expect(isValidFeedTimerTypes('[]')).toBe(false);
  });

  it('rejects arrays containing unknown or non-string entries', () => {
    expect(isValidFeedTimerTypes('["BREAST","NOPE"]')).toBe(false);
    expect(isValidFeedTimerTypes('["BREAST",1]')).toBe(false);
    expect(isValidFeedTimerTypes('[null]')).toBe(false);
  });
});

describe('feedCountsForTimer', () => {
  it('counts everything when categories are null/undefined', () => {
    expect(feedCountsForTimer({ type: 'BREAST' }, null)).toBe(true);
    expect(feedCountsForTimer({ type: 'BOTTLE', bottleType: 'Formula' }, undefined)).toBe(true);
  });

  it('matches BREAST feeds against the BREAST category', () => {
    expect(feedCountsForTimer({ type: 'BREAST' }, ['BREAST'])).toBe(true);
    expect(feedCountsForTimer({ type: 'BREAST' }, ['BOTTLE_FORMULA'])).toBe(false);
  });

  it('maps bottle feeds by bottleType', () => {
    expect(feedCountsForTimer({ type: 'BOTTLE', bottleType: 'Breast Milk' }, ['BOTTLE_BREAST_MILK'])).toBe(true);
    expect(feedCountsForTimer({ type: 'BOTTLE', bottleType: 'Breast Milk' }, ['BOTTLE_FORMULA'])).toBe(false);
    expect(feedCountsForTimer({ type: 'BOTTLE', bottleType: 'Formula' }, ['BOTTLE_FORMULA'])).toBe(true);
    expect(feedCountsForTimer({ type: 'BOTTLE', bottleType: 'Formula' }, ['BOTTLE_BREAST_MILK'])).toBe(false);
  });

  it('counts mixed Formula/Breast bottles under either breast-milk or formula', () => {
    expect(feedCountsForTimer({ type: 'BOTTLE', bottleType: 'Formula/Breast' }, ['BOTTLE_BREAST_MILK'])).toBe(true);
    expect(feedCountsForTimer({ type: 'BOTTLE', bottleType: 'Formula/Breast' }, ['BOTTLE_FORMULA'])).toBe(true);
    expect(feedCountsForTimer({ type: 'BOTTLE', bottleType: 'Formula/Breast' }, ['BREAST'])).toBe(false);
  });

  it('treats Milk, Other, unknown and missing bottle types as BOTTLE_OTHER', () => {
    for (const bottleType of ['Milk', 'Other', 'Something Else', null, undefined]) {
      expect(feedCountsForTimer({ type: 'BOTTLE', bottleType }, ['BOTTLE_OTHER'])).toBe(true);
      expect(feedCountsForTimer({ type: 'BOTTLE', bottleType }, ['BOTTLE_FORMULA'])).toBe(false);
    }
  });

  it('returns false for unknown feed types', () => {
    expect(feedCountsForTimer({ type: 'WEIRD' }, ['BREAST'])).toBe(false);
  });
});

describe('foodCountsForTimer', () => {
  it('counts food when categories are null/undefined (all feeds count)', () => {
    expect(foodCountsForTimer(null)).toBe(true);
    expect(foodCountsForTimer(undefined)).toBe(true);
  });

  it('counts food only when the FOOD category is selected', () => {
    expect(foodCountsForTimer(['FOOD'])).toBe(true);
    expect(foodCountsForTimer(['BREAST', 'FOOD'])).toBe(true);
    expect(foodCountsForTimer(['BREAST'])).toBe(false);
    expect(foodCountsForTimer(['BOTTLE_FORMULA'])).toBe(false);
  });
});

describe('buildFeedTimerWhere', () => {
  it('returns an empty clause when categories are null/undefined (no filtering)', () => {
    expect(buildFeedTimerWhere(null)).toEqual({});
    expect(buildFeedTimerWhere(undefined)).toEqual({});
  });

  it('builds a simple clause for BREAST only', () => {
    expect(buildFeedTimerWhere(['BREAST'])).toEqual({
      OR: [{ type: 'BREAST' }],
    });
  });

  it('includes mixed bottles in both breast-milk and formula clauses', () => {
    expect(buildFeedTimerWhere(['BOTTLE_BREAST_MILK'])).toEqual({
      OR: [{ type: 'BOTTLE', bottleType: { in: ['Breast Milk', 'Formula/Breast'] } }],
    });
    expect(buildFeedTimerWhere(['BOTTLE_FORMULA'])).toEqual({
      OR: [{ type: 'BOTTLE', bottleType: { in: ['Formula', 'Formula/Breast'] } }],
    });
  });

  it('matches other bottles via null or unrecognized bottleType', () => {
    expect(buildFeedTimerWhere(['BOTTLE_OTHER'])).toEqual({
      OR: [
        {
          type: 'BOTTLE',
          OR: [
            { bottleType: null },
            { bottleType: { notIn: ['Breast Milk', 'Formula', 'Formula/Breast'] } },
          ],
        },
      ],
    });
  });

  it('adds no FeedLog clause for FOOD (food is a separate table)', () => {
    // FOOD is not a FeedLog row, so selecting only FOOD matches no feeds.
    expect(buildFeedTimerWhere(['FOOD'])).toEqual({ OR: [] });
    // FOOD alongside real feed categories does not add a FeedLog clause.
    expect(buildFeedTimerWhere(['BREAST', 'FOOD'])).toEqual({ OR: [{ type: 'BREAST' }] });
  });

  it('combines multiple categories into a single OR clause', () => {
    const where = buildFeedTimerWhere(['BREAST', 'BOTTLE_FORMULA']);
    expect(where).toEqual({
      OR: [
        { type: 'BREAST' },
        { type: 'BOTTLE', bottleType: { in: ['Formula', 'Formula/Breast'] } },
      ],
    });
  });
});
