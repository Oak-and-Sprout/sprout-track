'use client';

import React from 'react';
import { cn } from '@/src/lib/utils';

interface FeatureChipsProps {
  chips: { icon?: string; label: string }[];
  center?: boolean;
}

/** Rounded chip grid (tracking types, languages). Labels arrive pre-translated. */
export function FeatureChips({ chips, center = false }: FeatureChipsProps) {
  return (
    <div className={cn('ld-chipset', center && 'ld-chipset-center')}>
      {chips.map((chip) => (
        <span className="ld-fchip" key={chip.label}>
          {chip.icon && (
            <img src={chip.icon} alt="" width={22} height={22} style={{ borderRadius: '50%' }} />
          )}
          {chip.label}
        </span>
      ))}
    </div>
  );
}
