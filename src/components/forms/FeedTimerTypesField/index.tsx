'use client';

import React from 'react';
import { cn } from '@/src/lib/utils';
import { Checkbox } from '@/src/components/ui/checkbox';
import { useLocalization } from '@/src/context/localization';
import {
  FEED_TIMER_CATEGORIES,
  FeedTimerCategory,
} from '@/src/utils/feedTimerConfig';

import {
  fieldDescription,
  optionList,
  optionRow,
  optionLabel,
} from './feed-timer-types-field.styles';
import { FeedTimerTypesFieldProps } from './feed-timer-types-field.types';
import './feed-timer-types-field.css';

const CATEGORY_LABELS: Record<FeedTimerCategory, string> = {
  BREAST: 'Breast feeds',
  BOTTLE_BREAST_MILK: 'Breast milk bottles',
  BOTTLE_FORMULA: 'Formula bottles',
  BOTTLE_OTHER: 'Other bottles',
  SOLIDS: 'Solids',
};

/**
 * Issue #225: checkbox group to pick which feed types reset the baby's
 * "time since last feed" timer. At least one category must stay selected.
 */
export default function FeedTimerTypesField({
  value,
  onChange,
  idPrefix,
}: FeedTimerTypesFieldProps) {
  const { t } = useLocalization();
  const reactId = React.useId();
  const prefix = idPrefix ?? reactId;

  const toggle = (category: FeedTimerCategory, checked: boolean) => {
    if (checked) {
      onChange(
        FEED_TIMER_CATEGORIES.filter((c) => c === category || value.includes(c))
      );
    } else if (value.length > 1) {
      onChange(value.filter((c) => c !== category));
    }
  };

  return (
    <div>
      <span className="form-label">{t('Feed timer counts')}</span>
      <p className={cn(fieldDescription(), 'feed-timer-types-description')}>
        {t('Select which feed types reset the time since last feed')}
      </p>
      <div className={optionList()}>
        {FEED_TIMER_CATEGORIES.map((category) => {
          const checked = value.includes(category);
          const disabled = checked && value.length === 1;
          return (
            <label key={category} className={optionRow()}>
              <Checkbox
                id={`${prefix}-feed-timer-${category}`}
                variant="primary"
                checked={checked}
                disabled={disabled}
                onCheckedChange={(next) => toggle(category, next)}
              />
              <span
                className={cn(optionLabel(), 'feed-timer-types-option-label')}
              >
                {t(CATEGORY_LABELS[category])}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
