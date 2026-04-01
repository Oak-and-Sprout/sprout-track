import { useRef, useCallback } from 'react';
import { ActivityType } from '../types';
import { getActivityTime } from '../utils';

interface CacheEntry {
  activities: ActivityType[];
  fetchedAt: number;
}

interface FetchResult {
  activities: ActivityType[];
  allActivities: ActivityType[]; // all activities from the full fetched window
}

const STALE_MS = 5 * 60 * 1000; // 5 minutes

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function bucketByDate(activities: ActivityType[]): Map<string, ActivityType[]> {
  const buckets = new Map<string, ActivityType[]>();
  for (const activity of activities) {
    const timeStr = getActivityTime(activity);
    const date = new Date(timeStr);
    const key = toDateKey(date);
    const bucket = buckets.get(key) || [];
    bucket.push(activity);
    buckets.set(key, bucket);

    // For overnight sleep, also add to the start-date bucket
    if ('duration' in activity && 'startTime' in activity && 'endTime' in activity && activity.endTime) {
      const startKey = toDateKey(new Date(activity.startTime as string));
      if (startKey !== key) {
        const startBucket = buckets.get(startKey) || [];
        startBucket.push(activity);
        buckets.set(startKey, startBucket);
      }
    }
  }
  return buckets;
}

function buildDateRange(centerDate: Date, radius: number): { startDate: Date; endDate: Date; dateKeys: string[] } {
  const startDate = new Date(centerDate);
  startDate.setDate(startDate.getDate() - radius);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(centerDate);
  endDate.setDate(endDate.getDate() + radius);
  endDate.setHours(23, 59, 59, 999);

  const dateKeys: string[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    dateKeys.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return { startDate, endDate, dateKeys };
}

export function useActivityCache() {
  const cache = useRef<Map<string, CacheEntry>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const heatmapCache = useRef<{ activities: ActivityType[]; fetchedAt: number; windowKey: string } | null>(null);

  const isCached = useCallback((dateKey: string): boolean => {
    const entry = cache.current.get(dateKey);
    if (!entry) return false;
    const todayKey = toDateKey(new Date());
    // Today's data is always considered stale (refreshed by polling)
    if (dateKey === todayKey) return false;
    return (Date.now() - entry.fetchedAt) < STALE_MS;
  }, []);

  const getActivitiesForDate = useCallback((dateKey: string): ActivityType[] | null => {
    const entry = cache.current.get(dateKey);
    if (!entry) return null;
    return entry.activities;
  }, []);

  const fetchFromApi = useCallback(async (
    babyId: string,
    startDate: Date,
    endDate: Date,
    signal?: AbortSignal,
    types?: string
  ): Promise<ActivityType[]> => {
    const timestamp = Date.now();
    const startDateISO = startDate.toISOString();
    const endDateISO = endDate.toISOString();

    let url = `/api/timeline?babyId=${babyId}&startDate=${encodeURIComponent(startDateISO)}&endDate=${encodeURIComponent(endDateISO)}&_t=${timestamp}`;
    if (types) {
      url += `&types=${encodeURIComponent(types)}`;
    }

    const authToken = localStorage.getItem('authToken');
    const response = await fetch(url, {
      cache: 'no-store',
      signal,
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Expires': '0',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch activities:', response.statusText);
      return [];
    }

    const data = await response.json();
    return data.success ? data.data : [];
  }, []);

  const fetchWindow = useCallback(async (
    babyId: string,
    centerDate: Date,
    radius: number = 1
  ): Promise<FetchResult> => {
    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const { startDate, endDate, dateKeys } = buildDateRange(centerDate, radius);

    // Check which dates we actually need to fetch
    const uncachedKeys = dateKeys.filter(key => !isCached(key));

    // If everything is cached, return from cache
    if (uncachedKeys.length === 0) {
      const centerKey = toDateKey(centerDate);
      const allActivities: ActivityType[] = [];
      for (const key of dateKeys) {
        const cached = getActivitiesForDate(key);
        if (cached) allActivities.push(...cached);
      }
      return {
        activities: getActivitiesForDate(centerKey) || [],
        allActivities
      };
    }

    try {
      const activities = await fetchFromApi(babyId, startDate, endDate, controller.signal);

      // Bucket into per-day cache
      const buckets = bucketByDate(activities);
      const now = Date.now();

      // Store each day's bucket in cache
      for (const key of dateKeys) {
        cache.current.set(key, {
          activities: buckets.get(key) || [],
          fetchedAt: now
        });
      }

      const centerKey = toDateKey(centerDate);
      return {
        activities: cache.current.get(centerKey)?.activities || [],
        allActivities: activities
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Request was cancelled by a newer request — return empty
        return { activities: [], allActivities: [] };
      }
      console.error('Error fetching activities:', error);
      return { activities: [], allActivities: [] };
    }
  }, [isCached, getActivitiesForDate, fetchFromApi]);

  const refreshDate = useCallback(async (
    babyId: string,
    date: Date
  ): Promise<ActivityType[]> => {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    try {
      const activities = await fetchFromApi(babyId, startDate, endDate);
      const dateKey = toDateKey(date);
      cache.current.set(dateKey, {
        activities,
        fetchedAt: Date.now()
      });
      return activities;
    } catch (error) {
      console.error('Error refreshing date:', error);
      return cache.current.get(toDateKey(date))?.activities || [];
    }
  }, [fetchFromApi]);

  const invalidateDate = useCallback((date: Date) => {
    cache.current.delete(toDateKey(date));
  }, []);

  const invalidateAll = useCallback(() => {
    cache.current.clear();
    heatmapCache.current = null;
  }, []);

  const fetchHeatmap = useCallback(async (
    babyId: string,
    selectedDate: Date
  ): Promise<ActivityType[]> => {
    const startOfWindow = new Date(selectedDate);
    startOfWindow.setHours(0, 0, 0, 0);
    startOfWindow.setDate(startOfWindow.getDate() - 29);

    const endOfWindow = new Date(selectedDate);
    endOfWindow.setHours(23, 59, 59, 999);

    const windowKey = `${toDateKey(startOfWindow)}_${toDateKey(endOfWindow)}`;

    // Check if we have a valid cached heatmap for this window
    if (heatmapCache.current &&
        heatmapCache.current.windowKey === windowKey &&
        (Date.now() - heatmapCache.current.fetchedAt) < STALE_MS) {
      return heatmapCache.current.activities;
    }

    try {
      const activities = await fetchFromApi(babyId, startOfWindow, endOfWindow, undefined, 'sleep,feed,diaper,pump');
      heatmapCache.current = {
        activities,
        fetchedAt: Date.now(),
        windowKey
      };
      return activities;
    } catch (error) {
      console.error('Error fetching heatmap data:', error);
      return heatmapCache.current?.activities || [];
    }
  }, [fetchFromApi]);

  return {
    fetchWindow,
    refreshDate,
    getActivitiesForDate,
    invalidateDate,
    invalidateAll,
    isCached,
    fetchHeatmap,
    toDateKey,
  };
}

export { toDateKey };
