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
  const settingsRef = useRef<NurserySettings>(settings);
  settingsRef.current = settings;

  const getCaretakerId = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem('caretakerId');
  }, []);

  const fetchSettings = useCallback(async () => {
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

  const updateSettings = useCallback(
    (patch: Partial<NurserySettings>) => {
      const merged = normalizeNurserySettings({ ...settingsRef.current, ...patch });
      setSettings(merged);
      writeLocalMirror(merged);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          const caretakerId = getCaretakerId();
          const authToken = typeof window !== 'undefined' ? window.localStorage.getItem('authToken') : null;
          await fetch('/api/nursery-mode-settings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: authToken ? `Bearer ${authToken}` : '',
            },
            body: JSON.stringify({ caretakerId, settings: merged }),
          });
        } catch (err) {
          console.error('Failed to save nursery mode settings:', err);
        }
      }, 500);
    },
    [getCaretakerId]
  );

  return { settings, isLoading, updateSettings };
}
