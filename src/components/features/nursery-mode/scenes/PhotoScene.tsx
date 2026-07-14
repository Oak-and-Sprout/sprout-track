'use client';

import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { useAuthedImage, photoFileUrl } from '@/src/hooks/useAuthedImage';
import { dominantTintFromPixels } from '@/src/utils/nursery/dominantColor';
import { baseGrad } from './SceneBackground';

/**
 * 'gallery:<id>' / 'upload:<id>' -> '<id>'. Both prefixes are accepted for
 * robustness — the picker always writes 'gallery:' (uploads land in the
 * gallery), 'upload:' is only recognized for forward/backward compatibility.
 */
export const photoIdFromSrc = (src: string | null): string | null =>
  src ? src.replace(/^(gallery|upload):/, '') : null;

export interface PhotoSceneProps {
  photoId: string | null;
  hue: number;
  autoTint: boolean;
  onTint?: (tint: string | null) => void;
}

const TINT_CANVAS_SIZE = 64;

/**
 * Renders the photo scene's background layer: the selected photo (cover-fit,
 * with a hue-tinted scrim) or the ambient base gradient when no photo is set.
 * When `autoTint` is on, samples the loaded photo's dominant color and
 * reports it via `onTint` so the container can use it for icon color.
 */
export function PhotoScene({ photoId, hue, autoTint, onTint }: PhotoSceneProps): ReactElement {
  const { src } = useAuthedImage(photoId ? photoFileUrl(photoId, 'full') : '', !!photoId);

  // Store the latest callback in a ref so the sampling effect only depends on
  // the values that should actually re-trigger sampling (src, autoTint), not
  // on the container re-rendering with a fresh callback identity.
  const onTintRef = useRef(onTint);
  onTintRef.current = onTint;

  useEffect(() => {
    let live = true;

    if (!autoTint || !src) {
      onTintRef.current?.(null);
      return () => {
        live = false;
      };
    }

    const img = new Image();
    img.onload = () => {
      if (!live) return;
      try {
        const longest = Math.max(img.naturalWidth, img.naturalHeight) || 1;
        const scale = TINT_CANVAS_SIZE / longest;
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('2d context unavailable');
        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const { tint } = dominantTintFromPixels(imageData.data);
        if (live) onTintRef.current?.(tint);
      } catch {
        if (live) onTintRef.current?.(null);
      }
    };
    img.onerror = () => {
      if (live) onTintRef.current?.(null);
    };
    img.src = src;

    return () => {
      live = false;
    };
  }, [autoTint, src]);

  // Scene switch away from photo (or drawer closing the picker mid-flight)
  // unmounts this component — clear any tint the container is holding so a
  // stale color doesn't leak into another scene's icon color.
  useEffect(() => {
    return () => {
      onTintRef.current?.(null);
    };
  }, []);

  if (src) {
    return (
      <>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div
          className="nursery-scrim"
          style={{ background: `linear-gradient(180deg, oklch(0.15 0.04 ${hue} / .55), oklch(0.1 0.05 ${hue} / .78))` }}
        />
      </>
    );
  }

  return <div className="nursery-bg-grad" style={{ background: baseGrad(hue) }} />;
}
