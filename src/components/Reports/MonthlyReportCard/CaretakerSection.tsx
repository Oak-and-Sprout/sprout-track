'use client';

import React from 'react';
import { cn } from '@/src/lib/utils';
import { useLocalization } from '@/src/context/localization';
import { reportCardStyles as s } from './monthly-report-card.styles';
import type { CaretakerSectionProps } from './monthly-report-card.types';

const CaretakerSection: React.FC<CaretakerSectionProps> = ({ caretakers }) => {
  const { t } = useLocalization();

  if (caretakers.length === 0) return null;

  return (
    <>
      <p className={cn(s.sectionHeading, 'report-card-section-heading')}>{t('Caretaker activity')}</p>

      <div className={cn(s.card, 'report-card-card')}>
        <table className={s.caretakerTable}>
          <tbody>
            {caretakers.map((ct, i) => (
              <tr key={i} className={cn(i < caretakers.length - 1 ? s.healthRow : '', 'report-card-health-row')}>
                <td className={cn(s.caretakerCellName, 'report-card-caretaker-name')}>{ct.name}</td>
                <td className={cn(s.caretakerCellLogs, 'report-card-caretaker-logs')}>{ct.totalLogs} {t('logs')}</td>
                <td className={cn(s.caretakerCellPct, 'report-card-caretaker-pct')}>{ct.percentage}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default CaretakerSection;
