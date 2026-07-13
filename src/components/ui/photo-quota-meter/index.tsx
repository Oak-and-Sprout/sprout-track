'use client';

import React from 'react';
import { cn } from '@/src/lib/utils';
import { useLocalization } from '@/src/context/localization';
import { formatQuotaLabel } from '@/src/utils/photoUtils';
import { quotaMeterStyles } from './photo-quota-meter.styles';
import { PhotoQuotaMeterProps } from './photo-quota-meter.types';
import './photo-quota-meter.css';

/**
 * Compact storage meter: "2.4 GB of 5 GB used - 48%". Amber above 80%.
 * Quota is per family, configured in Family Manager (AppConfig default).
 */
export function PhotoQuotaMeter({ usedBytes, totalBytes, variant = 'light', className }: PhotoQuotaMeterProps) {
  const { t } = useLocalization();
  const { usedGb, totalGb, percent } = formatQuotaLabel(usedBytes, totalBytes);
  const level = percent > 80 ? 'warning' : 'normal';

  return (
    <div className={cn(quotaMeterStyles.container({ variant }), variant === 'light' ? 'photo-quota-meter' : '', className)}>
      <span className={quotaMeterStyles.bar({ variant })} role="progressbar" aria-valuenow={Math.min(percent, 100)} aria-valuemin={0} aria-valuemax={100}>
        <span className={quotaMeterStyles.fill({ level })} style={{ width: `${Math.min(percent, 100)}%` }} />
      </span>
      <span>
        {usedGb} {t('GB of')} {totalGb} {t('GB used')} • {percent}%
      </span>
    </div>
  );
}

export default PhotoQuotaMeter;
