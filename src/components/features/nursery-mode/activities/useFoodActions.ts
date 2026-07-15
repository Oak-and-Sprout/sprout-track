'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocalization } from '@/src/context/localization';
import {
  FOOD_ENJOYMENT_DISPLAY_ORDER,
  FOOD_ENJOYMENT_EMOJI,
  FOOD_ENJOYMENT_LABELS,
  FoodEnjoymentValue,
} from '@/src/utils/foodLogUtils';
import { sortFoodsByFrequency, formatFoodLogNote, NurseryFoodItem } from '@/src/utils/nursery/foodActivity';
import { ActivityHookArgs, ActivityView, ActionButton, undoDeleteLog } from './types';

type FoodPhase = 'idle' | 'picking' | 'enjoyment';

/** How long the after-log enjoyment prompt lingers before falling back to idle. */
const ENJOYMENT_PROMPT_MS = 10000;

/**
 * Food activity state machine — one-tap logging against the family food
 * catalog (issue #203 models). Tap a food on the picker screen to POST a
 * food log at the current time; a transient enjoyment prompt then PUTs an
 * optional enjoyment onto the just-created entry. Amount/reactions/notes
 * stay in the full FoodForm.
 */
export function useFoodActions({ babyId, toUTCString, onLog, onUndoable }: ActivityHookArgs): ActivityView {
  const { t } = useLocalization();
  const [phase, setPhase] = useState<FoodPhase>('idle');
  const [catalog, setCatalog] = useState<NurseryFoodItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [lastLogged, setLastLogged] = useState<{ id: string; name: string } | null>(null);

  const getAuthHeaders = () => {
    const authToken = localStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      Authorization: authToken ? `Bearer ${authToken}` : '',
    };
  };

  const refreshCatalog = useCallback(async () => {
    try {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch('/api/food', {
        headers: { Authorization: authToken ? `Bearer ${authToken}` : '' },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCatalog(sortFoodsByFrequency(data.data));
      }
    } catch { /* keep the current catalog */ }
  }, []);

  // Fetch the family catalog on mount; re-read when the app becomes active
  // again (Android can resume a warm PWA without remounting its React tree).
  useEffect(() => {
    refreshCatalog();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshCatalog();
    };
    window.addEventListener('focus', refreshCatalog);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', refreshCatalog);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshCatalog]);

  // Reset any in-flight interaction when the selected baby changes.
  useEffect(() => {
    setPhase('idle');
    setLastLogged(null);
  }, [babyId]);

  // The enjoyment prompt is transient — fall back to idle if ignored.
  useEffect(() => {
    if (phase !== 'enjoyment') return;
    const timeout = setTimeout(() => {
      setPhase('idle');
      setLastLogged(null);
    }, ENJOYMENT_PROMPT_MS);
    return () => clearTimeout(timeout);
  }, [phase]);

  const submitFood = useCallback(async (food: NurseryFoodItem) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/food-log', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ babyId, foodId: food.id, time: toUTCString(new Date()) }),
      });
      const data = await res.json();
      if (data.success && data.data?.id) {
        const logId = data.data.id;
        onLog('food', formatFoodLogNote({ foodName: food.name }));
        onUndoable({
          tileId: 'food',
          message: t('Food logged'),
          undo: async () => {
            const ok = await undoDeleteLog('/api/food-log', logId);
            if (ok) {
              // Dismiss the enjoyment prompt — the log it would PUT onto is gone.
              setLastLogged(null);
              setPhase('idle');
            }
            return ok;
          },
        });
        setLastLogged({ id: logId, name: food.name });
        setPhase('enjoyment');
      } else {
        setPhase('idle');
      }
    } catch (err) {
      console.error('Error logging food:', err);
      setPhase('idle');
    } finally {
      setSubmitting(false);
    }
  }, [babyId, toUTCString, onLog, onUndoable, submitting, t]);

  const submitEnjoyment = useCallback(async (value: FoodEnjoymentValue) => {
    if (!lastLogged || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/food-log?id=${lastLogged.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ enjoyment: value }),
      });
      const data = await res.json();
      if (data.success) {
        onLog('food', formatFoodLogNote({ foodName: lastLogged.name, enjoymentLabel: t(FOOD_ENJOYMENT_LABELS[value]) }));
      }
      // A failed PUT usually means the entry was just undone — return to idle quietly.
    } catch (err) {
      console.error('Error saving enjoyment:', err);
    } finally {
      setSubmitting(false);
      setLastLogged(null);
      setPhase('idle');
    }
  }, [lastLogged, submitting, onLog, t]);

  let statusText: string | null = null;
  let buttons: ActionButton[];

  if (phase === 'picking') {
    statusText = t('Select Food');
    buttons = [
      ...catalog.map(food => ({
        key: food.id,
        label: food.name, // user data, not localized
        onClick: () => submitFood(food),
        disabled: submitting,
        // Tiles layout: keep the modal open so the enjoyment prompt that follows is visible.
        keepOpen: true,
      })),
      { key: 'cancel', label: t('Cancel'), onClick: () => setPhase('idle') },
    ];
  } else if (phase === 'enjoyment') {
    statusText = t('Enjoyed it?');
    buttons = [
      ...FOOD_ENJOYMENT_DISPLAY_ORDER.map(value => ({
        key: value,
        label: FOOD_ENJOYMENT_EMOJI[value],
        ariaLabel: t(FOOD_ENJOYMENT_LABELS[value]),
        onClick: () => submitEnjoyment(value),
        disabled: submitting,
      })),
      { key: 'skip', label: t('Skip'), onClick: () => { setLastLogged(null); setPhase('idle'); } },
    ];
  } else {
    const empty = catalog.length === 0;
    if (empty) statusText = t('Add foods from Log Entry first');
    buttons = [
      // BigTile auto-fires a lone keepOpen button without checking disabled — guard the empty case in onClick too.
      { key: 'log', label: t('Log Food'), onClick: () => { if (!empty) setPhase('picking'); }, wide: true, keepOpen: true, disabled: empty || submitting },
    ];
  }

  return {
    id: 'food',
    icon: 'food',
    label: t('Food'),
    statusText,
    active: false,
    question: phase === 'picking',
    buttonsWrap: phase === 'picking',
    buttons,
  };
}
