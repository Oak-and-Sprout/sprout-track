'use client';

import { memo } from 'react';
import { NurserySettings } from '@/src/utils/nursery/settings';
import { AmbientScene } from './AmbientScene';
import { StarlitScene } from './StarlitScene';
import { TapestryScene } from './TapestryScene';
import { PhotoScene, photoIdFromSrc } from './PhotoScene';

/**
 * Base two-stop gradient used as the fallback/underlay for every scene.
 * Ported from documentation/temp-development-docs/sprout-track-nursery/nursery.jsx:217.
 */
export const baseGrad = (h: number): string =>
  `linear-gradient(155deg, oklch(0.5 0.12 ${h}), oklch(0.38 0.13 ${(h + 35) % 360}))`;

export interface SceneBackgroundProps {
  settings: NurserySettings;
  /** Reports the photo scene's sampled dominant-color tint (or null when unset/disabled) up to the container, which uses it for auto icon color. */
  onPhotoTint?: (tint: string | null) => void;
}

/**
 * Renders the `.nursery-bg` layer and dispatches to the active scene.
 * This is the only scene entry point the nursery mode container should use.
 * Wrapped in `memo` below: `settings` and `onPhotoTint` are referentially
 * stable between activity-timer ticks in NurseryModeContainer, so this stops
 * the whole scene subtree (stars/scatter/bubbles) from re-rendering every second.
 */
function SceneBackgroundImpl({ settings, onPhotoTint }: SceneBackgroundProps) {
  const { scene, hue, dim, sat } = settings;
  const filter = `brightness(${(0.32 + (dim / 100) * 0.78).toFixed(2)}) saturate(${((sat / 100) * 1.9).toFixed(2)})`;

  if (scene === 'photo') {
    return (
      <div className="nursery-bg" style={{ filter }} aria-hidden="true">
        <PhotoScene
          photoId={photoIdFromSrc(settings.photo.src)}
          hue={hue}
          autoTint={settings.photo.autoTint}
          onTint={onPhotoTint}
        />
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

export const SceneBackground = memo(SceneBackgroundImpl);
