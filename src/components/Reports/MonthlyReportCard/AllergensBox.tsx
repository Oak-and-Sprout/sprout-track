'use client';

import React from 'react';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTimezone } from '@/app/context/timezone';
import { useLocalization } from '@/src/context/localization';
import { useFamily } from '@/src/context/family';
import { formatDateShort } from '@/src/utils/dateFormat';
import { reportCardStyles as s } from './monthly-report-card.styles';
import type { AllergensBoxProps } from './monthly-report-card.types';
import { toDateParam, ALLERGEN_TYPE_LABELS } from '@/src/utils/foodLogUtils';

/**
 * Known Allergens box — a STATIC (not month-dependent) list of every known
 * allergen: derived from reaction-flagged food/feed logs and manually
 * recorded entries. Prominent styling because this is safety information.
 */
const AllergensBox: React.FC<AllergensBoxProps> = ({ allergens, isPdfExport }) => {
  const { t } = useLocalization();
  const { dateFormat } = useTimezone();
  const { family } = useFamily();

  if (allergens.length === 0) return null;

  return (
    <div className={cn(s.allergensBox, 'report-card-allergens-box')}>
      <p className={cn(s.allergensBoxTitle, 'report-card-allergens-box-title')}>
        <TriangleAlert aria-hidden="true" className="w-4 h-4" />
        {t('Known Allergens')}
      </p>
      {allergens.map(entry => {
        const isDerived = entry.sources.includes('food-log') || entry.sources.includes('feed');
        const logDateParam = entry.reactions.length > 0 ? toDateParam(entry.reactions[0].time) : null;
        return (
          <div
            key={`${entry.name ?? 'generic-feed'}-${entry.manualId ?? 'derived'}`}
            className={cn(s.allergenRow, 'report-card-allergen-row')}
          >
            <p className={cn(s.allergenRowName, 'report-card-allergen-row-name')}>
              {entry.name ?? t('Formula / bottle feed')}
              {entry.manualId && (
                <span className={cn(s.allergenRowBadge, 'report-card-allergen-row-badge')}>
                  {t(ALLERGEN_TYPE_LABELS[entry.allergenType])}
                </span>
              )}
              {entry.commonAllergen && (
                <span className={cn(s.allergenRowBadge, 'report-card-allergen-row-badge')}>
                  {t('Common allergen')}
                </span>
              )}
              {isDerived && (
                <span className={cn(s.allergenRowBadge, 'report-card-allergen-row-badge')}>
                  {entry.sources.includes('food-log') ? t('From food log') : t('From feed log')}
                </span>
              )}
            </p>
            {entry.reactionDescriptions.length > 0 && (
              <p className={cn(s.allergenRowDetail, 'report-card-allergen-row-detail')}>
                {entry.reactionDescriptions.join(' • ')}
              </p>
            )}
            <p className={cn(s.allergenRowMeta, 'report-card-allergen-row-meta')}>
              {t('Added')} {formatDateShort(new Date(entry.dateAdded), dateFormat)}
              {!isPdfExport && isDerived && logDateParam && family?.slug && (
                <>
                  {' · '}
                  <Link
                    href={`/${family.slug}/log-entry?date=${logDateParam}`}
                    className={cn(s.allergenRowLink, 'report-card-allergen-row-link')}
                  >
                    {t('View in log')}
                  </Link>
                </>
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default AllergensBox;
