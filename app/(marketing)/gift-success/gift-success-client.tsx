'use client';

import React from 'react';
import { useLocalization } from '@/src/context/localization';
import { LandingButton } from '@/src/components/landing/LandingButton';

export default function GiftSuccessPage() {
  const { t } = useLocalization();
  return (
    <section style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="ld-wrap" style={{ textAlign: 'center' }}>
        <h1>{t('Thank you for giving Sprout Track!')}</h1>
        <p style={{ maxWidth: '52ch', margin: '16px auto' }}>
          {t('Your gift code is on its way — check your email. The recipient can redeem it from their account settings after creating a free account.')}
        </p>
        <div className="ld-cta-row" style={{ justifyContent: 'center' }}>
          <LandingButton href="/">{t('Back to home')}</LandingButton>
        </div>
      </div>
    </section>
  );
}
