'use client';

import React from 'react';
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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="form-label mb-4">{t('Default Units')}</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bottle Feeding Unit */}
            <div>
              <Label className="form-label">{t('Bottle Feeding')}</Label>
              <Select
                value={settings?.defaultBottleUnit || 'OZ'}
                onValueChange={(value) => onSettingsChange({ defaultBottleUnit: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("Select unit")} />
                </SelectTrigger>
                <SelectContent>
                  {units
                    .filter(unit => ['OZ', 'ML'].includes(unit.unitAbbr))
                    .map((unit) => (
                      <SelectItem key={unit.unitAbbr} value={unit.unitAbbr}>
                        {unit.unitName} ({unit.unitAbbr})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Solid Feeding Unit */}
            <div>
              <Label className="form-label">{t('Solid Feeding')}</Label>
              <Select
                value={settings?.defaultSolidsUnit || 'TBSP'}
                onValueChange={(value) => onSettingsChange({ defaultSolidsUnit: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("Select unit")} />
                </SelectTrigger>
                <SelectContent>
                  {units
                    .filter(unit => ['TBSP', 'G'].includes(unit.unitAbbr))
                    .map((unit) => (
                      <SelectItem key={unit.unitAbbr} value={unit.unitAbbr}>
                        {unit.unitName} ({unit.unitAbbr})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Height Unit */}
            <div>
              <Label className="form-label">{t('Height')}</Label>
              <Select
                value={settings?.defaultHeightUnit || 'IN'}
                onValueChange={(value) => onSettingsChange({ defaultHeightUnit: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("Select unit")} />
                </SelectTrigger>
                <SelectContent>
                  {units
                    .filter(unit => ['IN', 'CM'].includes(unit.unitAbbr))
                    .map((unit) => (
                      <SelectItem key={unit.unitAbbr} value={unit.unitAbbr}>
                        {unit.unitName} ({unit.unitAbbr})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Weight Unit */}
            <div>
              <Label className="form-label">{t('Weight')}</Label>
              <Select
                value={settings?.defaultWeightUnit || 'LB'}
                onValueChange={(value) => onSettingsChange({ defaultWeightUnit: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("Select unit")} />
                </SelectTrigger>
                <SelectContent>
                  {units
                    .filter(unit => ['LB', 'KG', 'G'].includes(unit.unitAbbr))
                    .map((unit) => (
                      <SelectItem key={unit.unitAbbr} value={unit.unitAbbr}>
                        {unit.unitName} ({unit.unitAbbr})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Temperature Unit */}
            <div>
              <Label className="form-label">{t('Temperature')}</Label>
              <Select
                value={settings?.defaultTempUnit || 'F'}
                onValueChange={(value) => onSettingsChange({ defaultTempUnit: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("Select unit")} />
                </SelectTrigger>
                <SelectContent>
                  {units
                    .filter(unit => ['F', 'C'].includes(unit.unitAbbr))
                    .map((unit) => (
                      <SelectItem key={unit.unitAbbr} value={unit.unitAbbr}>
                        {unit.unitName} ({unit.unitAbbr})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
