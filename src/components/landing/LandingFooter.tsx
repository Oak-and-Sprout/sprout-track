'use client';

import React from 'react';
import Link from 'next/link';
import { LanguageSelector } from '@/src/components/ui/side-nav/language-selector';
import { useLocalization } from '@/src/context/localization';
import { GITHUB_URL, DEMO_URL } from './landing-data';

/** Landing footer: page links, language selector, Open Glades copyright. */
export function LandingFooter() {
  const { t } = useLocalization();

  return (
    <footer className="ld-footer">
      <div className="ld-wrap">
        <Link className="ld-logo" href="/" style={{ fontSize: 17 }}>
          <img src="/sprout-256.png" alt="" width={20} height={20} style={{ borderRadius: '50%' }} />
          <span>{t('Sprout Track')}</span>
        </Link>
        <nav>
          <Link href="/features">{t('Features')}</Link>
          <Link href="/pricing">{t('Pricing')}</Link>
          <a href={DEMO_URL} rel="noopener">{t('Demo')}</a>
          <a href={GITHUB_URL} rel="noopener">GitHub</a>
          <Link href="/terms">{t('Terms')}</Link>
          <Link href="/privacy">{t('Privacy')}</Link>
        </nav>
        <div className="ld-footer-meta">
          <LanguageSelector />
          <span>
            © 2025–2026{' '}
            <a href="https://www.openglades.com" rel="noopener">Open Glades LLC</a>
            {' '}· Kansas City
          </span>
        </div>
      </div>
    </footer>
  );
}
