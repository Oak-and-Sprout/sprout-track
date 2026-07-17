'use client';

import React from 'react';
import Link from 'next/link';
import { AccountButton } from '@/src/components/ui/account-button';
import { useLocalization } from '@/src/context/localization';
import { GITHUB_URL } from './landing-data';

export type LandingModalMode = 'login' | 'register' | 'verify' | 'reset-password';

interface LandingNavProps {
  onOpenAccountModal: (mode: LandingModalMode) => void;
  onAccountManagerOpen: () => void;
}

/**
 * Sticky landing nav: logo, Features, Pricing, GitHub, quiet "Log in" link,
 * and the teal trial button. Logged-in users get the AccountButton dropdown
 * (the trial button hides itself via hideWhenLoggedIn).
 */
export function LandingNav({ onOpenAccountModal, onAccountManagerOpen }: LandingNavProps) {
  const { t } = useLocalization();

  return (
    <header className="ld-nav">
      <div className="ld-wrap">
        <Link className="ld-logo" href="/">
          <img src="/sprout-256.png" alt="" width={26} height={26} style={{ borderRadius: '50%' }} />
          <span>{t('Sprout Track')}</span>
        </Link>
        <nav className="ld-nav-links">
          <Link href="/features">{t('Features')}</Link>
          <Link href="/pricing">{t('Pricing')}</Link>
          <a href={GITHUB_URL} rel="noopener">GitHub</a>
          <AccountButton
            label={t('Log in')}
            showIcon={false}
            initialMode="login"
            unstyled
            className="ld-nav-login"
            loggedInClassName="ld-btn"
            onOpenAccountModal={onOpenAccountModal}
            onAccountManagerOpen={onAccountManagerOpen}
          />
          <AccountButton
            label={t('Start my free trial')}
            showIcon={false}
            initialMode="register"
            unstyled
            className="ld-btn"
            hideWhenLoggedIn={true}
            onOpenAccountModal={onOpenAccountModal}
          />
        </nav>
      </div>
    </header>
  );
}
