'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface FeatureRowProps {
  title: string;
  paragraph: string;
  items?: string[];
  figure: React.ReactNode;
  flip?: boolean;
}

/** Split feature row: text + checklist on one side, figure on the other. */
export function FeatureRow({ title, paragraph, items = [], figure, flip = false }: FeatureRowProps) {
  return (
    <div className={cn('ld-feat', flip && 'ld-flip')}>
      <div>
        <h3>{title}</h3>
        <p>{paragraph}</p>
        {items.length > 0 && (
          <ul>
            {items.map((item) => (
              <li key={item}>
                <Check size={18} strokeWidth={2} aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="ld-fig">{figure}</div>
    </div>
  );
}
