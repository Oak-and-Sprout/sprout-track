'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { spriteSetById, spriteUrl } from '../spriteManifest';
import { recoloredSvgUrl } from '../engine/recolorCache';
import { useDebouncedValue } from '../engine/useDebouncedValue';
import { placeScatter, mulberry32, PlacedItem } from '@/src/utils/nursery/placement';

interface SpriteAssets { urls: string[]; ars: number[] }

/**
 * Resolves every pose of a sprite set into recolored (pattern-color-tinted) blob
 * URLs, in manifest pose order. Returns null while unset/unresolved.
 */
function useRecoloredSpriteSet(setId: string | null, colors: string[]): SpriteAssets | null {
  const [result, setResult] = useState<SpriteAssets | null>(null);
  const key = setId ? `${setId}|${colors.join()}` : null;

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
    Promise.all(set.poses.map(pose => recoloredSvgUrl(spriteUrl(setId, pose.file), colors))).then(assets => {
      if (!live) return;
      setResult({ urls: assets.map(a => a.objectUrl), ars: assets.map(a => a.ar) });
    }).catch(err => {
      if (live) {
        setResult(null);
        console.error('useRecoloredSpriteSet failed:', err);
      }
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return setId ? result : null;
}

export interface ScatterLayerProps {
  primary: string | null;
  accent: string | null;
  colors: string[];
}

/**
 * Dart-throws recolored sprite poses across the tapestry backdrop: a dense
 * primary set, plus a sparser accent set that avoids the primary items. Ported
 * from nursery.jsx:173-216 (ScatterLayer + throwDarts), using per-pose whole-file
 * sprites in place of the prototype's sprite-sheet slicing/background-position math.
 */
export function ScatterLayer({ primary, accent, colors }: ScatterLayerProps) {
  // Debounced: each color tweak would otherwise re-recolor and re-cache a
  // permanent blob URL per pose on every input event while dragging a swatch.
  const debouncedColors = useDebouncedValue(colors, 200);
  const primaryAssets = useRecoloredSpriteSet(primary, debouncedColors);
  const accentAssets = useRecoloredSpriteSet(accent, debouncedColors);

  // Seeded once per mount: the arrangement is re-dealt per visit. Changing sets
  // re-places items via the new poseARs without reshuffling the seed.
  const seed = useMemo(() => Math.floor(Math.random() * 2 ** 31), []);

  // Single rng chain shared by both throws, mirroring the prototype's sequential
  // Math.random() draws across throwDarts(A) then throwDarts(B).
  const { primaryItems, accentItems } = useMemo(() => {
    const empty = { primaryItems: [] as PlacedItem[], accentItems: [] as PlacedItem[] };
    if (!primaryAssets || !primaryAssets.ars.length) return empty;
    const rng = mulberry32(seed);
    const primaryItems = placeScatter(
      { poseARs: primaryAssets.ars, baseWidth: 8.6, scaleMin: 0.62, scaleMax: 1.3, count: 17, rotMax: 28 },
      rng,
    );
    const accentItems = (accentAssets && accentAssets.ars.length)
      ? placeScatter(
        { poseARs: accentAssets.ars, baseWidth: 4.3, scaleMin: 0.6, scaleMax: 1.25, count: 16, rotMax: 28, existing: primaryItems },
        rng,
      )
      : [];
    return { primaryItems, accentItems };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryAssets, accentAssets, seed]);

  if (!primaryAssets) return null;

  const renderItem = (assets: SpriteAssets, it: PlacedItem, key: string) => (
    <div
      key={key}
      style={{
        position: 'absolute',
        left: it.x + '%',
        top: (it.y * 16 / 9).toFixed(2) + '%',
        width: it.w.toFixed(2) + '%',
        aspectRatio: String(it.ar.toFixed(3)),
        transform: `translate(-50%,-50%) rotate(${it.rot}deg)`,
        backgroundImage: `url(${assets.urls[it.poseIndex]})`,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      } as CSSProperties}
    />
  );

  return (
    <div className="nursery-scatter">
      {primaryItems.map((it, i) => renderItem(primaryAssets, it, `p${i}`))}
      {accentAssets && accentItems.map((it, i) => renderItem(accentAssets, it, `a${i}`))}
    </div>
  );
}
