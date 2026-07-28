'use client';

import React, { useState } from 'react';
import { useLocalization } from '@/src/context/localization';
import { startGiftCheckout } from '@/src/utils/gift-checkout';

/** "Give Sprout Track to someone" box — mirrors SelfHostCallout's ld-selfhost card. */
export function GiftCallout() {
  const { t } = useLocalization();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGift = async () => {
    setLoading(true);
    setError(null);
    const failure = await startGiftCheckout();
    if (failure) {
      setError(failure);
      setLoading(false);
    }
  };

  return (
    <div className="ld-selfhost">
      <b>{t('Give Sprout Track to someone')}</b>
      <p>{t('Buy a lifetime license as a gift — we’ll email you a code they can redeem on their own account.')}</p>
      {/* LandingButton has no disabled prop, so a plain button matches its rendered markup here. */}
      <button type="button" className="ld-btn" onClick={handleGift} disabled={loading}>
        {loading ? t('Loading...') : t('Give a lifetime license')}
      </button>
      {error && <p style={{ color: '#dc2626', marginTop: 8 }}>{t(error)}</p>}
    </div>
  );
}
