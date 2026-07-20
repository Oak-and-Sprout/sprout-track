'use client';

import React from 'react';
import { cn } from '@/src/lib/utils';

interface PageHeadProps {
  kick: string;
  title: string;
  lede: string;
  photoClass?: string; // e.g. 'ld-pagehead-photo' (pricing) — features wraps in .ld-feathero instead
  centered?: boolean;
}

/** Interior page header band with optional lifestyle-photo background. */
export function PageHead({ kick, title, lede, photoClass, centered = false }: PageHeadProps) {
  return (
    <section className={cn('ld-pagehead', photoClass, centered && 'ld-pagehead-center')}>
      <div className="ld-wrap">
        <span className="ld-kick">{kick}</span>
        <h1>{title}</h1>
        <p>{lede}</p>
      </div>
    </section>
  );
}
