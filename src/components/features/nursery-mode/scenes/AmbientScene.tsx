'use client';

import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { NurserySettings } from '@/src/utils/nursery/settings';
import { useOutlineSprites } from '../engine/useOutlineSprites';
import { placeOutlineField, mulberry32 } from '@/src/utils/nursery/placement';
import { baseGrad } from './SceneBackground';

export interface AmbientSceneProps {
  ambient: NurserySettings['ambient'];
  hue: number;
}

/** Layered wave SVG data-URI. Ported from nursery.jsx:219. */
const wavesUri = (h: number): string => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100' preserveAspectRatio='none'><path d='M0 50 C22 40 38 60 55 50 S86 40 100 50 L100 100 0 100Z' fill='hsl(${h},40%,44%)'/><path d='M0 63 C22 54 40 74 56 63 S86 54 100 63 L100 100 0 100Z' fill='hsl(${(h + 18) % 360},42%,38%)'/><path d='M0 77 C24 69 40 88 58 77 S86 69 100 77 L100 100 0 100Z' fill='hsl(${(h + 34) % 360},44%,31%)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

/** Decorative static bubble highlights layered under the animated rising bubbles. Ported from nursery.jsx:311. */
const bubblesPatternLayer = (h: number): string =>
  `radial-gradient(circle at 24% 78%, hsla(${h},60%,88%,.16) 0 26px, transparent 27px), radial-gradient(circle at 62% 40%, hsla(${h},60%,88%,.13) 0 15px, transparent 16px), radial-gradient(circle at 84% 72%, hsla(${h},60%,88%,.15) 0 20px, transparent 21px), ${baseGrad(h)}`;

/**
 * Ambient scene: aurora blobs, gently rocking waves, rising bubbles, or a field of
 * floating sprite outlines. Ported from nursery.jsx:389-403 (Background component).
 */
export function AmbientScene({ ambient, hue }: AmbientSceneProps) {
  const { pattern, auroraRange, waveMotion, bubbles: bubbleCfg, rot, move, size } = ambient;

  const spriteSetId = pattern.indexOf('sprite:') === 0 ? pattern.slice(7) : null;
  const sprites = useOutlineSprites(spriteSetId, hue);

  const bubbles = useMemo(() => {
    const lo = Math.min(bubbleCfg.min, bubbleCfg.max);
    const hi = Math.max(bubbleCfg.min, bubbleCfg.max);
    return Array.from({ length: bubbleCfg.count }, () => ({
      x: Math.random() * 100,
      s: Math.round(lo + Math.random() * (hi - lo)),
      dur: (9 + Math.random() * 16).toFixed(1),
      d: (-Math.random() * 24).toFixed(1),
      dx: Math.round((Math.random() - 0.5) * 160),
      o: (0.35 + Math.random() * 0.45).toFixed(2),
      sy: Math.round(Math.random() * 100),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bubbleCfg.count, bubbleCfg.min, bubbleCfg.max]);

  // Seeded once per mount: cycling patterns back to a sprite set must not reshuffle
  // the field (changing sets already re-places items via poseARs).
  const seed = useMemo(() => Math.floor(Math.random() * 2 ** 31), []);

  const outlineItems = useMemo(() => {
    if (!sprites || !sprites.ars.length) return [];
    return placeOutlineField({ poseARs: sprites.ars, sizeVariance: size }, mulberry32(seed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprites, size, seed]);

  if (pattern === 'aurora') {
    const f = 0.3 + (auroraRange / 100) * 1.9;
    const o = (d: number) => (((hue + d * f) % 360) + 360) % 360;
    return (
      <>
        <div className="nursery-bg-grad" style={{ background: baseGrad(hue) }} />
        <div className="nursery-blob b1" style={{ width: '55vw', height: '55vw', left: '-10vw', top: '-15vh', background: `radial-gradient(circle, oklch(0.68 0.16 ${o(20)}), transparent 62%)` }} />
        <div className="nursery-blob b2" style={{ width: '50vw', height: '50vw', right: '-12vw', top: '8vh', background: `radial-gradient(circle, oklch(0.6 0.17 ${o(70)}), transparent 62%)` }} />
        <div className="nursery-blob b3" style={{ width: '48vw', height: '48vw', left: '28vw', bottom: '-22vh', background: `radial-gradient(circle, oklch(0.58 0.15 ${o(-40)}), transparent 62%)` }} />
      </>
    );
  }

  const patternLayerBg = pattern === 'bubbles' ? bubblesPatternLayer(hue) : baseGrad(hue);
  const floats = move > 0;
  const mv = 0.2 + (move / 100) * 0.8;

  return (
    <>
      <div className="nursery-pattern-layer" style={{ background: patternLayerBg }} />
      {pattern === 'waves' && (
        <div
          className={'nursery-waves-layer' + (waveMotion > 0 ? ' anim' : '')}
          style={{
            backgroundImage: wavesUri(hue),
            '--wamp': (waveMotion * 0.045).toFixed(2) + 'deg',
            '--wdx': Math.round(waveMotion * 1.4) + 'px',
            '--wdur': (26 - waveMotion * 0.16).toFixed(1) + 's',
          } as CSSProperties}
        />
      )}
      {spriteSetId && sprites && outlineItems.length > 0 && (
        <div className="nursery-motifs">
          {outlineItems.map((it, i) => {
            const deg = (it.r1 - 0.5) * 2 * rot * 1.8;
            const style: Record<string, string | number> = {
              left: it.x + '%',
              top: (it.y * 16 / 9).toFixed(2) + '%',
              width: it.w.toFixed(2) + '%',
              aspectRatio: it.ar.toFixed(3),
              marginLeft: (-it.w / 2).toFixed(2) + '%',
              marginTop: (-(it.w / it.ar) / 2).toFixed(2) + '%',
              opacity: 0.34,
              backgroundImage: `url(${sprites.urls[it.poseIndex]})`,
            };
            if (floats) {
              style['--tr'] = deg.toFixed(1) + 'deg';
              style['--tr2'] = (deg + it.spin * (rot / 60)).toFixed(1) + 'deg';
              style['--tx'] = (it.dx * mv).toFixed(1) + 'vw';
              style['--ty'] = (it.dy * mv).toFixed(1) + 'vh';
              style['--dur'] = (it.dur * (1.65 - (move / 100) * 1.3)).toFixed(1) + 's';
              style['--d'] = it.delay.toFixed(1) + 's';
            } else {
              style.transform = `rotate(${deg.toFixed(1)}deg)`;
            }
            return <i key={i} className={floats ? 'float' : ''} style={style as CSSProperties} />;
          })}
        </div>
      )}
      {pattern === 'bubbles' && (
        <div className="nursery-bubbles">
          {bubbles.map((b, i) => (
            <i
              key={i}
              style={{
                left: b.x + '%',
                width: b.s + 'px',
                height: b.s + 'px',
                '--dur': b.dur + 's',
                '--d': b.d + 's',
                '--dx': b.dx + 'px',
                '--o': b.o,
                '--sy': b.sy + '%',
              } as CSSProperties}
            />
          ))}
        </div>
      )}
    </>
  );
}
