'use client';

import { useCallback, useRef, useState } from 'react';
import { useCameraStrategy } from '@/src/hooks/useCameraStrategy';

/**
 * Wires a "Take Photo" action to the right mechanism for this device:
 * clicks the hidden capture input on touch-first devices (native camera),
 * opens CameraCaptureModal on desktops, or falls back to the library input.
 *
 * The consuming surface renders its own hidden inputs and modal:
 *   const camera = useTakePhoto((files) => addFiles(files));
 *   <input ref={camera.captureInputRef} type="file" accept="image/*" capture="environment" ... />
 *   <input ref={camera.libraryInputRef} type="file" accept="image/*" multiple ... />
 *   <CameraCaptureModal open={camera.cameraOpen} onClose={camera.closeCamera} onCapture={camera.handleCapture} />
 */
export function useTakePhoto(onFiles: (files: File[]) => void) {
  const strategy = useCameraStrategy();
  const captureInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const takePhoto = useCallback(() => {
    if (strategy === 'native-capture') captureInputRef.current?.click();
    else if (strategy === 'webcam-modal') setCameraOpen(true);
    else libraryInputRef.current?.click();
  }, [strategy]);

  const closeCamera = useCallback(() => setCameraOpen(false), []);
  const handleCapture = useCallback((file: File) => onFiles([file]), [onFiles]);

  return { strategy, takePhoto, cameraOpen, closeCamera, handleCapture, captureInputRef, libraryInputRef };
}
