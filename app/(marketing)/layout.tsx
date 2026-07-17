'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LocalizationProvider } from '@/src/context/localization';
import { ThemeProvider } from '@/src/context/theme';
import AccountModal from '@/src/components/modals/AccountModal';
import AccountManager from '@/src/components/account-manager';
import { ToastProvider } from '@/src/components/ui/toast';
import { LandingNav, LandingModalMode } from '@/src/components/landing/LandingNav';
import { LandingFooter } from '@/src/components/landing/LandingFooter';
import { LandingActionsProvider } from '@/src/components/landing/landing-context';
import { literata, alegreyaSans } from '@/src/components/landing/fonts';
import '@/src/components/landing/landing.css';

/**
 * Shared chrome for the SaaS marketing pages (/features, /pricing, /terms,
 * /privacy). Self-hosted deployments are redirected to '/'.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isSaas, setIsSaas] = useState<boolean | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountModalMode, setAccountModalMode] = useState<LandingModalMode>('register');
  const [showAccountManager, setShowAccountManager] = useState(false);

  useEffect(() => {
    fetch('/api/deployment-config')
      .then((response) => response.json())
      .then((result) => {
        if (result.success && result.data?.deploymentMode === 'saas') {
          setIsSaas(true);
        } else {
          setIsSaas(false);
          router.replace('/');
        }
      })
      .catch(() => {
        setIsSaas(false);
        router.replace('/');
      });
  }, [router]);

  const openAccountModal = (mode: LandingModalMode) => {
    setAccountModalMode(mode);
    setShowAccountModal(true);
  };

  if (!isSaas) return null;

  return (
    <LocalizationProvider>
      <ThemeProvider>
        <ToastProvider>
        <LandingActionsProvider value={{ openAccountModal }}>
          <div className={`${literata.variable} ${alegreyaSans.variable} landing-root`}>
            <LandingNav
              onOpenAccountModal={openAccountModal}
              onAccountManagerOpen={() => setShowAccountManager(true)}
            />
            {children}
            <LandingFooter />
            <AccountModal
              open={showAccountModal}
              onClose={() => setShowAccountModal(false)}
              initialMode={accountModalMode}
            />
            <AccountManager
              isOpen={showAccountManager}
              onClose={() => setShowAccountManager(false)}
            />
          </div>
        </LandingActionsProvider>
        </ToastProvider>
      </ThemeProvider>
    </LocalizationProvider>
  );
}
