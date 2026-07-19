import { describe, it, expect } from 'vitest';
import {
  DAY_STORY_ROWS,
  TRACKING_CHIPS,
  LANDING_PLANS,
  FAQ_ITEMS,
} from '@/src/components/landing/landing-data';

describe('landing data', () => {
  it('has 5 day-story rows with icons and caretaker chips', () => {
    expect(DAY_STORY_ROWS).toHaveLength(5);
    for (const row of DAY_STORY_ROWS) {
      expect(row.icon.startsWith('/')).toBe(true);
      expect(row.title.length).toBeGreaterThan(0);
      expect(row.whoClass).toMatch(/^ld-w-(mom|dad|gma|nanny)$/);
    }
  });

  it('has 15 tracking chips pointing at existing public icons', () => {
    expect(TRACKING_CHIPS).toHaveLength(15);
    for (const chip of TRACKING_CHIPS) {
      expect(chip.icon).toMatch(/^\/[\w-]+\.(png|svg)$/);
      expect(chip.label.length).toBeGreaterThan(0);
    }
  });

  it('has the two plans with mockup prices', () => {
    expect(LANDING_PLANS).toHaveLength(2);
    const monthly = LANDING_PLANS.find((p) => p.id === 'monthly');
    const lifetime = LANDING_PLANS.find((p) => p.id === 'lifetime');
    expect(monthly?.price).toBe('$2.99');
    expect(monthly?.hot).toBe(true);
    expect(monthly?.features).toHaveLength(4);
    expect(lifetime?.price).toBe('$19.99');
    expect(lifetime?.features).toHaveLength(4);
  });

  it('has 6 FAQ items with non-empty answers', () => {
    expect(FAQ_ITEMS).toHaveLength(6);
    for (const item of FAQ_ITEMS) {
      expect(item.question.length).toBeGreaterThan(0);
      expect(item.answer.length).toBeGreaterThan(20);
    }
  });
});
