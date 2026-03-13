'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface NurseryModeSettings {
  hue: number;
  brightness: number;
  saturation: number;
  visibleTiles: string[];
}

const DEFAULT_SETTINGS: NurseryModeSettings = {
  hue: 230,
  brightness: 15,
  saturation: 25,
  visibleTiles: ['feed', 'pump', 'diaper', 'sleep'],
};

export function useNurserySettings(caretakerId: string | null) {
  const [settings, setSettings] = useState<NurseryModeSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const authToken = localStorage.getItem('authToken');
        const params = caretakerId ? `?caretakerId=${caretakerId}` : '';
        const res = await fetch(`/api/nursery-mode-settings${params}`, {
          headers: { Authorization: authToken ? `Bearer ${authToken}` : '' },
        });
        const data = await res.json();
        if (data.success && data.data) {
          setSettings({ ...DEFAULT_SETTINGS, ...data.data });
        }
      } catch (err) {
        console.error('Failed to fetch nursery mode settings:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [caretakerId]);

  const saveSettings = useCallback(
    (newSettings: NurseryModeSettings) => {
      setSettings(newSettings);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          const authToken = localStorage.getItem('authToken');
          await fetch('/api/nursery-mode-settings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: authToken ? `Bearer ${authToken}` : '',
            },
            body: JSON.stringify({ ...newSettings, caretakerId }),
          });
        } catch (err) {
          console.error('Failed to save nursery mode settings:', err);
        }
      }, 500);
    },
    [caretakerId]
  );

  return { settings, isLoading, saveSettings };
}
