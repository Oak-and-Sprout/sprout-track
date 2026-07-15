'use client';

import { useEffect, useState } from 'react';
import { recoloredSvgUrl, RasterAsset } from './recolorCache';

/**
 * Resolves a single-pose SVG recolored to the given palette into a
 * session-cached blob URL + aspect ratio. Returns null until resolved.
 */
export function useRecoloredAsset(url: string | null, palette: string[]): RasterAsset | null {
  const [result, setResult] = useState<RasterAsset | null>(null);
  const key = url ? `${url}|${palette.join()}` : null;

  useEffect(() => {
    if (!url) {
      setResult(null);
      return;
    }
    let live = true;
    recoloredSvgUrl(url, palette).then(asset => {
      if (live) setResult(asset);
    }).catch(err => {
      // Leave state null; the cache entry was evicted so a re-render can retry.
      if (live) console.error('useRecoloredAsset failed:', err);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return url ? result : null;
}
