'use client';

import React from 'react';
import { useLocalization } from '@/src/context/localization';
import { PageHead } from '@/src/components/landing/PageHead';
import { FeatureRow } from '@/src/components/landing/FeatureRow';
import { FeatureChips } from '@/src/components/landing/FeatureChips';
import { CloseCta } from '@/src/components/landing/CloseCta';
import { LandingButton } from '@/src/components/landing/LandingButton';
import { useLandingActions } from '@/src/components/landing/landing-context';
import { TRACKING_CHIPS, GITHUB_URL } from '@/src/components/landing/landing-data';
import { supportedLanguages } from '@/src/localization/supported-languages-config';

export default function FeaturesPage() {
  const { t } = useLocalization();
  const { openAccountModal } = useLandingActions();

  return (
    <>
      <div className="ld-feathero">
        <PageHead
          kick={t('Features')}
          title={t('Everything a newborn throws at you, one place to write it down.')}
          lede={t('Sixteen kinds of entries, shared with everyone who helps, readable at a glance when the pediatrician asks.')}
        />
        <section style={{ paddingBottom: 56 }}>
          <div className="ld-wrap">
            <div className="ld-sect-head">
              <h2 style={{ position: 'relative', display: 'inline-block' }}>
                {t('Track all of it')}
                <img className="ld-sprite" src="/landing/butterfly-open.svg" alt="" width={52} style={{ top: -34, right: -46, transform: 'rotate(12deg)' }} />
              </h2>
              <p>{t('Every entry takes a couple of taps, remembers your last amounts, and records who logged it.')}</p>
            </div>
            <FeatureChips
              chips={TRACKING_CHIPS.map((chip) => ({ icon: chip.icon, label: t(chip.label) }))}
            />
          </div>
        </section>
      </div>
      <section className="ld-alt" style={{ position: 'relative', overflow: 'hidden' }}>
        <img className="ld-sprite" src="/landing/teddy-hugging.svg" alt="" width={104} style={{ bottom: 28, right: '4%', opacity: 0.9, transform: 'rotate(5deg)' }} />
        <div className="ld-wrap">
          <FeatureRow
            title={t('A care team, not an account')}
            paragraph={t('One family, many hands. Invite the other parent, grandparents, and the nanny with a link and a PIN. Everyone logs into the same timeline, and every entry is signed with who did it.')}
            items={[
              t('Unlimited caretakers, no per-seat pricing'),
              t('Multiple babies per family, switch in one tap'),
              t('Simple PIN login that works for grandparents'),
            ]}
            figure={<img className="ld-shot" src="/landing/add-caretaker.png" alt={t('Add New Caretaker form with name, role, and security PIN')} />}
          />
          <FeatureRow
            flip
            title={t('In grandma’s language too')}
            paragraph={t('Sprout Track speaks eleven languages, and every caretaker picks their own. Mom logs in English, oma logs in Deutsch. Same timeline, same entries.')}
            figure={<FeatureChips center chips={supportedLanguages.map((lang) => ({ label: lang.name }))} />}
          />
          <FeatureRow
            title={t('Answers for the pediatrician')}
            paragraph={t('Daily summaries roll up awake time, sleep, ounces, and diapers. Calendar and report views show the week’s pattern, and a heatmap makes the sleep regression visible before you feel it.')}
            items={[
              t('Full log with filters, search, and date ranges'),
              t('Growth measurements over time'),
            ]}
            figure={<img className="ld-shot" src="/landing/report-card.png" alt={t('Monthly report card with growth percentiles and weight-for-age chart')} />}
          />
          <FeatureRow
            flip
            title={t('Vaccines, with the paperwork attached')}
            paragraph={t('Record each dose with the provider, add notes, and attach the clinic’s PDF or a photo of the card. The whole history lives next to the rest of the log, not in a drawer at home.')}
            items={[
              t('Dose numbers and healthcare provider contacts'),
              t('Images and PDFs stored with each record'),
            ]}
            figure={<img src="/landing/vaccine-tracker.png" alt={t('Vaccine Tracker on a phone showing vaccine history with doses')} style={{ maxWidth: 340, margin: '0 auto', display: 'block' }} />}
          />
          <FeatureRow
            title={t('Solid foods, without the guesswork')}
            paragraph={t('Log every new food with how it went, and flag reactions the moment you see them. The first 100 foods tracker turns starting solids into a checklist you can actually finish, and a record your pediatrician will love.')}
            items={[
              t('First 100 foods checklist with progress'),
              t('Allergy and reaction notes on every food'),
            ]}
            figure={<img src="/landing/food-tracker.png" alt={t('Food Tracker on a phone logging peanut butter with allergen flag and reaction notes')} style={{ maxWidth: 340, margin: '0 auto', display: 'block' }} />}
          />
        </div>
      </section>
      <section>
        <div className="ld-wrap" style={{ maxWidth: 880 }}>
          <div className="ld-sect-head">
            <h2>{t('Open source, top to bottom')}</h2>
            <p>{t('The same code that runs sprout-track.com is on GitHub. Host it yourself for free, or let us run it for $2.99 a month. Either way the data is yours: export it anytime.')}</p>
          </div>
          <div className="ld-cta-row">
            <LandingButton href="/pricing">{t('See pricing')}</LandingButton>
            <LandingButton variant="ghost" href={GITHUB_URL} external>{t('View on GitHub')}</LandingButton>
          </div>
        </div>
      </section>
      <CloseCta
        alt
        heading={t('Two minutes to set up. Free for 14 days.')}
        assure={t('No card required. Then $2.99/month, cancel anytime.')}
        ctaLabel={t('Start my free trial')}
        onCtaClick={() => openAccountModal('register')}
        sprite={<img className="ld-sprite" src="/landing/star-shooting.svg" alt="" width={92} style={{ top: 32, right: '10%', transform: 'rotate(-8deg)' }} />}
      />
    </>
  );
}
