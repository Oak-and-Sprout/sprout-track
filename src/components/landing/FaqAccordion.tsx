'use client';

import React from 'react';
import { useLocalization } from '@/src/context/localization';
import { FaqItem } from './landing-data';

/** <details>-based FAQ list ("Fair questions"). */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const { t } = useLocalization();

  return (
    <div className="ld-faq">
      {items.map((item) => (
        <details key={item.question}>
          <summary>{t(item.question)}</summary>
          <p>{t(item.answer)}</p>
        </details>
      ))}
    </div>
  );
}
