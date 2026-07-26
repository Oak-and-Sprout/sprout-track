import type { CSSProperties } from 'react';
import { backdropTint } from '@/src/utils/nursery/colorMath';

/**
 * CSS-pattern tapestry backdrops (stripes, chevron, dots, blocks, scallops).
 * Exact port of nursery.jsx:49-60, using `backdropTint` for the accent tint.
 */
export function backdropStyle(kind: string, baseHex: string): CSSProperties {
  const tint = backdropTint(baseHex);
  if (kind === 'vstripe') {
    return { background: `repeating-linear-gradient(90deg, ${baseHex} 0 30px, ${tint} 30px 37px)` };
  }
  if (kind === 'hstripe') {
    return { background: `repeating-linear-gradient(0deg, ${baseHex} 0 30px, ${tint} 30px 37px)` };
  }
  if (kind === 'dstripe') {
    return { background: `repeating-linear-gradient(45deg, ${baseHex} 0 30px, ${tint} 30px 37px)` };
  }
  if (kind === 'zigzag') {
    return {
      backgroundColor: baseHex,
      backgroundImage: `linear-gradient(135deg, ${tint} 25%, transparent 25%),linear-gradient(225deg, ${tint} 25%, transparent 25%),linear-gradient(315deg, ${tint} 25%, transparent 25%),linear-gradient(45deg, ${tint} 25%, transparent 25%)`,
      backgroundPosition: '-26px 0,-26px 0,0 0,0 0',
      backgroundSize: '52px 52px',
    };
  }
  if (kind === 'dots') {
    return {
      backgroundColor: baseHex,
      backgroundImage: `radial-gradient(${tint} 4px, transparent 5px),radial-gradient(${tint} 4px, transparent 5px)`,
      backgroundSize: '46px 46px',
      backgroundPosition: '0 0,23px 23px',
    };
  }
  if (kind === 'checks') {
    return {
      backgroundColor: baseHex,
      backgroundImage: `repeating-conic-gradient(${tint} 0 25%, transparent 0 50%)`,
      backgroundSize: '68px 68px',
    };
  }
  if (kind === 'scallops') {
    return {
      backgroundColor: baseHex,
      backgroundImage: `radial-gradient(circle at 50% 120%, ${tint} 0 14px, transparent 15px 100%),radial-gradient(circle at 50% 120%, ${tint} 0 14px, transparent 15px 100%)`,
      backgroundSize: '48px 24px',
      backgroundPosition: '0 0,24px 12px',
    };
  }
  return { background: baseHex };
}

export const isRug = (id: string): boolean => id.startsWith('rug:');
