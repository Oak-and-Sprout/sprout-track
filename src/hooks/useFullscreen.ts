'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Cross-browser fullscreen API hook.
 * Supports: standard, webkit (Safari/older Chrome), moz (Firefox), ms (IE/Edge legacy)
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const doc = document.documentElement as any;
    setIsSupported(
      typeof doc.requestFullscreen === 'function' ||
      typeof doc.webkitRequestFullscreen === 'function' ||
      typeof doc.mozRequestFullScreen === 'function' ||
      typeof doc.msRequestFullscreen === 'function'
    );

    const handleChange = () => {
      const doc = document as any;
      const active = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      setIsFullscreen(active);
    };

    document.addEventListener('fullscreenchange', handleChange);
    document.addEventListener('webkitfullscreenchange', handleChange);
    document.addEventListener('mozfullscreenchange', handleChange);
    document.addEventListener('MSFullscreenChange', handleChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
      document.removeEventListener('webkitfullscreenchange', handleChange);
      document.removeEventListener('mozfullscreenchange', handleChange);
      document.removeEventListener('MSFullscreenChange', handleChange);
    };
  }, []);

  const enter = useCallback(async (element?: HTMLElement) => {
    const el = (element || elementRef.current || document.documentElement) as any;
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        // Safari — webkitRequestFullscreen accepts a flag
        await el.webkitRequestFullscreen((Element as any).ALLOW_KEYBOARD_INPUT);
      } else if (el.mozRequestFullScreen) {
        await el.mozRequestFullScreen();
      } else if (el.msRequestFullscreen) {
        await el.msRequestFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen request failed:', err);
    }
  }, []);

  const exit = useCallback(async () => {
    const doc = document as any;
    try {
      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        await doc.mozCancelFullScreen();
      } else if (doc.msExitFullscreen) {
        await doc.msExitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen exit failed:', err);
    }
  }, []);

  const toggle = useCallback(async (element?: HTMLElement) => {
    if (isFullscreen) {
      await exit();
    } else {
      await enter(element);
    }
  }, [isFullscreen, enter, exit]);

  return { isFullscreen, isSupported, enter, exit, toggle, elementRef };
}
