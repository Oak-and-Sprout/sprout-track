import React, { useState, useEffect, useCallback, useId } from 'react';
import { FeedLogResponse } from '@/app/api/types';
import { Button } from '@/src/components/ui/button';
import { Label } from '@/src/components/ui/label';
import { Link2, Link2Off, Loader2 } from 'lucide-react';
import { useTimezone } from '@/app/context/timezone';
import { useLocalization } from '@/src/context/localization';
import { useToast } from '@/src/components/ui/toast';
import {
  groupBreastFeedSessions,
  newFeedSessionId,
  BreastFeedSession,
} from '@/src/utils/feedSessionUtils';

import './feed-form.css';

/**
 * Shown when editing a breast feed entry: lists the feeds linked into this
 * nursing session (counted as one feeding) and the nearest breast feeds before
 * and after it, with link/unlink actions.
 *
 * Linking assigns all involved rows a shared sessionId. Unlinking gives the row
 * its own fresh sessionId, which also opts it out of the time-based grouping
 * heuristic so it stays separate.
 */

// How far around the edited feed to look for linkable neighbors
const NEARBY_WINDOW_MS = 24 * 60 * 60 * 1000;

interface LinkedFeedsSectionProps {
  activity: FeedLogResponse;
  babyId: string;
  disabled?: boolean;
  /** Display-only: show the session's linked feeds without link/unlink actions
   *  or nearby candidates; renders nothing when the feed isn't linked. */
  readOnly?: boolean;
}

export default function LinkedFeedsSection({
  activity,
  babyId,
  disabled = false,
  readOnly = false,
}: LinkedFeedsSectionProps) {
  const { t } = useLocalization();
  const { formatDateTime } = useTimezone();
  const sessionLabelId = useId();
  const nearbyLabelId = useId();
  const { showToast } = useToast();
  const [nearbyFeeds, setNearbyFeeds] = useState<FeedLogResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchNearbyFeeds = useCallback(async () => {
    try {
      setIsLoading(true);
      const authToken = localStorage.getItem('authToken');
      const center = new Date(activity.time).getTime();
      const startDate = new Date(center - NEARBY_WINDOW_MS).toISOString();
      const endDate = new Date(center + NEARBY_WINDOW_MS).toISOString();
      const response = await fetch(
        `/api/feed-log?babyId=${babyId}&type=BREAST&startDate=${startDate}&endDate=${endDate}`,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      if (!response.ok) throw new Error('Failed to fetch nearby feeds');
      const data = await response.json();
      setNearbyFeeds(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error('Error fetching nearby feeds:', error);
      setNearbyFeeds([]);
    } finally {
      setIsLoading(false);
    }
  }, [activity.time, babyId]);

  useEffect(() => {
    fetchNearbyFeeds();
  }, [fetchNearbyFeeds]);

  // Persist a row's sessionId. The PUT handler nulls notes when absent from the
  // body, so the row's existing notes are re-sent alongside.
  const putSessionId = async (row: FeedLogResponse, sessionId: string) => {
    const authToken = localStorage.getItem('authToken');
    const response = await fetch(`/api/feed-log?id=${row.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken ? `Bearer ${authToken}` : '',
      },
      body: JSON.stringify({ sessionId, ...(row.notes ? { notes: row.notes } : {}) }),
    });
    if (!response.ok) throw new Error('Failed to update linked feeds');
  };

  const sessions = groupBreastFeedSessions(nearbyFeeds);
  const mySession: BreastFeedSession<FeedLogResponse> | undefined =
    sessions.find(s => s.rows.some(r => r.id === activity.id));
  const members = mySession?.rows ?? [];
  const memberIds = new Set(members.map(r => r.id));
  const otherFeeds = nearbyFeeds
    .filter(f => !memberIds.has(f.id))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const sessionStart = mySession ? mySession.time.getTime() : 0;
  const sessionEnd = members.length > 0
    ? Math.max(...members.map(m => new Date(m.time).getTime()))
    : 0;
  const feedBefore = [...otherFeeds].reverse().find(f => new Date(f.time).getTime() < sessionStart);
  const feedAfter = otherFeeds.find(f => new Date(f.time).getTime() > sessionEnd);

  const handleLink = async (neighbor: FeedLogResponse) => {
    setBusyId(neighbor.id);
    try {
      let sid = mySession?.sessionId;
      if (!sid) {
        // Heuristic-only session: give all current members an explicit shared id first
        sid = newFeedSessionId();
        await Promise.all(members.map(m => putSessionId(m, sid!)));
      }
      await putSessionId(neighbor, sid);
      await fetchNearbyFeeds();
    } catch (error) {
      console.error('Error linking feed:', error);
      showToast({ variant: 'error', title: t('Error'), message: t('Failed to update linked feeds'), duration: 5000 });
    } finally {
      setBusyId(null);
    }
  };

  const handleUnlink = async (member: FeedLogResponse) => {
    setBusyId(member.id);
    try {
      // A fresh unique sessionId detaches the row and opts it out of heuristic grouping
      await putSessionId(member, newFeedSessionId());
      await fetchNearbyFeeds();
    } catch (error) {
      console.error('Error unlinking feed:', error);
      showToast({ variant: 'error', title: t('Error'), message: t('Failed to update linked feeds'), duration: 5000 });
    } finally {
      setBusyId(null);
    }
  };

  const describeFeed = (feed: FeedLogResponse) => {
    const side = feed.side === 'LEFT' ? t('Left Side') : feed.side === 'RIGHT' ? t('Right Side') : t('Breast');
    const seconds = feed.feedDuration || (feed.amount ? feed.amount * 60 : 0);
    const minutes = Math.round(seconds / 60);
    return `${side} • ${minutes} ${t('min')} • ${formatDateTime(feed.time)}`;
  };

  const renderRow = (feed: FeedLogResponse, linked: boolean) => (
    <div
      key={feed.id}
      className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs linked-feeds-item"
    >
      <span className="truncate">
        {describeFeed(feed)}
        {feed.id === activity.id && ` (${t('This entry')})`}
      </span>
      {!readOnly && (feed.id !== activity.id || linked) ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 flex-shrink-0"
          onClick={(e) => {
            e.preventDefault();
            if (linked) handleUnlink(feed); else handleLink(feed);
          }}
          disabled={disabled || busyId !== null || (linked && members.length < 2)}
          title={linked ? t('Unlink') : t('Link')}
        >
          {busyId === feed.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : linked ? (
            <Link2Off className="h-3.5 w-3.5 text-red-500" />
          ) : (
            <Link2 className="h-3.5 w-3.5 text-teal-600" />
          )}
        </Button>
      ) : null}
    </div>
  );

  if (isLoading) {
    if (readOnly) return null;
    return (
      <div className="mt-4 flex justify-center py-2">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      </div>
    );
  }

  // Nothing to show in display-only mode unless the feed is part of a session
  if (readOnly && members.length < 2) return null;

  return (
    <div className="mt-4 linked-feeds-section">
      <Label className="form-label" id={sessionLabelId}>{t('Nursing Session')}</Label>
      <p className="text-xs text-gray-500 mb-2 linked-feeds-hint">
        {t('Feeds linked into this session count as one feeding.')}
      </p>
      <div className="space-y-1" role="group" aria-labelledby={sessionLabelId}>
        {members.map(m => renderRow(m, true))}
      </div>
      {!readOnly && (feedBefore || feedAfter) && (
        <>
          <Label className="form-label mt-3 block" id={nearbyLabelId}>{t('Nearby feeds')}</Label>
          <div className="space-y-1" role="group" aria-labelledby={nearbyLabelId}>
            {feedBefore && renderRow(feedBefore, false)}
            {feedAfter && renderRow(feedAfter, false)}
          </div>
        </>
      )}
    </div>
  );
}
