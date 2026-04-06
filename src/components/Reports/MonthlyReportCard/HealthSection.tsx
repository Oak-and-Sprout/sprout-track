'use client';

import React from 'react';
import { cn } from '@/src/lib/utils';
import { useTimezone } from '@/app/context/timezone';
import { useLocalization } from '@/src/context/localization';
import { formatDateShort } from '@/src/utils/dateFormat';
import { reportCardStyles as s } from './monthly-report-card.styles';
import type { HealthSectionProps } from './monthly-report-card.types';

function complianceClass(pct: number): { style: string; darkClass: string } {
  if (pct >= 85) return { style: s.complianceGreen, darkClass: 'report-card-compliance-green' };
  if (pct >= 70) return { style: s.complianceAmber, darkClass: 'report-card-compliance-amber' };
  return { style: s.complianceRed, darkClass: 'report-card-compliance-red' };
}

const HealthSection: React.FC<HealthSectionProps> = ({ health }) => {
  const { t } = useLocalization();
  const { dateFormat } = useTimezone();

  const hasData = health.supplements.length > 0 || health.medicines.length > 0 || health.vaccines.length > 0;

  if (!hasData) {
    return (
      <>
        <p className={cn(s.sectionHeading, 'report-card-section-heading')}>{t('Health & medicine')}</p>
        <p className={cn(s.noData, 'report-card-no-data')}>{t('No health entries this month')}</p>
      </>
    );
  }

  return (
    <>
      <p className={cn(s.sectionHeading, 'report-card-section-heading')}>{t('Health & medicine')}</p>

      <div className={cn(s.card, 'report-card-card')}>
        <table className={s.healthTable}>
          <tbody>
            {health.supplements.map((sup, i) => {
              const cc = complianceClass(sup.compliancePercent);
              return (
                <tr key={`sup-${i}`} className={cn(s.healthRow, 'report-card-health-row')}>
                  <td className={cn(s.healthCellName, 'report-card-health-cell-name')}>{sup.name}</td>
                  <td className={cn(s.healthCellValue, 'report-card-health-cell-value')}>{sup.daysAdministered}/{sup.totalDays} {t('days')}</td>
                  <td className={cn(s.healthCellBadge)}>
                    <span className={cn(s.complianceBadge, cc.style, cc.darkClass)}>{sup.compliancePercent}%</span>
                  </td>
                </tr>
              );
            })}

            {health.medicines.map((med, i) => (
              <tr key={`med-${i}`} className={cn(s.healthRow, 'report-card-health-row')}>
                <td className={cn(s.healthCellName, 'report-card-health-cell-name')}>{med.name}</td>
                <td className={cn(s.healthCellValue, 'report-card-health-cell-value')} colSpan={2}>
                  {med.totalAdministrations} {t('doses')}
                </td>
              </tr>
            ))}

            {health.vaccines.map((vac, i) => (
              <tr key={`vac-${i}`} className={cn(i < health.vaccines.length - 1 ? s.healthRow : s.healthRowLast, 'report-card-health-row')}>
                <td className={cn(s.healthCellName, 'report-card-health-cell-name')}>{t('Vaccines')}</td>
                <td className={cn(s.healthCellValue, 'report-card-health-cell-value')} colSpan={2}>
                  {vac.name}{vac.doseNumber ? ` (${t('dose')} ${vac.doseNumber})` : ''} · {formatDateShort(new Date(vac.date), dateFormat)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default HealthSection;
