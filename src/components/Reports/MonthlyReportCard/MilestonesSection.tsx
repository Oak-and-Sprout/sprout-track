'use client';

import React from 'react';
import { cn } from '@/src/lib/utils';
import { useTimezone } from '@/app/context/timezone';
import { useLocalization } from '@/src/context/localization';
import { formatDateShort } from '@/src/utils/dateFormat';
import { reportCardStyles as s, milestoneBadgeColors } from './monthly-report-card.styles';
import type { MilestonesSectionProps } from './monthly-report-card.types';

const MilestonesSection: React.FC<MilestonesSectionProps> = ({ milestones }) => {
  const { t } = useLocalization();
  const { dateFormat } = useTimezone();

  return (
    <>
      <p className={cn(s.sectionHeading, 'report-card-section-heading')}>{t('Milestones reached')}</p>

      {milestones.length === 0 ? (
        <p className={cn(s.milestoneEmpty, 'report-card-milestone-empty')}>{t('No milestones logged this month')}</p>
      ) : (
        <div className={cn(s.milestoneList)}>
          {milestones.map(m => {
            const badge = milestoneBadgeColors[m.category] || milestoneBadgeColors.CUSTOM;
            const categoryLabel = t(m.category.charAt(0) + m.category.slice(1).toLowerCase());
            const dateStr = formatDateShort(new Date(m.date), dateFormat);
            return (
              <div key={m.id} className={cn(s.milestoneRow, 'report-card-milestone-row')}>
                <div
                  className={cn(s.milestoneBadge)}
                  style={{ backgroundColor: badge.bg, color: badge.text }}
                >
                  {badge.letter}
                </div>
                <div className={cn(s.milestoneInfo)}>
                  <p className={cn(s.milestoneTitle, 'report-card-milestone-title')}>{m.title}</p>
                  <p className={cn(s.milestoneSub, 'report-card-milestone-sub')}>
                    {categoryLabel} · {dateStr}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default MilestonesSection;
