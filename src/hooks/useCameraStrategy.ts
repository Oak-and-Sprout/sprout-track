'use client';

import { useState, useEffect, useCallback } from 'react';
import { CameraStrategy, decideCameraStrategy } from '@/src/utils/photoUtils';
import { isNativeApp } from '@/src/utils/native-app';

/**
 * Decides how a "Take Photo" action should behave on this device:
 * - 'native-capture'  — touch-first device; a file input with capture="environment"
 *                       opens the OS camera.
 * - 'webcam-modal'    — fine-pointer device with getUserMedia; open the in-app
 *                       CameraCaptureModal.
 * - 'library-only'    — no camera path (e.g. insecure context); fall back to the
 *                       plain file picker.
 * Defaults to 'library-only' during SSR/first render.
 */
export function useCameraStrategy(): CameraStrategy {
  const [strategy, setStrategy] = useState<CameraStrategy>('library-only');

  const check = useCallback(() => {
    setStrategy(
      decideCameraStrategy({
        isNativeApp: isNativeApp(),
        coarsePointer: window.matchMedia('(pointer: coarse)').matches,
        maxTouchPoints: navigator.maxTouchPoints,
        hasMediaDevices: !!navigator.mediaDevices?.getUserMedia,
      })
    );
  }, []);

  useEffect(() => {
    check();
    const query = window.matchMedia('(pointer: coarse)');
    query.addEventListener('change', check);
    return () => query.removeEventListener('change', check);
  }, [check]);

  return strategy;
}
