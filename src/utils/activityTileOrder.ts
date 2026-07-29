/**
 * Default log-entry activity tile order. Keep in sync with
 * app/api/activity-settings/route.ts consumers.
 */
export const DEFAULT_ACTIVITY_TILE_ORDER = [
  'sleep',
  'feed',
  'food',
  'diaper',
  'note',
  'photo',
  'bath',
  'pump',
  'play',
  'measurement',
  'milestone',
  'medicine',
  'vaccine',
] as const;

export type DefaultActivityTileType = (typeof DEFAULT_ACTIVITY_TILE_ORDER)[number];

/**
 * Place the food tile immediately after feed when merging saved settings.
 * No-op when food is already present (user custom order is preserved).
 */
export function placeFoodTile(entry: {
  order?: string[];
  visible?: string[];
}): { changed: boolean; order: string[]; visible: string[] } {
  const order = Array.isArray(entry.order) ? [...entry.order] : [];
  const visible = Array.isArray(entry.visible) ? [...entry.visible] : [];
  let changed = false;

  if (!order.includes('food')) {
    const feedIndex = order.indexOf('feed');
    if (feedIndex !== -1 && visible.includes('feed')) {
      order.splice(feedIndex + 1, 0, 'food');
    } else {
      order.push('food');
    }
    changed = true;
  }
  if (!visible.includes('food')) {
    visible.push('food');
    changed = true;
  }

  return { changed, order, visible };
}

/**
 * Append any activity types from the default list that are missing from saved settings.
 */
export function mergeMissingActivityTiles(entry: {
  order?: string[];
  visible?: string[];
}): { order: string[]; visible: string[] } {
  let order = Array.isArray(entry.order) ? [...entry.order] : [];
  let visible = Array.isArray(entry.visible) ? [...entry.visible] : [];

  if (order.length === 0) {
    return {
      order: [...DEFAULT_ACTIVITY_TILE_ORDER],
      visible: [...DEFAULT_ACTIVITY_TILE_ORDER],
    };
  }

  const missing = DEFAULT_ACTIVITY_TILE_ORDER.filter((activity) => !order.includes(activity));
  if (missing.length === 0) {
    return { order, visible };
  }

  if (missing.includes('food')) {
    const placed = placeFoodTile({ order, visible });
    order = placed.order;
    visible = placed.visible;
  }

  const stillMissing = DEFAULT_ACTIVITY_TILE_ORDER.filter((activity) => !order.includes(activity));
  if (stillMissing.length > 0) {
    order.push(...stillMissing);
    for (const activity of stillMissing) {
      if (!visible.includes(activity)) {
        visible.push(activity);
      }
    }
  }

  return { order, visible };
}
