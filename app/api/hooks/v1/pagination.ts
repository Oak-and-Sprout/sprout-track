// Keyset pagination for GET /babies/:babyId/activities (issue #290). Activities
// live in separate tables, so the page order is (time, activityType, id): each
// table is queried for its first limit + 1 rows after the cursor, the results
// are merged, and the first `limit` rows form the page. Tie-breaking on the
// activity type means ids are only ever compared within one table.

export const ACTIVITY_TYPES = ['sleep', 'feed', 'diaper', 'note', 'pump', 'play', 'bath', 'measurement', 'medicine', 'supplement', 'food'] as const;
export type ActivityType = typeof ACTIVITY_TYPES[number];

export const DEFAULT_PAGE_LIMIT = 10;
export const MAX_PAGE_LIMIT = 200;
const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;

export type SortOrder = 'asc' | 'desc';

export interface PageCursor {
  time: Date;
  type: ActivityType;
  id: string;
}

export interface PageWindow {
  since?: Date;
  until?: Date;
  cursor?: PageCursor;
  order: SortOrder;
}

export type PageParamsResult =
  | { ok: true; limit: number; window: PageWindow }
  | { ok: false; code: 'INVALID_TIME' | 'INVALID_CURSOR' | 'INVALID_ORDER'; message: string };

export function encodeCursor(time: string | Date, type: string, id: string): string {
  const t = typeof time === 'string' ? time : time.toISOString();
  return Buffer.from(JSON.stringify({ t, k: type, id })).toString('base64url');
}

export function decodeCursor(value: string): PageCursor | null {
  try {
    const raw = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    const time = new Date(raw?.t);
    if (typeof raw?.t !== 'string' || isNaN(time.getTime())) return null;
    if (!ACTIVITY_TYPES.includes(raw.k)) return null;
    if (typeof raw.id !== 'string' || !raw.id) return null;
    return { time, type: raw.k, id: raw.id };
  } catch {
    return null;
  }
}

/**
 * Reads limit/since/until/cursor/order. With none of since, until or cursor,
 * the window keeps its legacy default of the last 24 hours.
 */
export function parsePageParams(params: URLSearchParams, now: Date = new Date()): PageParamsResult {
  const parsedLimit = parseInt(params.get('limit') || String(DEFAULT_PAGE_LIMIT), 10) || DEFAULT_PAGE_LIMIT;
  const limit = Math.min(Math.max(parsedLimit, 1), MAX_PAGE_LIMIT);

  const order = params.get('order') || 'desc';
  if (order !== 'asc' && order !== 'desc') {
    return { ok: false, code: 'INVALID_ORDER', message: `Invalid order '${order}'. Use 'asc' or 'desc'.` };
  }

  const dates: { since?: Date; until?: Date } = {};
  for (const name of ['since', 'until'] as const) {
    const value = params.get(name);
    if (!value) continue;
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return { ok: false, code: 'INVALID_TIME', message: `Invalid '${name}'. Use ISO 8601.` };
    }
    dates[name] = date;
  }

  const cursorParam = params.get('cursor');
  const cursor = cursorParam ? decodeCursor(cursorParam) : undefined;
  if (cursor === null) {
    return { ok: false, code: 'INVALID_CURSOR', message: "Invalid 'cursor'. Pass the nextCursor value from a previous response." };
  }

  const since = dates.since ?? (dates.until || cursor ? undefined : new Date(now.getTime() - DEFAULT_WINDOW_MS));
  return { ok: true, limit, window: { since, until: dates.until, cursor, order } };
}

/**
 * Prisma `where` fragment bounding `field` by the window and positioning it
 * after the cursor, for a table holding rows of `type`. Spread into the
 * table's where clause.
 */
export function buildRangeWhere(type: ActivityType, field: string, window: PageWindow): { AND: Record<string, unknown>[] } {
  const AND: Record<string, unknown>[] = [];
  if (window.since || window.until) {
    AND.push({ [field]: { ...(window.since && { gte: window.since }), ...(window.until && { lt: window.until }) } });
  }

  const cursor = window.cursor;
  if (cursor) {
    const desc = window.order === 'desc';
    const past = desc ? 'lt' : 'gt';
    if (type === cursor.type) {
      AND.push({ OR: [{ [field]: { [past]: cursor.time } }, { [field]: cursor.time, id: { [past]: cursor.id } }] });
    } else {
      // At the cursor's time, a type later in page order than the cursor's has
      // not been returned yet; an earlier one already has.
      const laterInPage = desc ? type < cursor.type : type > cursor.type;
      AND.push({ [field]: { [laterInPage ? (desc ? 'lte' : 'gte') : past]: cursor.time } });
    }
  }
  return { AND };
}

export function buildOrderBy(field: string, order: SortOrder) {
  return [{ [field]: order }, { id: order }];
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Merges rows from every table into page order and cuts the page. */
export function paginate<T extends { time: string; activityType: string; id: string }>(
  items: T[],
  limit: number,
  order: SortOrder
): { page: T[]; hasMore: boolean; nextCursor: string | null } {
  const sign = order === 'desc' ? -1 : 1;
  const sorted = [...items].sort((a, b) =>
    sign * (new Date(a.time).getTime() - new Date(b.time).getTime() || compare(a.activityType, b.activityType) || compare(a.id, b.id))
  );
  const page = sorted.slice(0, limit);
  const hasMore = sorted.length > limit;
  const last = page[page.length - 1];
  return { page, hasMore, nextCursor: hasMore ? encodeCursor(last.time, last.activityType, last.id) : null };
}
