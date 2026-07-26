'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoginSecurity from '@/src/components/LoginSecurity';
import { useTheme } from '@/src/context/theme';
import { useLocalization } from '@/src/context/localization';
import { Eye, EyeOff } from 'lucide-react';
import { FamilyResponse } from '@/app/api/types';
import { literata, alegreyaSans } from '@/src/components/landing/fonts';
import '@/src/components/ui/storybook-drawer/storybook-drawer.css';
import { STORAGE } from '@/constants';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const { t } = useLocalization();
  const [families, setFamilies] = useState<FamilyResponse[]>([]);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Token authentication state
  const [tokenPassword, setTokenPassword] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);
  const [showTokenPassword, setShowTokenPassword] = useState(false);

  // Ref for focus management
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Check if this is a setup flow
  const setupType = searchParams.get('setup');
  const setupToken = searchParams.get('token');
  const isSetupFlow = setupType === 'true';
  const isTokenSetupFlow = setupType === 'token' && setupToken;

  // Load families for the dropdown
  useEffect(() => {
    const loadFamilies = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/family/public-list');
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.data)) {
            setFamilies(data.data);
            if (data.data.length === 1) {
              setSelectedFamily(data.data[0].slug);
            }
          }
        }
      } catch (error) {
        console.error('Error loading families:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isSetupFlow && !isTokenSetupFlow) {
      loadFamilies();
    } else {
      setLoading(false);
    }
  }, [isSetupFlow, isTokenSetupFlow]);

  // Autofocus input on screen mount safely
  useEffect(() => {
    if (isTokenSetupFlow && passwordInputRef.current) {
      // Small timeout ensures the DOM has fully settled before requesting focus
      const timer = setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isTokenSetupFlow]);

  const handleTokenAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tokenPassword.trim()) {
      setTokenError(t('Password is required'));
      return;
    }

    if (!setupToken) {
      setTokenError(t('Setup token not found'));
      return;
    }

    try {
      setTokenLoading(true);
      setTokenError('');

      const response = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: setupToken,
          password: tokenPassword,
        }),
      });

      const data = await response.json();

      if (data.success && data.data) {
        localStorage.setItem(STORAGE.AUTH_TOKEN, data.data.token);
        localStorage.setItem(STORAGE.UNLOCK_TIME, Date.now().toString());
        router.push(`/setup/${setupToken}`);
      } else {
        setTokenError(data.error || t('Invalid password'));
        setTokenPassword('');

        // Let the screen reader read the error block FIRST before forcing focus change
        setTimeout(() => {
          passwordInputRef.current?.focus();
        }, 200);
      }
    } catch (error) {
      console.error('Token authentication error:', error);
      setTokenError(t('Authentication failed. Please try again.'));
      setTokenPassword('');
    } finally {
      setTokenLoading(false);
    }
  };

  const handleUnlock = (caretakerId?: string) => {
    if (isTokenSetupFlow) {
      router.push(`/setup/${setupToken}`);
    } else if (isSetupFlow) {
      router.push('/setup');
    } else {
      router.push('/');
    }
  };

  // Check if already authenticated on page load
  useEffect(() => {
    const authToken = localStorage.getItem(STORAGE.AUTH_TOKEN);
    const unlockTime = localStorage.getItem('unlockTime');

    if (authToken && unlockTime) {
      try {
        const tokenPayload = JSON.parse(atob(authToken.split('.')[1]));
        const now = Date.now() / 1000;

        if (tokenPayload.exp > now) {
          if (isTokenSetupFlow) {
            router.push(`/setup/${setupToken}`);
          } else if (isSetupFlow) {
            router.push('/setup');
          } else {
            router.push('/');
          }
        } else {
          localStorage.removeItem(STORAGE.AUTH_TOKEN);
          localStorage.removeItem(STORAGE.UNLOCK_TIME);
          localStorage.removeItem(STORAGE.CARETAKER_ID);
        }
      } catch (error) {
        localStorage.removeItem(STORAGE.AUTH_TOKEN);
        localStorage.removeItem(STORAGE.UNLOCK_TIME);
        localStorage.removeItem(STORAGE.CARETAKER_ID);
      }
    } else if (!isSetupFlow && !isTokenSetupFlow) {
      router.push('/');
    }
  }, [router, isSetupFlow, isTokenSetupFlow, setupToken]);

  if (isTokenSetupFlow) {
    return (
      <div className={`${literata.variable} ${alegreyaSans.variable} sb-page`}>
        <div className="sb-card">
          <h1>{t('Finish setting up.')}</h1>
          <p>{t('Enter the setup password you were given to continue.')}</p>
          <form onSubmit={handleTokenAuth} className="sb-f-grid">
            <div>
              <label className="sb-fl" htmlFor="tokenPassword">{t('Setup password')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="tokenPassword"
                  className="sb-fi"
                  type={showTokenPassword ? 'text' : 'password'}
                  value={tokenPassword}
                  onChange={(e) => { setTokenPassword(e.target.value); setTokenError(''); }}
                  disabled={tokenLoading}
                  autoFocus
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowTokenPassword(!showTokenPassword)}
                  disabled={tokenLoading}
                  aria-label={showTokenPassword ? t('Hide password') : t('Show password')}
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sub)',
                    width: 34, height: 34, display: 'grid', placeItems: 'center' }}
                >
                  {showTokenPassword ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
                </button>
              </div>
            </div>
            {tokenError && <p className="sb-form-error">{tokenError}</p>}
            <button type="submit" className="sb-btn sb-wide" disabled={tokenLoading || !tokenPassword.trim()}>
              {tokenLoading ? t('One moment…') : t('Continue to setup')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full">
      {isSetupFlow && (
        <div
          role="status"
          aria-live="polite"
          className="w-full max-w-md mx-auto mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg"
        >
          <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
            {t('Initial Setup Required')}
          </h2>
          <p className="text-blue-700 dark:text-blue-300">
            {t('Please authenticate with the system PIN to complete the initial setup.')}
          </p>
        </div>
      )}

      <div className="w-full flex justify-center">
        <LoginSecurity
          onUnlock={handleUnlock}
          familySlug={undefined}
        />
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { t } = useLocalization();

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen" role="status" aria-live="polite">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>{t('Loading')}…</p>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}