'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { NurserySettings, NURSERY_DEFAULTS, normalizeNurserySettings } from '@/src/utils/nursery/settings';

const STORAGE_KEY = 'nurseryModeSettingsV1';

function readLocalMirror(): NurserySettings {
  if (typeof window === 'undefined') {
    return NURSERY_DEFAULTS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return NURSERY_DEFAULTS;
    return normalizeNurserySettings(JSON.parse(raw));
  } catch {
    return NURSERY_DEFAULTS;
  }
}

function writeLocalMirror(settings: NurserySettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota/storage errors
  }
}

export function useNurserySettings(): {
  settings: NurserySettings;
  isLoading: boolean;
  updateSettings: (patch: Partial<NurserySettings>) => void;
} {
  const [settings, setSettings] = useState<NurserySettings>(readLocalMirror);
  const [isLoading, setIsLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSettingsRef = useRef<NurserySettings | null>(null);
  const inflightSavesRef = useRef(0);
  const settingsRef = useRef<NurserySettings>(settings);
  settingsRef.current = settings;

  const getCaretakerId = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem('caretakerId');
  }, []);

  const postSettings = useCallback(
    async (toSave: NurserySettings) => {
      inflightSavesRef.current += 1;
      try {
        const caretakerId = getCaretakerId();
        const authToken = typeof window !== 'undefined' ? window.localStorage.getItem('authToken') : null;
        await fetch('/api/nursery-mode-settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authToken ? `Bearer ${authToken}` : '',
          },
          body: JSON.stringify({ caretakerId, settings: toSave }),
        });
      } catch (err) {
        console.error('Failed to save nursery mode settings:', err);
      } finally {
        inflightSavesRef.current -= 1;
      }
    },
    [getCaretakerId]
  );

  const fetchSettings = useCallback(async () => {
    // Don't clobber a local edit that hasn't been persisted yet: skip the
    // refetch while a debounced save is scheduled or a POST is in flight
    // (last-write-wins — the next focus refetch will reconcile).
    if (debounceRef.current !== null || inflightSavesRef.current > 0) {
      setIsLoading(false);
      return;
    }
    try {
      const caretakerId = getCaretakerId();
      const authToken = typeof window !== 'undefined' ? window.localStorage.getItem('authToken') : null;
      const params = caretakerId ? `?caretakerId=${caretakerId}` : '';
      const res = await fetch(`/api/nursery-mode-settings${params}`, {
        headers: { Authorization: authToken ? `Bearer ${authToken}` : '' },
      });
      const data = await res.json();
      if (data.success && data.data) {
        const normalized = normalizeNurserySettings(data.data);
        setSettings(normalized);
        writeLocalMirror(normalized);
      }
    } catch (err) {
      console.error('Failed to fetch nursery mode settings:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getCaretakerId]);

  useEffect(() => {
    fetchSettings();

    const onFocus = () => {
      fetchSettings();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchSettings]);

  // On unmount, flush any debounce-pending save immediately so the final
  // edit isn't lost (value is already normalized and mirrored locally).
  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        const toSave = pendingSettingsRef.current;
        pendingSettingsRef.current = null;
        if (toSave) postSettings(toSave);
      }
    };
  }, [postSettings]);

  const updateSettings = useCallback(
    (patch: Partial<NurserySettings>) => {
      const merged = normalizeNurserySettings({ ...settingsRef.current, ...patch });
      setSettings(merged);
      writeLocalMirror(merged);

      pendingSettingsRef.current = merged;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        pendingSettingsRef.current = null;
        postSettings(merged);
      }, 500);
    },
    [postSettings]
  );

  return { settings, isLoading, updateSettings };
}
