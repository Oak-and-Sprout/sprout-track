'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/src/components/ui/button';
import { ThemeToggle } from '@/src/components/ui/theme-toggle';
import { AccountButton } from '@/src/components/ui/account-button';
import { MobileMenu } from '@/src/components/ui/mobile-menu';
import SetupWizard from '@/src/components/SetupWizard';
import AccountModal from '@/src/components/modals/AccountModal';
import { Loader2, AlertCircle } from 'lucide-react';
import PrivacyPolicyModal from '@/src/components/modals/privacy-policy';
import TermsOfUseModal from '@/src/components/modals/terms-of-use';import { useLocalization } from '@/src/context/localization';

import '../../home/home.css';

interface AccountStatus {
  accountId: string;
  email: string;
  firstName: string;
  verified: boolean;
  hasFamily: boolean;
  familySlug?: string;
}

export default function AccountFamilySetupPage() {
  const { t } = useLocalization();

  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  
  // Account modal state
  const [showAccountModal, setShowAccountModal] = useState(false);
  
  // Privacy Policy and Terms of Use modal state
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTermsOfUse, setShowTermsOfUse] = useState(false);

  useEffect(() => {
    const checkAccountStatus = async () => {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        // Not logged in - redirect to coming soon page
        router.push('/coming-soon');
        return;
      }

      try {
        const response = await fetch('/api/accounts/status', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            const status = data.data;
            
            // Check if user is verified
            if (!status.verified) {
              setError('Please verify your email address before setting up your family.');
              setIsLoading(false);
              return;
            }
            
            // Check if family already exists
            if (status.hasFamily) {
              // Already has family - redirect to family dashboard
              router.push(`/${status.familySlug}`);
              return;
            }
            
            // All good - can proceed with family setup
            setAccountStatus(status);
            setIsLoading(false);
          } else {
            setError('Failed to verify account status.');
            setIsLoading(false);
          }
        } else {
          // Token might be invalid
          localStorage.removeItem('authToken');
          localStorage.removeItem('accountUser');
          router.push('/coming-soon');
        }
      } catch (error) {
        console.error('Error checking account status:', error);
        setError('Network error. Please check your connection.');
        setIsLoading(false);
      }
    };

    checkAccountStatus();
  }, [router]);

  const handleSetupComplete = (family: { id: string; name: string; slug: string }) => {
    console.log('Family setup completed:', family);
    
    // Update localStorage with family info
    const accountUser = localStorage.getItem('accountUser');
    if (accountUser) {
      try {
        const user = JSON.parse(accountUser);
        user.familySlug = family.slug;
        localStorage.setItem('accountUser', JSON.stringify(user));
      } catch (error) {
        console.error('Error updating cached user info:', error);
      }
    }
    
    // Redirect to family dashboard
    router.push(`/${family.slug}`);
  };

  if (isLoading) {
    return (
      <div className="saas-homepage">
        {/* Header */}
        <header className="saas-header">
          <nav className="saas-nav">
            <div className="saas-nav-content">
              <Link href="/" className="saas-logo">
                <img 
                  src="/sprout-256.png" 
                  alt="Sprout Track Logo" 
                  className="saas-logo-image"
                />
                <span className="saas-logo-text">{t('Sprout Track')}</span>
              </Link>
              <MobileMenu>
                <AccountButton 
                  label="Sign In" 
                  showIcon={false} 
                  initialMode="login"
                  className="saas-account-btn" 
                />
                <ThemeToggle variant="light" className="saas-theme-toggle" />
              </MobileMenu>
            </div>
          </nav>
        </header>

        {/* Loading Content */}
        <div className="min-h-screen flex items-center justify-center p-4" style={{ paddingTop: '6rem' }}>
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-teal-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
              {t('Checking Account Status')}
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              {t('Please wait while we verify your account...')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="saas-footer">
          <div className="saas-footer-content">
            <div className="saas-footer-brand">
              <Link href="/" className="saas-logo">
                <img 
                  src="/sprout-256.png" 
                  alt="Sprout Track Logo" 
                  className="saas-logo-image"
                />
                <span className="saas-logo-text">{t('Sprout Track')}</span>
              </Link>
              <p className="saas-footer-description">
                {t('Sprouting into something amazing.')}
              </p>
            </div>
            <div className="saas-footer-demo">
              <Button 
                size="lg" 
                className="mb-4" 
                asChild
              >
                <a 
                  href="https://demo.sprout-track.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  {t('Try the Demo')}
                </a>
              </Button>
              <p className="saas-footer-description text-sm mb-4">
                {t('Demo refreshes every 2 hours')}
              </p>
              <div className="space-y-1">
                <p className="saas-footer-description text-sm">
                  <strong>{t('Demo Access:')}</strong>
                </p>
                <p className="saas-footer-description text-sm">
                  {t('Login IDs: 01, 02, 03')}
                </p>
                <p className="saas-footer-description text-sm">
                  {t('PIN: 111222')}
                </p>
              </div>
            </div>
          </div>
          <div className="saas-footer-bottom relative flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <p className="saas-footer-copyright">
                {t('© 2025 Oak and Sprout. All rights reserved.')}
              </p>
              <div className="flex items-center gap-4 text-sm">
                <button
                  onClick={() => setShowPrivacyPolicy(true)}
                  className="text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer underline-offset-4 hover:underline"
                >
                  {t('Privacy Policy')}
                </button>
                <button
                  onClick={() => setShowTermsOfUse(true)}
                  className="text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer underline-offset-4 hover:underline"
                >
                  {t('Terms of Use')}
                </button>
              </div>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  if (error) {
    return (
      <div className="saas-homepage">
        {/* Header */}
        <header className="saas-header">
          <nav className="saas-nav">
            <div className="saas-nav-content">
              <Link href="/" className="saas-logo">
                <img 
                  src="/sprout-256.png" 
                  alt="Sprout Track Logo" 
                  className="saas-logo-image"
                />
                <span className="saas-logo-text">{t('Sprout Track')}</span>
              </Link>
              <MobileMenu>
                <AccountButton 
                  label="Sign In" 
                  showIcon={false} 
                  initialMode="login"
                  className="saas-account-btn" 
                />
                <ThemeToggle variant="light" className="saas-theme-toggle" />
              </MobileMenu>
            </div>
          </nav>
        </header>

        {/* Error Content */}
        <div className="min-h-screen flex items-center justify-center p-4" style={{ paddingTop: '6rem' }}>
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
              {t('Access Denied')}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              {error}
            </p>
            <button
              onClick={() => router.push('/coming-soon')}
              className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
            >
              {t('Return to Home')}
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className="saas-footer">
          <div className="saas-footer-content">
            <div className="saas-footer-brand">
              <Link href="/" className="saas-logo">
                <img 
                  src="/sprout-256.png" 
                  alt="Sprout Track Logo" 
                  className="saas-logo-image"
                />
                <span className="saas-logo-text">{t('Sprout Track')}</span>
              </Link>
              <p className="saas-footer-description">
                {t('Sprouting into something amazing.')}
              </p>
            </div>
            <div className="saas-footer-demo">
              <Button 
                size="lg" 
                className="mb-4" 
                asChild
              >
                <a 
                  href="https://demo.sprout-track.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  {t('Try the Demo')}
                </a>
              </Button>
              <p className="saas-footer-description text-sm mb-4">
                {t('Demo refreshes every 2 hours')}
              </p>
              <div className="space-y-1">
                <p className="saas-footer-description text-sm">
                  <strong>{t('Demo Access:')}</strong>
                </p>
                <p className="saas-footer-description text-sm">
                  {t('Login IDs: 01, 02, 03')}
                </p>
                <p className="saas-footer-description text-sm">
                  {t('PIN: 111222')}
                </p>
              </div>
            </div>
          </div>
          <div className="saas-footer-bottom relative flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <p className="saas-footer-copyright">
                {t('© 2025 Oak and Sprout. All rights reserved.')}
              </p>
              <div className="flex items-center gap-4 text-sm">
                <button
                  onClick={() => setShowPrivacyPolicy(true)}
                  className="text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer underline-offset-4 hover:underline"
                >
                  {t('Privacy Policy')}
                </button>
                <button
                  onClick={() => setShowTermsOfUse(true)}
                  className="text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer underline-offset-4 hover:underline"
                >
                  {t('Terms of Use')}
                </button>
              </div>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  if (!accountStatus) {
    return null; // Should not reach here
  }

  return (
    <div className="saas-homepage">
      {/* Header */}
      <header className="saas-header">
        <nav className="saas-nav">
          <div className="saas-nav-content">
            <Link href="/" className="saas-logo">
              <img 
                src="/sprout-256.png" 
                alt="Sprout Track Logo" 
                className="saas-logo-image"
              />
              <span className="saas-logo-text">{t('Sprout Track')}</span>
            </Link>
            <MobileMenu>
              <AccountButton className="saas-account-btn" />
              <ThemeToggle variant="light" className="saas-theme-toggle" />
            </MobileMenu>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="min-h-screen">
        <div className="w-full h-full">
          {/* Setup Wizard */}
          <SetupWizard 
            onComplete={handleSetupComplete}
            initialSetup={false}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="saas-footer">
        <div className="saas-footer-content">
          <div className="saas-footer-brand">
            <Link href="/" className="saas-logo">
              <img 
                src="/sprout-256.png" 
                alt="Sprout Track Logo" 
                className="saas-logo-image"
              />
              <span className="saas-logo-text">{t('Sprout Track')}</span>
            </Link>
            <p className="saas-footer-description">
              {t('Sprouting into something amazing.')}
            </p>
          </div>
          <div className="saas-footer-demo">
            <Button 
              size="lg" 
              className="mb-4" 
              asChild
            >
              <a 
                href="https://demo.sprout-track.com" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                {t('Try the Demo')}
              </a>
            </Button>
            <p className="saas-footer-description text-sm mb-4">
              {t('Demo refreshes every 2 hours')}
            </p>
            <div className="space-y-1">
              <p className="saas-footer-description text-sm">
                <strong>{t('Demo Access:')}</strong>
              </p>
              <p className="saas-footer-description text-sm">
                {t('Login IDs: 01, 02, 03')}
              </p>
              <p className="saas-footer-description text-sm">
                {t('PIN: 111222')}
              </p>
            </div>
          </div>
        </div>
        <div className="saas-footer-bottom relative flex flex-col sm:flex-row items-center justify-center gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <p className="saas-footer-copyright">
              {t('© 2025 Oak and Sprout. All rights reserved.')}
            </p>
            <div className="flex items-center gap-4 text-sm">
              <button
                onClick={() => setShowPrivacyPolicy(true)}
                className="text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer underline-offset-4 hover:underline"
              >
                {t('Privacy Policy')}
              </button>
              <button
                onClick={() => setShowTermsOfUse(true)}
                className="text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer underline-offset-4 hover:underline"
              >
                {t('Terms of Use')}
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Account Modal */}
      <AccountModal 
        open={showAccountModal} 
        onClose={() => setShowAccountModal(false)}
      />

      {/* Privacy Policy Modal */}
      <PrivacyPolicyModal 
        open={showPrivacyPolicy} 
        onClose={() => setShowPrivacyPolicy(false)} 
      />

      {/* Terms of Use Modal */}
      <TermsOfUseModal 
        open={showTermsOfUse} 
        onClose={() => setShowTermsOfUse(false)} 
      />
    </div>
  );
}
