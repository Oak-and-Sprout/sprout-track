'use client';

import React from 'react';
import { useLocalization } from '@/src/context/localization';
import { GITHUB_URL } from './landing-data';
import { LandingButton } from './LandingButton';

/** Dashed "Self-host, free forever" box under the plan cards. */
export function SelfHostCallout() {
  const { t } = useLocalization();

  return (
    <div className="ld-selfhost">
      <b>{t('Self-host, free forever')}</b>
      <p>{t('Sprout Track is open source. Run it on your own server with Docker and pay nothing, ever. Same features, your hardware, your backups.')}</p>
      <LandingButton variant="ghost" href={GITHUB_URL} external>{t('Get the code')}</LandingButton>
    </div>
  );
}
