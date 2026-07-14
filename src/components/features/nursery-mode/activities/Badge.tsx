'use client';

import { ReactElement } from 'react';
import { Icon, IconName } from '../icons';

export interface BadgeProps {
  icon: IconName;
  shape: 'circle' | 'square';
  ifg: string;
  size: number;
  pad: number;
}

/**
 * Icon badge — ported from the prototype Badge (nursery.jsx:407-409).
 * `.nursery-badge` + shape class, tinted via color-mix around the icon color.
 */
export function Badge({ icon, shape, ifg, size, pad }: BadgeProps): ReactElement {
  return (
    <div
      className={`nursery-badge ${shape}`}
      style={{
        ['--ifg' as any]: ifg,
        width: size,
        height: size,
        background: `color-mix(in srgb, ${ifg} 20%, transparent)`,
        border: `1.5px solid color-mix(in srgb, ${ifg} 45%, transparent)`,
      } as React.CSSProperties}
    >
      <Icon n={icon} s={pad} />
    </div>
  );
}
