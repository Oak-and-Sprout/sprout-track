'use client';

import { NurserySettings } from '@/src/utils/nursery/settings';
import { RUGS, rugUrl } from '../spriteManifest';
import { useRecoloredAsset } from '../engine/useRecoloredAsset';
import { useDebouncedValue } from '../engine/useDebouncedValue';
import { backdropStyle, isRug } from './backdropStyle';
import { ScatterLayer } from './ScatterLayer';

export interface TapestrySceneProps {
  tapestry: NurserySettings['tapestry'];
}

/**
 * Tapestry scene: a CSS-pattern or recolored-rug backdrop, a scatter of recolored
 * sprite poses, and a soft vignette scrim. Ported from nursery.jsx:371-377
 * (Background component's 'tapestry' branch).
 */
export function TapestryScene({ tapestry }: TapestrySceneProps) {
  const { backdrop, primary, accent, base, colors } = tapestry;
  const rug = isRug(backdrop) ? RUGS.find(r => r.id === backdrop) : undefined;
  // Debounced: recoloring the rug SVG (trace + cache a permanent blob URL) is
  // expensive and shouldn't refire on every color-drag input event.
  const debouncedBase = useDebouncedValue(base, 200);
  const debouncedColors = useDebouncedValue(colors, 200);
  const rugAsset = useRecoloredAsset(rug ? rugUrl(rug.file) : null, debouncedBase, debouncedColors);

  return (
    <>
      {isRug(backdrop) ? (
        <div
          className="nursery-pattern-layer"
          style={{
            backgroundImage: rugAsset ? `url(${rugAsset.objectUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: '#1c1f2b',
          }}
        />
      ) : (
        <div className="nursery-pattern-layer" style={backdropStyle(backdrop, base)} />
      )}
      <ScatterLayer primary={primary} accent={accent} base={base} colors={colors} />
      <div
        className="nursery-scrim"
        style={{ background: 'radial-gradient(125% 95% at 50% 42%, rgba(28,20,10,.14), rgba(14,10,16,.5))' }}
      />
    </>
  );
}
