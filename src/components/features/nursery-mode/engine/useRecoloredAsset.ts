'use client';

import { useEffect, useState } from 'react';
import { recoloredSvgUrl, RasterAsset } from './recolorCache';

/**
 * Resolves a single-pose SVG recolored to the given base/palette into a
 * session-cached blob URL + aspect ratio. Returns null until resolved.
 */
export function useRecoloredAsset(url: string | null, base: string, colors: string[]): RasterAsset | null {
  const [result, setResult] = useState<RasterAsset | null>(null);
  const key = url ? `${url}|${base}|${colors.join()}` : null;

  useEffect(() => {
    if (!url) {
      setResult(null);
      return;
    }
    let live = true;
    recoloredSvgUrl(url, base, colors).then(asset => {
      if (live) setResult(asset);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return url ? result : null;
}
