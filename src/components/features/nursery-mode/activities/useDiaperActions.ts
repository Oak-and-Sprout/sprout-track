'use client';

import { useState, useCallback } from 'react';
import { useLocalization } from '@/src/context/localization';
import { ActivityHookArgs, ActivityView, undoDeleteLog } from './types';

/**
 * Diaper activity — transplanted 1:1 from DiaperTile.tsx.
 * Instant POST /api/diaper-log with one-tap undo support.
 */
export function useDiaperActions({ babyId, toUTCString, onLog, onUndoable }: ActivityHookArgs): ActivityView {
  const { t } = useLocalization();
  const [submitting, setSubmitting] = useState(false);

  const submitDiaper = useCallback(async (type: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const now = toUTCString(new Date());
      const res = await fetch('/api/diaper-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authToken ? `Bearer ${authToken}` : '',
        },
        body: JSON.stringify({ babyId, time: now, type }),
      });
      const data = await res.json();
      if (data.success) {
        const labels: Record<string, string> = { WET: t('Wet'), DIRTY: t('Dirty'), BOTH: t('Both'), DRY: t('Dry') };
        onLog('diaper', labels[type] || type);
        if (data.data?.id) {
          const messages: Record<string, string> = {
            WET: t('Wet diaper logged'),
            DIRTY: t('Dirty diaper logged'),
            BOTH: t('Diaper logged'),
            DRY: t('Dry diaper logged'),
          };
          const logId = data.data.id;
          onUndoable({
            tileId: 'diaper',
            message: messages[type] || t('Diaper logged'),
            undo: () => undoDeleteLog('/api/diaper-log', logId),
          });
        }
      }
    } catch (err) {
      console.error('Error logging diaper:', err);
    } finally {
      setSubmitting(false);
    }
  }, [babyId, toUTCString, onLog, onUndoable, submitting, t]);

  return {
    id: 'diaper',
    icon: 'diaper',
    label: t('Diaper'),
    statusText: null,
    active: false,
    question: false,
    // Four buttons (Wet/Dirty/Both/Dry) no longer fit one nowrap row at narrow widths
    // in longer-label locales (e.g. Italian, Dutch); wrap instead of silently
    // overflowing past the card with no scroll affordance.
    buttonsWrap: true,
    buttons: [
      { key: 'wet', label: t('Wet'), onClick: () => submitDiaper('WET'), disabled: submitting },
      { key: 'dirty', label: t('Dirty'), onClick: () => submitDiaper('DIRTY'), disabled: submitting },
      { key: 'both', label: t('Both'), onClick: () => submitDiaper('BOTH'), disabled: submitting },
      { key: 'dry', label: t('Dry'), onClick: () => submitDiaper('DRY'), disabled: submitting },
    ],
  };
}
