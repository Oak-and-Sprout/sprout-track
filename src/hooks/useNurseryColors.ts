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
  smokeBg: string;
  glassHighlight: string;
  glassShadow: string;
}

export function useNurseryColors(hue: number, brightness: number, saturation: number): NurseryColors {
  return useMemo(() => {
    // Dim mapping:
    //   0-50%   → 0-45% lightness (dark, scaling toward full color)
    //   50-100% → 45-70% lightness (light, adding up to 25% whiteness)
    const dimL = brightness <= 50
      ? (brightness / 50) * 45
      : 45 + ((brightness - 50) / 50) * 25;
    // Saturation: 0-100 used directly as HSL saturation percentage
    const s = saturation;
    // Light mode flips at 50%
    const isLight = brightness > 50;

    if (isLight) {
      return {
        isLight,
        text: `hsla(${hue}, ${s * 0.15}%, 15%, 0.85)`,
        subtext: `hsla(${hue}, ${s * 0.10}%, 30%, 0.5)`,
        border: `hsla(${hue}, ${s * 0.20}%, 40%, 0.12)`,
        tileBg: `hsla(${hue}, ${s * 0.20}%, ${Math.min(dimL + 7, 97)}%, 0.5)`,
        tilePressed: `hsla(${hue}, ${s * 0.25}%, ${Math.min(dimL + 2, 92)}%, 0.7)`,
        logText: `hsla(${hue}, ${s * 0.12}%, 25%, 0.6)`,
        btnBg: `hsla(${hue}, ${s * 0.18}%, ${Math.min(dimL + 0, 90)}%, 0.55)`,
        btnHover: `hsla(${hue}, ${s * 0.22}%, ${Math.min(dimL - 6, 84)}%, 0.7)`,
        btnActive: `hsla(${hue}, ${s * 0.28}%, ${Math.min(dimL - 12, 78)}%, 0.8)`,
        accent: `hsla(${hue}, ${s * 0.30}%, 45%, 0.7)`,
        panelBg: `hsla(${hue}, ${s * 0.15}%, ${Math.min(dimL + 6, 96)}%, 0.92)`,
        label: `hsla(${hue}, ${s * 0.08}%, 35%, 0.6)`,
        sleepGlow: `hsla(${hue}, ${s * 0.25}%, ${Math.min(dimL - 5, 75)}%, 0.2)`,
        smokeBg: `hsla(${hue}, ${s * 0.08}%, 98%, 0.01)`,
        glassHighlight: `hsla(${hue}, ${s * 0.05}%, 100%, 0.20)`,
        glassShadow: `hsla(${hue}, ${s * 0.10}%, 30%, 0.10)`,
      };
    }

    return {
      isLight,
      text: `hsla(${hue}, ${s * 0.15}%, 95%, 0.85)`,
      subtext: `hsla(${hue}, ${s * 0.10}%, 80%, 0.4)`,
      border: `hsla(${hue}, ${s * 0.20}%, 80%, 0.08)`,
      tileBg: `hsla(${hue}, ${s * 0.20}%, ${Math.min(dimL + 5, 50)}%, 0.35)`,
      tilePressed: `hsla(${hue}, ${s * 0.25}%, ${Math.min(dimL + 10, 55)}%, 0.5)`,
      logText: `hsla(${hue}, ${s * 0.12}%, 75%, 0.5)`,
      btnBg: `hsla(${hue}, ${s * 0.18}%, ${Math.min(dimL + 8, 52)}%, 0.45)`,
      btnHover: `hsla(${hue}, ${s * 0.22}%, ${Math.min(dimL + 12, 55)}%, 0.6)`,
      btnActive: `hsla(${hue}, ${s * 0.28}%, ${Math.min(dimL + 15, 58)}%, 0.7)`,
      accent: `hsla(${hue}, ${s * 0.30}%, 70%, 0.7)`,
      panelBg: `hsla(${hue}, ${s * 0.15}%, ${Math.max(dimL - 2, 2)}%, 0.92)`,
      label: `hsla(${hue}, ${s * 0.08}%, 70%, 0.5)`,
      sleepGlow: `hsla(${hue}, ${s * 0.25}%, ${Math.min(dimL + 10, 50)}%, 0.15)`,
      smokeBg: `hsla(${(hue + 20) % 360}, ${s * 0.25}%, ${Math.min(dimL + 15, 55)}%, 0.01)`,
      glassHighlight: `hsla(${hue}, ${s * 0.10}%, 90%, 0.08)`,
      glassShadow: `hsla(${hue}, ${s * 0.15}%, 5%, 0.25)`,
    };
  }, [hue, brightness, saturation]);
}
