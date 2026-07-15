'use client';

import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { NurserySettings } from '@/src/utils/nursery/settings';

export interface StarlitSceneProps {
  starlit: NurserySettings['starlit'];
  hue: number;
}

/**
 * Starlit scene: radial night-sky gradient, a field of twinkling stars (some with
 * cross-flare "sparks"), and either soft aurora curtains or a plain scrim.
 * Ported from nursery.jsx:364 (stars memo) and 378-388 (Background branch).
 */
export function StarlitScene({ starlit, hue }: StarlitSceneProps) {
  const { density, aura } = starlit;

  const stars = useMemo(() => {
    return Array.from({ length: density }, () => {
      const o = +(0.16 + Math.random() * 0.84).toFixed(2);
      const spark = o > 0.82;
      return {
        x: Math.random() * 100,
        y: Math.random() * 100,
        s: +(Math.random() * 1.7 + 0.5 + (spark ? 1 : 0)).toFixed(2),
        o,
        d: (Math.random() * 9).toFixed(2),
        dur: (3.5 + Math.random() * 6).toFixed(2),
        spark,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density]);

  return (
    <>
      <div
        className="nursery-bg-grad"
        style={{
          background: `radial-gradient(120% 90% at 50% 12%, oklch(0.32 0.09 ${hue}), oklch(0.14 0.06 ${(hue + 20) % 360}) 70%, oklch(0.08 0.04 ${(hue + 20) % 360}))`,
        }}
      />
      <div className="nursery-stars">
        {stars.map((st, i) => (
          <i
            key={i}
            className={st.spark ? 'spark' : ''}
            style={{
              left: st.x + '%',
              top: st.y + '%',
              width: st.s + 'px',
              height: st.s + 'px',
              opacity: st.o,
              '--d': st.d + 's',
              '--dur': st.dur + 's',
            } as CSSProperties}
          />
        ))}
      </div>
      {aura ? (
        <div className="nursery-aura">
          <div className="nursery-ab a1" style={{ background: `radial-gradient(60% 100% at 28% 0%, oklch(0.74 0.2 ${hue} / .72), transparent 68%)` }} />
          <div className="nursery-ab a2" style={{ background: `radial-gradient(52% 100% at 68% 0%, oklch(0.76 0.19 ${(hue + 65) % 360} / .66), transparent 68%)` }} />
          <div className="nursery-ab a3" style={{ background: `radial-gradient(70% 96% at 50% 6%, oklch(0.7 0.2 ${(hue - 45 + 360) % 360} / .5), transparent 72%)` }} />
        </div>
      ) : (
        <div className="nursery-scrim" style={{ background: `radial-gradient(70% 55% at 50% 42%, oklch(0.4 0.1 ${hue} / .3), transparent)` }} />
      )}
    </>
  );
}
