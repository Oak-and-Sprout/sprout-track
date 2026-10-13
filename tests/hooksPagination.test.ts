import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  buildOrderBy,
  buildRangeWhere,
  type PageCursor,
  decodeCursor,
  encodeCursor,
  paginate,
  parsePageParams,
} from '../app/api/hooks/v1/pagination';

const NOW = new Date('2026-10-13T12:00:00.000Z');
const params = (query: string) => new URLSearchParams(query);
const at = (iso: string) => new Date(iso);

describe('cursor encoding', () => {
  it('round-trips time, type and id', () => {
    const cursor = encodeCursor('2026-10-01T08:30:00.000Z', 'feed', 'abc123');
    expect(decodeCursor(cursor)).toEqual({ time: at('2026-10-01T08:30:00.000Z'), type: 'feed', id: 'abc123' });
  });

  it('is URL-safe', () => {
    const cursor = encodeCursor('2026-10-01T08:30:00.000Z', 'supplement', '???>>>');
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ['not base64 json', '!!!'],
    ['json but not an object', Buffer.from('"x"').toString('base64url')],
    ['missing id', Buffer.from(JSON.stringify({ t: '2026-10-01T00:00:00Z', k: 'feed' })).toString('base64url')],
    ['empty id', Buffer.from(JSON.stringify({ t: '2026-10-01T00:00:00Z', k: 'feed', id: '' })).toString('base64url')],
    ['bad time', Buffer.from(JSON.stringify({ t: 'nope', k: 'feed', id: 'a' })).toString('base64url')],
    ['unknown type', Buffer.from(JSON.stringify({ t: '2026-10-01T00:00:00Z', k: 'bogus', id: 'a' })).toString('base64url')],
    ['empty string', ''],
  ])('rejects %s', (_label, value) => {
    expect(decodeCursor(value)).toBeNull();
  });
});

describe('parsePageParams', () => {
  it('keeps the legacy defaults: limit 10, newest first, last 24 hours', () => {
    const result = parsePageParams(params(''), NOW);
    expect(result).toEqual({
      ok: true,
      limit: DEFAULT_PAGE_LIMIT,
      window: { since: at('2026-10-12T12:00:00.000Z'), until: undefined, cursor: undefined, order: 'desc' },
    });
  });

  it.each([
    ['until', 'until=2026-10-01T00:00:00Z'],
    ['cursor', `cursor=${encodeCursor('2026-10-01T00:00:00Z', 'feed', 'a')}`],
  ])('drops the 24-hour floor when %s is supplied', (_label, query) => {
    const result = parsePageParams(params(query), NOW);
    expect(result.ok && result.window.since).toBeUndefined();
  });

  it('parses since, until, cursor and order', () => {
    const cursor = encodeCursor('2025-09-01T00:00:00Z', 'diaper', 'd1');
    const result = parsePageParams(params(`since=2025-08-01&until=2025-10-01&order=asc&limit=75&cursor=${cursor}`), NOW);
    expect(result).toEqual({
      ok: true,
      limit: 75,
      window: {
        since: at('2025-08-01T00:00:00.000Z'),
        until: at('2025-10-01T00:00:00.000Z'),
        cursor: { time: at('2025-09-01T00:00:00.000Z'), type: 'diaper', id: 'd1' },
        order: 'asc',
      },
    });
  });

  it.each([
    ['0', DEFAULT_PAGE_LIMIT],
    ['-5', 1],
    ['abc', DEFAULT_PAGE_LIMIT],
    ['500', MAX_PAGE_LIMIT],
    ['200', 200],
  ])('clamps limit=%s to %d', (value, expected) => {
    const result = parsePageParams(params(`limit=${value}`), NOW);
    expect(result.ok && result.limit).toBe(expected);
  });

  it.each([
    ['since', 'since=yesterday', 'INVALID_TIME'],
    ['until', 'until=garbage', 'INVALID_TIME'],
    ['cursor', 'cursor=nope', 'INVALID_CURSOR'],
    ['order', 'order=sideways', 'INVALID_ORDER'],
  ])('rejects an invalid %s', (_label, query, code) => {
    const result = parsePageParams(params(query), NOW);
    expect(result).toMatchObject({ ok: false, code });
  });
});

describe('buildRangeWhere', () => {
  const since = at('2025-08-01T00:00:00Z');
  const until = at('2025-10-01T00:00:00Z');
  const ct = at('2025-09-01T00:00:00Z');

  it('bounds by since (inclusive) and until (exclusive) on the given field', () => {
    expect(buildRangeWhere('sleep', 'startTime', { since, until, order: 'desc' })).toEqual({
      AND: [{ startTime: { gte: since, lt: until } }],
    });
  });

  it('applies no time bound when the window is open', () => {
    expect(buildRangeWhere('feed', 'time', { order: 'desc' })).toEqual({ AND: [] });
  });

  describe('descending cursor', () => {
    it('same type: strictly older, or same time with a smaller id', () => {
      expect(buildRangeWhere('feed', 'time', { order: 'desc', cursor: { time: ct, type: 'feed', id: 'f5' } })).toEqual({
        AND: [{ OR: [{ time: { lt: ct } }, { time: ct, id: { lt: 'f5' } }] }],
      });
    });

    it('type sorting after the cursor type: rows at the cursor time are still ahead', () => {
      // desc order is (time desc, type desc): at equal time 'diaper' comes after 'feed'
      expect(buildRangeWhere('diaper', 'time', { order: 'desc', cursor: { time: ct, type: 'feed', id: 'f5' } })).toEqual({
        AND: [{ time: { lte: ct } }],
      });
    });

    it('type sorting before the cursor type: rows at the cursor time were already returned', () => {
      expect(buildRangeWhere('sleep', 'startTime', { order: 'desc', cursor: { time: ct, type: 'feed', id: 'f5' } })).toEqual({
        AND: [{ startTime: { lt: ct } }],
      });
    });
  });

  describe('ascending cursor', () => {
    it('same type: strictly newer, or same time with a larger id', () => {
      expect(buildRangeWhere('feed', 'time', { order: 'asc', cursor: { time: ct, type: 'feed', id: 'f5' } })).toEqual({
        AND: [{ OR: [{ time: { gt: ct } }, { time: ct, id: { gt: 'f5' } }] }],
      });
    });

    it('type sorting after the cursor type includes the cursor time', () => {
      expect(buildRangeWhere('sleep', 'startTime', { order: 'asc', cursor: { time: ct, type: 'feed', id: 'f5' } })).toEqual({
        AND: [{ startTime: { gte: ct } }],
      });
    });

    it('type sorting before the cursor type excludes the cursor time', () => {
      expect(buildRangeWhere('diaper', 'time', { order: 'asc', cursor: { time: ct, type: 'feed', id: 'f5' } })).toEqual({
        AND: [{ time: { gt: ct } }],
      });
    });
  });

  it('combines the window bounds with the cursor', () => {
    expect(buildRangeWhere('feed', 'time', { since, until, order: 'desc', cursor: { time: ct, type: 'feed', id: 'f5' } })).toEqual({
      AND: [{ time: { gte: since, lt: until } }, { OR: [{ time: { lt: ct } }, { time: ct, id: { lt: 'f5' } }] }],
    });
  });
});

describe('buildOrderBy', () => {
  it('orders by the time field then id, in the requested direction', () => {
    expect(buildOrderBy('startTime', 'desc')).toEqual([{ startTime: 'desc' }, { id: 'desc' }]);
    expect(buildOrderBy('date', 'asc')).toEqual([{ date: 'asc' }, { id: 'asc' }]);
  });
});

describe('paginate', () => {
  const item = (time: string, activityType: string, id: string) => ({ time, activityType, id });

  it('merges types newest first with (time, type, id) tie-breaks and reports hasMore', () => {
    const items = [
      item('2026-10-01T08:00:00.000Z', 'diaper', 'd1'),
      item('2026-10-01T09:00:00.000Z', 'feed', 'f1'),
      item('2026-10-01T08:00:00.000Z', 'feed', 'f2'),
      item('2026-10-01T08:00:00.000Z', 'feed', 'f3'),
    ];
    const result = paginate(items, 3, 'desc');
    expect(result.page.map((i) => i.id)).toEqual(['f1', 'f3', 'f2']);
    expect(result.hasMore).toBe(true);
    expect(decodeCursor(result.nextCursor!)).toEqual({ time: at('2026-10-01T08:00:00.000Z'), type: 'feed', id: 'f2' });
  });

  it('sorts oldest first for asc', () => {
    const items = [
      item('2026-10-01T09:00:00.000Z', 'feed', 'f1'),
      item('2026-10-01T08:00:00.000Z', 'feed', 'f2'),
      item('2026-10-01T08:00:00.000Z', 'diaper', 'd1'),
    ];
    expect(paginate(items, 10, 'asc').page.map((i) => i.id)).toEqual(['d1', 'f2', 'f1']);
  });

  it('returns no cursor on the last page', () => {
    const result = paginate([item('2026-10-01T08:00:00.000Z', 'feed', 'f1')], 1, 'desc');
    expect(result).toMatchObject({ hasMore: false, nextCursor: null });
    expect(result.page).toHaveLength(1);
  });

  it('handles an empty result', () => {
    expect(paginate([], 10, 'desc')).toEqual({ page: [], hasMore: false, nextCursor: null });
  });

  it.each(['desc', 'asc'] as const)('walks a multi-type history %s without gaps or repeats', (order) => {
    const all = [
      ...['a', 'b', 'c', 'd'].map((id) => item('2026-10-01T08:00:00.000Z', 'feed', id)),
      ...['a', 'b', 'c'].map((id) => item('2026-10-01T08:00:00.000Z', 'diaper', id)),
      item('2026-10-01T07:00:00.000Z', 'sleep', 's1'),
      item('2026-10-01T09:00:00.000Z', 'diaper', 'z'),
    ];
    // Mirrors buildRangeWhere: is `row` strictly after cursor `c` in `order`?
    const afterCursor = (row: ReturnType<typeof item>, c: PageCursor) => {
      const sign = order === 'desc' ? -1 : 1;
      const dt = Math.sign(new Date(row.time).getTime() - c.time.getTime()) * sign;
      if (dt !== 0) return dt > 0;
      if (row.activityType !== c.type) return (row.activityType > c.type ? 1 : -1) * sign > 0;
      return row.id !== c.id && (row.id > c.id ? 1 : -1) * sign > 0;
    };
    const limit = 2;
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let guard = 0; guard < 20; guard++) {
      const c: PageCursor | null = cursor ? decodeCursor(cursor) : null;
      // Each table returns its own first limit + 1 rows after the cursor, as the route does.
      const perTable: ReturnType<typeof item>[] = ['feed', 'diaper', 'sleep'].flatMap((type) =>
        paginate(all.filter((r) => r.activityType === type && (!c || afterCursor(r, c))), all.length, order).page.slice(0, limit + 1)
      );
      const result = paginate(perTable, limit, order);
      seen.push(...result.page.map((r) => `${r.activityType}:${r.id}`));
      if (!result.hasMore) break;
      cursor = result.nextCursor;
    }
    expect(seen).toEqual(paginate(all, all.length, order).page.map((r) => `${r.activityType}:${r.id}`));
    expect(new Set(seen).size).toBe(all.length);
  });
});
