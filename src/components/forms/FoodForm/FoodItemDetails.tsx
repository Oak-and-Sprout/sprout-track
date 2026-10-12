'use client';

import React from 'react';
import { FoodItemDetailsProps } from './food-form.types';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Label } from '@/src/components/ui/label';
import { useLocalization } from '@/src/context/localization';
import {
  FOOD_ENJOYMENT_DISPLAY_ORDER,
  FOOD_ENJOYMENT_LABELS,
  FOOD_ENJOYMENT_ICON_SRC,
} from '@/src/utils/foodLogUtils';

const UNITS = [
  { abbr: 'TBSP', label: 'tbsp' },
  { abbr: 'G', label: 'g' },
] as const;

/**
 * FoodItemDetails
 *
 * Per-food amount + unit and enjoyment for one food of a multi-food entry
 * (#271), shown when its chip is expanded in LogFoodTab. Reactions stay in the
 * entry's per-food reaction list.
 */
const FoodItemDetails: React.FC<FoodItemDetailsProps> = ({ id, foodName, value, onChange, disabled }) => {
  const { t } = useLocalization();
  const amountId = `${id}-amount`;
  const title = `${t('Details for')} ${foodName}`;

  return (
    <div
      id={id}
      role="group"
      aria-label={title}
      className="mt-2 space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3 food-item-details"
    >
      <p className="text-sm font-medium text-gray-800 food-item-details-title">{title}</p>
      <div>
        <Label className="form-label" htmlFor={amountId}>{t('Amount')}</Label>
        <div className="flex items-center gap-2">
          <Input
            id={amountId}
            type="text"
            inputMode="decimal"
            value={value.amount}
            onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && onChange({ amount: e.target.value })}
            className="w-24 text-center"
            placeholder={t('Amount')}
            disabled={disabled}
          />
          {UNITS.map(unit => (
            <Button
              key={unit.abbr}
              type="button"
              size="sm"
              variant={value.unitAbbr === unit.abbr ? 'default' : 'outline'}
              onClick={() => onChange({ unitAbbr: unit.abbr })}
              aria-pressed={value.unitAbbr === unit.abbr}
              disabled={disabled}
            >
              {t(unit.label)}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1" role="group" aria-label={t('Enjoyment')}>
        {FOOD_ENJOYMENT_DISPLAY_ORDER.map((enjoyment) => (
          <Button
            key={enjoyment}
            type="button"
            variant="ghost"
            className={`group h-12 px-1 py-1 ${value.enjoyment === enjoyment ? 'bg-teal-100 food-enjoyment-selected' : ''}`}
            onClick={() => onChange({ enjoyment: value.enjoyment === enjoyment ? null : enjoyment })}
            aria-pressed={value.enjoyment === enjoyment}
            aria-label={t(FOOD_ENJOYMENT_LABELS[enjoyment])}
            title={t(FOOD_ENJOYMENT_LABELS[enjoyment])}
            disabled={disabled}
          >
            <img
              src={FOOD_ENJOYMENT_ICON_SRC[enjoyment]}
              alt=""
              aria-hidden="true"
              className="h-9 w-9 transition-all duration-200 group-hover:scale-110"
            />
          </Button>
        ))}
      </div>
    </div>
  );
};

export default FoodItemDetails;
