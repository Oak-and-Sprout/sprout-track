'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useLocalization } from '@/src/context/localization';
import { LandingPlan } from './landing-data';

interface PlanCardProps {
  plan: LandingPlan;
  onSelect: () => void;
}

/** Pricing card. Prices ($2.99 / $19.99) render as-is; labels localize. */
export function PlanCard({ plan, onSelect }: PlanCardProps) {
  const { t } = useLocalization();

  return (
    <div className={cn('ld-plan', plan.hot && 'ld-hot')}>
      <span className="ld-tag">{t(plan.tag)}</span>
      <h3>{t(plan.name)}</h3>
      <div className="ld-price">
        {plan.price}
        <small> {t(plan.priceUnit)}</small>
      </div>
      <p className="ld-per">{t(plan.per)}</p>
      <ul>
        {plan.features.map((feature) => (
          <li key={feature}>
            <Check size={18} strokeWidth={2} aria-hidden="true" />
            {t(feature)}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={cn('ld-btn', 'ld-big', !plan.hot && 'ld-ghost')}
        onClick={onSelect}
      >
        {t(plan.cta)}
      </button>
    </div>
  );
}
