'use client';

import { NurserySettings } from '@/src/utils/nursery/settings';
import { AmbientScene } from './AmbientScene';
import { StarlitScene } from './StarlitScene';
import { TapestryScene } from './TapestryScene';

/**
 * Base two-stop gradient used as the fallback/underlay for every scene.
 * Ported from documentation/temp-development-docs/sprout-track-nursery/nursery.jsx:217.
 */
export const baseGrad = (h: number): string =>
  `linear-gradient(155deg, oklch(0.5 0.12 ${h}), oklch(0.38 0.13 ${(h + 35) % 360}))`;

export interface SceneBackgroundProps {
  settings: NurserySettings;
  /** Object URL for the uploaded nursery photo (photo scene). Completed in Task 13. */
  photoObjectUrl?: string | null;
}

/**
 * Renders the `.nursery-bg` layer and dispatches to the active scene.
 * This is the only scene entry point the nursery mode container should use.
 */
export function SceneBackground({ settings, photoObjectUrl }: SceneBackgroundProps) {
  const { scene, hue, dim, sat } = settings;
  const filter = `brightness(${(0.32 + (dim / 100) * 0.78).toFixed(2)}) saturate(${((sat / 100) * 1.9).toFixed(2)})`;

  if (scene === 'photo') {
    return (
      <div className="nursery-bg" style={{ filter }} aria-hidden="true">
        {photoObjectUrl ? (
          <>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url(${photoObjectUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            <div
              className="nursery-scrim"
              style={{ background: `linear-gradient(180deg, oklch(0.15 0.04 ${hue} / .55), oklch(0.1 0.05 ${hue} / .78))` }}
            />
          </>
        ) : (
          <div className="nursery-bg-grad" style={{ background: baseGrad(hue) }} />
        )}
      </div>
    );
  }

  if (scene === 'tapestry') {
    return (
      <div className="nursery-bg" style={{ filter }} aria-hidden="true">
        <TapestryScene tapestry={settings.tapestry} />
      </div>
    );
  }

  if (scene === 'starlit') {
    return (
      <div className="nursery-bg" style={{ filter }} aria-hidden="true">
        <StarlitScene starlit={settings.starlit} hue={hue} />
      </div>
    );
  }

  return (
    <div className="nursery-bg" style={{ filter }} aria-hidden="true">
      <AmbientScene ambient={settings.ambient} hue={hue} />
    </div>
  );
}
