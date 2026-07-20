'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { chooseWakeLockMechanism, getCapacitorPlugin } from '@/src/utils/native-app';

interface KeepAwakePlugin {
  keepAwake(): Promise<void>;
  allowSleep(): Promise<void>;
}

function keepAwakePlugin(): KeepAwakePlugin | null {
  return getCapacitorPlugin<KeepAwakePlugin>('KeepAwake');
}

function mechanism(): 'plugin' | 'browser' | 'none' {
  return chooseWakeLockMechanism({
    hasKeepAwakePlugin: keepAwakePlugin() !== null,
    hasWakeLockApi: 'wakeLock' in navigator,
  });
}

export function useWakeLock() {
  const [isActive, setIsActive] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    setIsSupported(mechanism() !== 'none');
  }, []);

  const request = useCallback(async () => {
    const how = mechanism();
    if (how === 'none') return;
    try {
      if (how === 'plugin') {
        await keepAwakePlugin()!.keepAwake();
        setIsActive(true);
        return;
      }
      sentinelRef.current = await navigator.wakeLock.request('screen');
      setIsActive(true);
      sentinelRef.current.addEventListener('release', () => {
        setIsActive(false);
      });
    } catch (err) {
      console.error('Wake Lock request failed:', err);
      setIsActive(false);
    }
  }, []);

  const release = useCallback(async () => {
    if (mechanism() === 'plugin') {
      try {
        await keepAwakePlugin()!.allowSleep();
      } catch {
        // Already released
      }
      setIsActive(false);
      return;
    }
    if (sentinelRef.current) {
      try {
        await sentinelRef.current.release();
      } catch {
        // Already released
      }
      sentinelRef.current = null;
      setIsActive(false);
    }
  }, []);

  // Auto-acquire on mount and re-acquire on visibility change
  useEffect(() => {
    if (mechanism() === 'none') return;

    request();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        request();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      release();
    };
  }, [request, release]);

  return { isActive, isSupported, request, release };
}
