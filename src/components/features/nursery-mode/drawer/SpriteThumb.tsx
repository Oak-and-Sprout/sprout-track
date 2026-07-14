'use client';

import { useMemo } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { spriteSetById, spriteUrl } from '../spriteManifest';
import { useRecoloredAsset } from '../engine/useRecoloredAsset';
import { useOutlineSprites } from '../engine/useOutlineSprites';
import { useDebouncedValue } from '../engine/useDebouncedValue';
import { baseGrad } from '../scenes/SceneBackground';

export interface SpriteThumbProps {
  setId: string;
  mode: 'recolored' | 'outline';
  base?: string;
  colors?: string[];
  hue?: number;
  selected: boolean;
  onClick: () => void;
  label: string;
}

/**
 * A single sprite-set swatch button for the Ambient (outline) and Tapestry
 * (recolored) object pickers. Ported from nursery.jsx's OutlineThumb (301-307)
 * and ObjThumb (516-522), simplified: the sprite manifest already exposes
 * whole-pose images (no sprite-sheet box math needed).
 */
export function SpriteThumb({ setId, mode, base, colors, hue, selected, onClick, label }: SpriteThumbProps): ReactElement {
  const set = spriteSetById(setId);
  const poses = set ? set.poses : [];
  // One random pose per mount — stable for the component's lifetime.
  const pick = useMemo(() => Math.random(), [setId]);

  const recoloredUrl = mode === 'recolored' && poses.length > 0
    ? spriteUrl(setId, poses[Math.floor(pick * poses.length)].file)
    : null;
  // Debounced: these thumbs re-recolor/re-trace on every color/hue drag event otherwise.
  const debouncedColors = useDebouncedValue(colors || [], 200);
  const debouncedHue = useDebouncedValue(hue ?? 0, 200);
  // Stencil preview: literal pattern colors only — base only sets the swatch backdrop below.
  const recolored = useRecoloredAsset(recoloredUrl, debouncedColors);
  const outline = useOutlineSprites(mode === 'outline' ? setId : null, debouncedHue);

  let previewStyle: CSSProperties;
  let inner: ReactElement | null = null;

  if (mode === 'recolored') {
    previewStyle = { backgroundColor: base, display: 'grid', placeItems: 'center' };
    if (recolored) {
      inner = (
        <div
          style={{
            height: '82%',
            aspectRatio: String(recolored.ar.toFixed(3)),
            backgroundImage: `url(${recolored.objectUrl})`,
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
      );
    }
  } else {
    previewStyle = { background: baseGrad(hue ?? 0), display: 'grid', placeItems: 'center' };
    if (outline && outline.urls.length > 0) {
      const idx = Math.floor(pick * outline.urls.length);
      inner = (
        <div
          style={{
            height: '80%',
            aspectRatio: String(outline.ars[idx].toFixed(3)),
            backgroundImage: `url(${outline.urls[idx]})`,
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
      );
    }
  }

  return (
    <button type="button" className={'nursery-patt' + (selected ? ' on' : '')} onClick={onClick}>
      <div className="pp" style={previewStyle}>{inner}</div>
      <div className="pl">{label}</div>
    </button>
  );
}
