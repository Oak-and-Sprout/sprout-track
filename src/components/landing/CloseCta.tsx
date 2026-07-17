'use client';

import React from 'react';
import { cn } from '@/src/lib/utils';

interface CloseCtaProps {
  heading: string;
  sub?: string;
  assure?: string;
  ctaLabel: string;
  onCtaClick: () => void;
  sprite?: React.ReactNode;
  alt?: boolean;
}

/** Closing CTA band: heading, optional sub-line, trial button, assurance line. */
export function CloseCta({ heading, sub, assure, ctaLabel, onCtaClick, sprite, alt = false }: CloseCtaProps) {
  return (
    <section className={cn('ld-close-cta', alt && 'ld-alt')}>
      <div className="ld-wrap">
        {sprite}
        <h2>{heading}</h2>
        {sub && <p>{sub}</p>}
        <div className="ld-cta-row">
          <button type="button" className="ld-btn ld-big" onClick={onCtaClick}>
            {ctaLabel}
          </button>
        </div>
        {assure && <p className="ld-assure">{assure}</p>}
      </div>
    </section>
  );
}
