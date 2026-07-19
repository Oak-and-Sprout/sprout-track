'use client';

import { useId } from 'react';
import { Unit } from '@prisma/client';
import { Settings } from '@/app/api/types';
import { Label } from '@/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { useLocalization } from '@/src/context/localization';
import NotificationSettings from './NotificationSettings';
import { Baby } from '@prisma/client';
import { useUnit } from '@/src/hooks/useUnit';

interface UserSettingsTabProps {
  settings: Settings | null;
  units: Unit[];
  loading: boolean;
  babies: Baby[];
  deploymentConfig: { deploymentMode: string; enableAccounts: boolean; allowAccountRegistration: boolean; notificationsEnabled?: boolean } | null;
  onSettingsChange: (updates: Partial<Settings>) => Promise<void>;
}

export default function UserSettingsTab({
  settings,
  units,
  loading,
  babies,
  deploymentConfig,
  onSettingsChange,
}: UserSettingsTabProps) {
  const { t } = useLocalization();
  const { unitName, unitSymbol } = useUnit();
  const idPrefix = useId();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="form-label mb-4">{t('Default Units')}</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bottle Feeding Unit */}
            <div>
              <Label className="form-label" htmlFor={`${idPrefix}-bottle-unit`}>{t('Bottle Feeding')}</Label>
              <Select
                value={settings?.defaultBottleUnit || 'OZ'}
                onValueChange={(value) => onSettingsChange({ defaultBottleUnit: value })}
                disabled={loading}
              >
                <SelectTrigger id={`${idPrefix}-bottle-unit`}>
                  <SelectValue placeholder={t("Select unit")} />
                </SelectTrigger>
                <SelectContent>
                  {units
                    .filter(unit => ['OZ', 'ML'].includes(unit.unitAbbr))
                    .map((unit) => (
                      <SelectItem key={unit.unitAbbr} value={unit.unitAbbr}>
                        {unitName(unit.unitName)} ({unitSymbol(unit.unitAbbr)})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Solid Feeding Unit */}
            <div>
              <Label className="form-label" htmlFor={`${idPrefix}-solids-unit`}>{t('Solid Feeding')}</Label>
              <Select
                value={settings?.defaultSolidsUnit || 'TBSP'}
                onValueChange={(value) => onSettingsChange({ defaultSolidsUnit: value })}
                disabled={loading}
              >
                <SelectTrigger id={`${idPrefix}-solids-unit`}>
                  <SelectValue placeholder={t("Select unit")} />
                </SelectTrigger>
                <SelectContent>
                  {units
                    .filter(unit => ['TBSP', 'G'].includes(unit.unitAbbr))
                    .map((unit) => (
                      <SelectItem key={unit.unitAbbr} value={unit.unitAbbr}>
                        {unitName(unit.unitName)} ({unitSymbol(unit.unitAbbr)})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Height Unit */}
            <div>
              <Label className="form-label" htmlFor={`${idPrefix}-height-unit`}>{t('Height')}</Label>
              <Select
                value={settings?.defaultHeightUnit || 'IN'}
                onValueChange={(value) => onSettingsChange({ defaultHeightUnit: value })}
                disabled={loading}
              >
                <SelectTrigger id={`${idPrefix}-height-unit`}>
                  <SelectValue placeholder={t("Select unit")} />
                </SelectTrigger>
                <SelectContent>
                  {units
                    .filter(unit => ['IN', 'CM'].includes(unit.unitAbbr))
                    .map((unit) => (
                      <SelectItem key={unit.unitAbbr} value={unit.unitAbbr}>
                        {unitName(unit.unitName)} ({unitSymbol(unit.unitAbbr)})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Weight Unit */}
            <div>
              <Label className="form-label" htmlFor={`${idPrefix}-weight-unit`}>{t('Weight')}</Label>
              <Select
                value={settings?.defaultWeightUnit || 'LB'}
                onValueChange={(value) => onSettingsChange({ defaultWeightUnit: value })}
                disabled={loading}
              >
                <SelectTrigger id={`${idPrefix}-weight-unit`}>
                  <SelectValue placeholder={t("Select unit")} />
                </SelectTrigger>
                <SelectContent>
                  {units
                    .filter(unit => ['LB', 'KG', 'G'].includes(unit.unitAbbr))
                    .map((unit) => (
                      <SelectItem key={unit.unitAbbr} value={unit.unitAbbr}>
                        {unitName(unit.unitName)} ({unitSymbol(unit.unitAbbr)})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Temperature Unit */}
            <div>
              <Label className="form-label" htmlFor={`${idPrefix}-temp-unit`}>{t('Temperature')}</Label>
              <Select
                value={settings?.defaultTempUnit || 'F'}
                onValueChange={(value) => onSettingsChange({ defaultTempUnit: value })}
                disabled={loading}
              >
                <SelectTrigger id={`${idPrefix}-temp-unit`}>
                  <SelectValue placeholder={t("Select unit")} />
                </SelectTrigger>
                <SelectContent>
                  {units
                    .filter(unit => ['F', 'C'].includes(unit.unitAbbr))
                    .map((unit) => (
                      <SelectItem key={unit.unitAbbr} value={unit.unitAbbr}>
                        {unitName(unit.unitName)} ({unitSymbol(unit.unitAbbr)})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Growth Chart Standard */}
      <div>
        <h3 className="form-label mb-4">{t('Growth Chart Standard')}</h3>
        <p className="text-sm text-gray-500 mb-4">{t('Choose which growth reference to use for percentile calculations.')}</p>
        <div className="max-w-xs">
          <Label className="form-label" htmlFor={`${idPrefix}-growth-standard`}>{t('Standard')}</Label>
          <Select
            value={settings?.growthChartStandard || 'CDC'}
            onValueChange={(value: 'CDC' | 'WHO') => onSettingsChange({ growthChartStandard: value })}
            disabled={loading}
          >
            <SelectTrigger id={`${idPrefix}-growth-standard`}>
              <SelectValue placeholder={t("Select standard")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CDC">
                {t('CDC')} — {t('0–36 months')}
              </SelectItem>
              <SelectItem value="WHO">
                {t('WHO')} — {t('0–24 months')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notification Settings - Only show if enabled */}
      {deploymentConfig?.notificationsEnabled && (
        <NotificationSettings
          babies={babies}
          loading={loading}
        />
      )}
    </div>
  );
}
