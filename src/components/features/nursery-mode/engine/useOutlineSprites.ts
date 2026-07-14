'use client';

import { useEffect, useState } from 'react';
import { spriteSetById, spriteUrl } from '../spriteManifest';
import { outlineSpriteUrl } from './recolorCache';

export interface OutlineSprites { urls: string[]; ars: number[] }

/**
 * Resolves every pose of a sprite set into outline-traced, hue-tinted blob URLs
 * (order matches manifest pose order). Returns null until resolved.
 */
export function useOutlineSprites(setId: string | null, hue: number): OutlineSprites | null {
  const [result, setResult] = useState<OutlineSprites | null>(null);
  const key = setId ? `${setId}|${hue}` : null;

  useEffect(() => {
    if (!setId) {
      setResult(null);
      return;
    }
    const set = spriteSetById(setId);
    if (!set) {
      setResult(null);
      return;
    }
    let live = true;
    Promise.all(set.poses.map(pose => outlineSpriteUrl(spriteUrl(setId, pose.file), hue))).then(assets => {
      if (!live) return;
      setResult({ urls: assets.map(a => a.objectUrl), ars: assets.map(a => a.ar) });
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return setId ? result : null;
}
