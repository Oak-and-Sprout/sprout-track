import { describe, it, expect } from 'vitest';
import { layoutBreastFeedSession, SideBlock } from '@/src/utils/feedSessionLayout';

const at = (iso: string) => new Date(iso);
const diffSec = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 1000;

describe('layoutBreastFeedSession', () => {
  it('lays out LEFT then RIGHT contiguously when firstSide is LEFT and no pause', () => {
    const start = at('2026-07-20T21:00:00Z');
    const blocks = layoutBreastFeedSession({
      sessionStartTime: start,
      firstSide: 'LEFT',
      leftDuration: 600,
      rightDuration: 600,
      pauseDuration: 0,
    });
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ side: 'LEFT', duration: 600 });
    expect(blocks[0].startTime).toEqual(start);
    expect(blocks[0].endTime).toEqual(at('2026-07-20T21:10:00Z'));
    expect(blocks[1]).toMatchObject({ side: 'RIGHT', duration: 600 });
    expect(blocks[1].startTime).toEqual(at('2026-07-20T21:10:00Z'));
    expect(blocks[1].endTime).toEqual(at('2026-07-20T21:20:00Z'));
  });

  it('orders RIGHT then LEFT when firstSide is RIGHT', () => {
    const start = at('2026-07-20T21:00:00Z');
    const blocks = layoutBreastFeedSession({
      sessionStartTime: start,
      firstSide: 'RIGHT',
      leftDuration: 600,
      rightDuration: 600,
      pauseDuration: 0,
    });
    expect(blocks[0].side).toBe('RIGHT');
    expect(blocks[1].side).toBe('LEFT');
    expect(blocks[1].endTime).toEqual(at('2026-07-20T21:20:00Z'));
  });

  it('inserts the pause gap between the two side blocks', () => {
    const start = at('2026-07-20T21:00:00Z');
    const blocks = layoutBreastFeedSession({
      sessionStartTime: start,
      firstSide: 'LEFT',
      leftDuration: 600,
      rightDuration: 600,
      pauseDuration: 120,
    });
    expect(blocks).toHaveLength(2);
    expect(diffSec(blocks[0].endTime, blocks[1].startTime)).toBe(120);
    expect(blocks[1].endTime).toEqual(at('2026-07-20T21:22:00Z'));
  });

  it('consolidates alternating sides (L→R→L→R) into two contiguous blocks', () => {
    const start = at('2026-07-20T21:00:00Z');
    const blocks = layoutBreastFeedSession({
      sessionStartTime: start,
      firstSide: 'LEFT',
      leftDuration: 1200,
      rightDuration: 1200,
      pauseDuration: 120,
    });
    expect(blocks[0].side).toBe('LEFT');
    expect(blocks[0].startTime).toEqual(start);
    expect(blocks[0].endTime).toEqual(at('2026-07-20T21:20:00Z'));
    expect(blocks[1].side).toBe('RIGHT');
    expect(blocks[1].startTime).toEqual(at('2026-07-20T21:22:00Z'));
    expect(blocks[1].endTime).toEqual(at('2026-07-20T21:42:00Z'));
  });

  it('returns a single block when only one side has duration (pause ignored for layout)', () => {
    const start = at('2026-07-20T21:00:00Z');
    const blocks = layoutBreastFeedSession({
      sessionStartTime: start,
      firstSide: 'LEFT',
      leftDuration: 900,
      rightDuration: 0,
      pauseDuration: 60,
    });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].side).toBe('LEFT');
    expect(blocks[0].startTime).toEqual(start);
    expect(blocks[0].endTime).toEqual(at('2026-07-20T21:15:00Z'));
  });

  it('returns empty when both sides have zero duration', () => {
    const blocks = layoutBreastFeedSession({
      sessionStartTime: at('2026-07-20T21:00:00Z'),
      firstSide: 'LEFT',
      leftDuration: 0,
      rightDuration: 0,
      pauseDuration: 0,
    });
    expect(blocks).toHaveLength(0);
  });

  it('falls back to LEFT first when firstSide is null/undefined and both sides have time', () => {
    const start = at('2026-07-20T21:00:00Z');
    const blocks = layoutBreastFeedSession({
      sessionStartTime: start,
      firstSide: null,
      leftDuration: 600,
      rightDuration: 600,
      pauseDuration: 0,
    });
    expect(blocks[0].side).toBe('LEFT');
    expect(blocks[1].side).toBe('RIGHT');
  });

  it('honours duration overrides (e.g. from form adjustments)', () => {
    const start = at('2026-07-20T21:00:00Z');
    const blocks = layoutBreastFeedSession({
      sessionStartTime: start,
      firstSide: 'LEFT',
      leftDuration: 300,
      rightDuration: 300,
      pauseDuration: 0,
    });
    expect(blocks[0].endTime).toEqual(at('2026-07-20T21:05:00Z'));
    expect(blocks[1].endTime).toEqual(at('2026-07-20T21:10:00Z'));
  });
});
