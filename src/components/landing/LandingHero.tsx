'use client';

import React, { useState, useEffect } from 'react';
import { useLocalization } from '@/src/context/localization';
import {
  LandingStats,
  LANDING_STATS_FALLBACK,
  formatFamilyCount,
} from '@/src/utils/landing-stats';
import { DEMO_URL } from './landing-data';
import { LandingButton } from './LandingButton';

interface LandingHeroProps {
  onTrialClick: () => void;
}

/** Home hero: headline, CTAs, live proof stats, browser-frame screenshot. */
export function LandingHero({ onTrialClick }: LandingHeroProps) {
  const { t } = useLocalization();
  const [stats, setStats] = useState<LandingStats>(LANDING_STATS_FALLBACK);

  useEffect(() => {
    fetch('/api/landing-stats')
      .then((response) => response.json())
      .then((result) => {
        if (result.success && result.data) setStats(result.data);
      })
      .catch(() => {
        /* fallback stays */
      });
  }, []);

  return (
    <section className="ld-hero">
      <div className="ld-wrap">
        <div>
          <span className="ld-kick">{t('The shareable baby tracker')}</span>
          <h1>
            {t('Everyone who loves your baby,')} <em>{t('on the same page.')}</em>
          </h1>
          <p className="ld-lede">
            {t('Sprout Track keeps parents, grandparents, and caretakers logging feeds, naps, and diapers in one shared place. The afternoon handoff stops needing a sticky note.')}
          </p>
          <div className="ld-cta-row" id="trial">
            <LandingButton size="big" onClick={onTrialClick}>
              {t('Start my free trial')}
            </LandingButton>
            <LandingButton
              size="big"
              variant="ghost"
              href={DEMO_URL}
              external
              style={{ flexDirection: 'column', gap: 2, lineHeight: 1.25 }}
            >
              <span>{t('Poke around the live demo')}</span>
              <span className="ld-assure" style={{ margin: 0, fontSize: 13, fontWeight: 400 }}>
                {t('ID: 01 · PIN: 111111')}
              </span>
            </LandingButton>
          </div>
          <p className="ld-assure">{t('14 days free, no card required. Then $2.99/month, cancel anytime.')}</p>
          <p className="ld-proof">
            <b>{formatFamilyCount(stats.families)} {t('families')}</b> {t('track with Sprout Track')}
            <span className="ld-dot"></span>
            {t('open source,')} <b>{stats.stars} {t('stars')}</b> {t('on GitHub')}
          </p>
        </div>
        <div style={{ position: 'relative' }}>
          <img className="ld-sprite" src="/landing/butterfly.svg" alt="" width={74} style={{ top: -46, right: -8, transform: 'rotate(8deg)' }} />
          <div className="ld-frame">
            <div className="ld-frame-bar">
              <i></i><i></i><i></i>
              <span>sprout-track.com</span>
            </div>
            <img
              className="ld-hero-shot"
              src="/landing/hero-daily-log.png"
              alt={t('Sprout Track log entry: daily summary and timeline')}
            />
          </div>
          <img className="ld-sprite" src="/landing/teddy.svg" alt="" width={120} style={{ bottom: -38, left: -52, transform: 'rotate(-6deg)' }} />
        </div>
      </div>
    </section>
  );
}
