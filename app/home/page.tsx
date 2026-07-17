'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import AccountModal from '@/src/components/modals/AccountModal';
import AccountManager from '@/src/components/account-manager';
import { useLocalization } from '@/src/context/localization';
import { LandingNav, LandingModalMode } from '@/src/components/landing/LandingNav';
import { LandingFooter } from '@/src/components/landing/LandingFooter';
import { LandingHero } from '@/src/components/landing/LandingHero';
import { DayStory } from '@/src/components/landing/DayStory';
import { FeatureRow } from '@/src/components/landing/FeatureRow';
import { CloseCta } from '@/src/components/landing/CloseCta';
import { GITHUB_URL } from '@/src/components/landing/landing-data';
import { literata, alegreyaSans } from '@/src/components/landing/fonts';
import '@/src/components/landing/landing.css';

const home = () => {
  const { t } = useLocalization();

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountModalMode, setAccountModalMode] = useState<LandingModalMode>('register');
  const [verificationToken, setVerificationToken] = useState<string | undefined>();
  const [resetToken, setResetToken] = useState<string | undefined>();
  const [showAccountManager, setShowAccountManager] = useState(false);

  // Check for verification, password reset hashes, and upgrade query parameter on load
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#verify?')) {
        const urlParams = new URLSearchParams(hash.substring(8)); // Remove '#verify?'
        const token = urlParams.get('token');
        if (token) {
          setVerificationToken(token);
          setAccountModalMode('verify');
          setShowAccountModal(true);
          // Clear the hash after processing
          window.history.replaceState(null, '', window.location.pathname);
        }
      } else if (hash.startsWith('#passwordreset?')) {
        const urlParams = new URLSearchParams(hash.substring(15)); // Remove '#passwordreset?'
        const token = urlParams.get('token');
        if (token) {
          setResetToken(token);
          setAccountModalMode('reset-password');
          setShowAccountModal(true);
          // Clear the hash after processing
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    };

    const checkQueryParams = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const upgrade = urlParams.get('upgrade');
      const login = urlParams.get('login');

      if (upgrade === 'true') {
        // Show login modal for account upgrade
        setAccountModalMode('login');
        setShowAccountModal(true);

        // Clear the query parameter after processing
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('upgrade');
        newUrl.searchParams.delete('family');
        window.history.replaceState(null, '', newUrl.toString());
      } else if (login === 'true') {
        // Show login modal from email link
        setAccountModalMode('login');
        setShowAccountModal(true);

        // Clear the query parameter after processing
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('login');
        window.history.replaceState(null, '', newUrl.toString());
      }
    };

    // Check on mount
    checkHash();
    checkQueryParams();

    // Listen for hash changes
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  const openAccountModal = (mode: LandingModalMode) => {
    setAccountModalMode(mode);
    setShowAccountModal(true);
  };

  return (
    <div className={`${literata.variable} ${alegreyaSans.variable} landing-root`}>
      <LandingNav
        onOpenAccountModal={openAccountModal}
        onAccountManagerOpen={() => setShowAccountManager(true)}
      />

      <LandingHero onTrialClick={() => openAccountModal('register')} />

      {/* How families use it */}
      <section className="ld-alt" style={{ position: 'relative', overflow: 'hidden' }}>
        <img className="ld-sprite" src="/landing/kitten.svg" alt="" width={96} style={{ top: 40, right: '6%', opacity: 0.85, transform: 'rotate(5deg)' }} />
        <div className="ld-wrap">
          <div className="ld-sect-head">
            <span className="ld-kick">{t('How families use it')}</span>
            <h2>{t('One Tuesday, tracked together.')}</h2>
            <p>{t('Every entry shows who logged it, and everyone sees it the moment it happens. Here is a real shape of a day:')}</p>
          </div>
          <DayStory />
        </div>
      </section>

      {/* Built for 3 am hands */}
      <section>
        <div className="ld-wrap">
          <div className="ld-sect-head">
            <span className="ld-kick">{t('Built for 3 am hands')}</span>
            <h2>{t('Fast enough to use one-handed, in the dark.')}</h2>
          </div>
          <FeatureRow
            title={t('Log anything in two taps')}
            paragraph={t('Sleep, feeds, diapers, pumping, medicine, baths, milestones, measurements. Big targets, sensible defaults, and the last amount pre-filled, because you are holding a baby with the other arm.')}
            items={[
              t('Timers for naps, nursing, and pumping sessions'),
              t('Works on any phone, tablet, or laptop browser'),
            ]}
            figure={<img src="/landing/log-feeding.png" alt={t('Log Feeding on a phone: breast or bottle, bottle type, and amount stepper')} style={{ maxWidth: 'min(340px,100%)', margin: '0 auto', display: 'block' }} />}
          />
          <FeatureRow
            flip
            title={t('The whole day at a glance')}
            paragraph={t('A daily summary up top, the full timeline below. Awake time, total sleep, ounces, diapers: the pediatrician’s questions, already answered.')}
            items={[
              t('Calendar, reports, and pattern heatmaps'),
              t('Vaccine records with documents attached'),
            ]}
            figure={<img className="ld-shot" src="/landing/daily-log.png" alt={t('Sprout Track daily log with summary and timeline')} />}
          />
          <FeatureRow
            title={t('Nursery mode, for the crib-side tablet')}
            paragraph={t('A dimmed, always-on display made for the changing table. Tap once to log a feed or start a sleep timer, without waking anyone up.')}
            items={[
              t('Screen wake lock and adjustable dimming'),
              t('Choose which activity tiles appear'),
            ]}
            figure={<img src="/landing/nursery-mode.png" alt={t('Nursery mode on a tablet: dimmed clock with one-tap feed, pump, diaper, and sleep tiles')} style={{ display: 'block', width: '100%' }} />}
          />
          <div style={{ textAlign: 'center', paddingTop: 34 }}>
            <Link className="ld-btn" href="/features">{t('See every feature')}</Link>
          </div>
        </div>
      </section>

      {/* Data privacy band */}
      <section className="ld-alt">
        <div className="ld-wrap" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 28, alignItems: 'start', maxWidth: 880 }}>
          <Shield size={52} strokeWidth={1.6} color="#0c6b62" aria-hidden="true" />
          <div>
            <h2 style={{ fontSize: 'clamp(24px,3vw,32px)', marginBottom: 10 }}>{t('Your baby’s data isn’t a product.')}</h2>
            <p style={{ maxWidth: '60ch' }}>{t('Sprout Track is open source. No ads, no data brokers, no selling nap schedules to formula companies. Export everything whenever you like, and if you’d rather run it on your own server, the code is free and always will be.')}</p>
            <p style={{ marginTop: 12 }}>
              <a href={GITHUB_URL} rel="noopener">{t('Read the source on GitHub')}</a>
            </p>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="ld-wrap" style={{ textAlign: 'center' }}>
          <img className="ld-sprite" src="/landing/rocket.svg" alt="" width={84} style={{ top: 30, left: '7%', transform: 'rotate(-8deg)' }} />
          <h2 style={{ fontSize: 'clamp(26px,3.2vw,38px)', marginBottom: 10 }}>{t('Pricing that respects a diaper budget.')}</h2>
          <p style={{ maxWidth: '52ch', margin: '0 auto' }}>
            {t('Hosted for')} <b>{t('$2.99 a month')}</b> {t('after your free trial, or')} <b>{t('$19.99 once')}</b> {t('and it’s yours for life. Self-hosting is free forever.')}
          </p>
          <div className="ld-cta-row" style={{ justifyContent: 'center' }}>
            <Link className="ld-btn" href="/pricing">{t('See pricing')}</Link>
          </div>
        </div>
      </section>

      {/* From the maker */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="ld-wrap" style={{ maxWidth: 880 }}>
          <span className="ld-kick">{t('From the maker')}</span>
          <h2 style={{ fontSize: 'clamp(24px,3vw,32px)', margin: '10px 0 12px' }}>{t('Built in Kansas City. Funded by families, not venture capital.')}</h2>
          <p style={{ maxWidth: '62ch' }}>{t('Sprout Track is made by Open Glades LLC, an independent, one-developer shop in Kansas City. There are no investors expecting your data to become a revenue stream, and no growth team designing streaks to keep you hooked. Subscriptions pay for the servers; that’s the whole business model, and it’s why the price is $2.99.')}</p>
        </div>
      </section>

      <CloseCta
        alt
        heading={t('Start tonight. The 3 am shift will thank you.')}
        sub={t('Set up takes about two minutes. Invite the grandparents whenever you’re ready.')}
        assure={t('14 days free, no card required. Cancel anytime.')}
        ctaLabel={t('Start my free trial')}
        onCtaClick={() => openAccountModal('register')}
        sprite={<img className="ld-sprite" src="/landing/star.svg" alt="" width={96} style={{ top: 36, right: '12%', transform: 'rotate(10deg)' }} />}
      />

      <LandingFooter />

      <AccountModal
        open={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        initialMode={accountModalMode}
        verificationToken={verificationToken}
        resetToken={resetToken}
      />
      <AccountManager
        isOpen={showAccountManager}
        onClose={() => setShowAccountManager(false)}
      />
    </div>
  );
};

export default home;
