'use client';

import { useMemo } from 'react';

export interface NurseryColors {
  isLight: boolean;
  text: string;
  subtext: string;
  border: string;
  tileBg: string;
  tilePressed: string;
  logText: string;
  btnBg: string;
  btnHover: string;
  btnActive: string;
  accent: string;
  panelBg: string;
  label: string;
  sleepGlow: string;
}

export function useNurseryColors(hue: number, brightness: number): NurseryColors {
  return useMemo(() => {
    const isLight = brightness > 55;
    return {
      isLight,
      text: isLight ? `hsla(${hue}, 15%, 15%, 0.85)` : `hsla(${hue}, 15%, 95%, 0.85)`,
      subtext: isLight ? `hsla(${hue}, 10%, 30%, 0.5)` : `hsla(${hue}, 10%, 80%, 0.4)`,
      border: isLight ? `hsla(${hue}, 20%, 40%, 0.12)` : `hsla(${hue}, 20%, 80%, 0.08)`,
      tileBg: isLight ? `hsla(${hue}, 20%, 97%, 0.5)` : `hsla(${hue}, 20%, 18%, 0.35)`,
      tilePressed: isLight ? `hsla(${hue}, 25%, 92%, 0.7)` : `hsla(${hue}, 25%, 25%, 0.5)`,
      logText: isLight ? `hsla(${hue}, 12%, 25%, 0.6)` : `hsla(${hue}, 12%, 75%, 0.5)`,
      btnBg: isLight ? `hsla(${hue}, 18%, 90%, 0.55)` : `hsla(${hue}, 18%, 24%, 0.45)`,
      btnHover: isLight ? `hsla(${hue}, 22%, 84%, 0.7)` : `hsla(${hue}, 22%, 30%, 0.6)`,
      btnActive: isLight ? `hsla(${hue}, 28%, 78%, 0.8)` : `hsla(${hue}, 28%, 35%, 0.7)`,
      accent: isLight ? `hsla(${hue}, 30%, 45%, 0.7)` : `hsla(${hue}, 30%, 70%, 0.7)`,
      panelBg: isLight ? `hsla(${hue}, 15%, 96%, 0.92)` : `hsla(${hue}, 15%, 12%, 0.92)`,
      label: isLight ? `hsla(${hue}, 8%, 35%, 0.6)` : `hsla(${hue}, 8%, 70%, 0.5)`,
      sleepGlow: isLight ? `hsla(${hue}, 25%, 75%, 0.2)` : `hsla(${hue}, 25%, 40%, 0.15)`,
    };
  }, [hue, brightness]);
}
