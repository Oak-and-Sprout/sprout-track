'use client';

import React from 'react';
import { useLocalization } from '@/src/context/localization';
import { PageHead } from '@/src/components/landing/PageHead';
import { PlanCard } from '@/src/components/landing/PlanCard';
import { SelfHostCallout } from '@/src/components/landing/SelfHostCallout';
import { FaqAccordion } from '@/src/components/landing/FaqAccordion';
import { CloseCta } from '@/src/components/landing/CloseCta';
import { useLandingActions } from '@/src/components/landing/landing-context';
import { LANDING_PLANS, FAQ_ITEMS } from '@/src/components/landing/landing-data';

export default function PricingPage() {
  const { t } = useLocalization();
  const { openAccountModal } = useLandingActions();

  return (
    <>
      <PageHead
        kick={t('Pricing')}
        title={t('Cheaper than one canister of formula.')}
        lede={t('Every plan includes every feature, unlimited caretakers, and unlimited babies. Pick how you’d like to pay, or don’t pay at all and host it yourself.')}
        photoClass="ld-pagehead-photo"
        centered
      />
      <section id="plans" style={{ position: 'relative', overflow: 'hidden' }}>
        <img className="ld-sprite" src="/landing/teddy-waving.svg" alt="" width={100} style={{ top: 40, left: '5%', transform: 'rotate(-5deg)' }} />
        <div className="ld-wrap">
          <div className="ld-plans">
            {LANDING_PLANS.map((plan) => (
              <PlanCard key={plan.id} plan={plan} onSelect={() => openAccountModal('register')} />
            ))}
          </div>
          <SelfHostCallout />
        </div>
      </section>
      <section className="ld-alt" style={{ position: 'relative', overflow: 'hidden' }}>
        <img className="ld-sprite" src="/landing/puppy-sleeping.svg" alt="" width={96} style={{ bottom: 20, right: '6%', opacity: 0.85, transform: 'rotate(3deg)' }} />
        <div className="ld-wrap">
          <div className="ld-sect-head ld-sect-head-center">
            <h2>{t('Fair questions')}</h2>
          </div>
          <FaqAccordion items={FAQ_ITEMS} />
        </div>
      </section>
      <CloseCta
        heading={t('Try it free for 14 days.')}
        sub={t('No card required. Set up takes about two minutes.')}
        ctaLabel={t('Start my free trial')}
        onCtaClick={() => openAccountModal('register')}
        sprite={<img className="ld-sprite" src="/landing/star-sparkle.svg" alt="" width={76} style={{ top: 30, left: '9%', transform: 'rotate(-10deg)' }} />}
      />
    </>
  );
}
