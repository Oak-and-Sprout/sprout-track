'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoginSecurity from '@/src/components/LoginSecurity';
import { useTheme } from '@/src/context/theme';
import { useLocalization } from '@/src/context/localization';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Eye, EyeOff } from 'lucide-react';
import { FamilyResponse } from '@/app/api/types';
import { literata, alegreyaSans } from '@/src/components/landing/fonts';
import '@/src/components/ui/storybook-drawer/storybook-drawer.css';

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
  
  // Check if this is a setup flow
  const setupType = searchParams.get('setup');
  const setupToken = searchParams.get('token');
  const isSetupFlow = setupType === 'true';
  const isTokenSetupFlow = setupType === 'token' && setupToken;

  // Load families for the dropdown (only for regular setup flow, not token setup)
  useEffect(() => {
    const loadFamilies = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/family/public-list');
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.data)) {
            setFamilies(data.data);
            
            // If only one family exists, auto-select it
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

    // Only load families for regular setup flow (not token setup)
    if (isSetupFlow && !isTokenSetupFlow) {
      loadFamilies();
    } else {
      setLoading(false);
    }
  }, [isSetupFlow, isTokenSetupFlow]);

  // Handle token authentication
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: setupToken,
          password: tokenPassword,
        }),
      });

      const data = await response.json();

      if (data.success && data.data) {
        // Store token auth
        localStorage.setItem('authToken', data.data.token);
        localStorage.setItem('unlockTime', Date.now().toString());
        
        // Redirect to setup page with token
        router.push(`/setup/${setupToken}`);
      } else {
        setTokenError(data.error || t('Invalid password'));
        setTokenPassword('');
      }
    } catch (error) {
      console.error('Token authentication error:', error);
      setTokenError(t('Authentication failed. Please try again.'));
      setTokenPassword('');
    } finally {
      setTokenLoading(false);
    }
  };

  // Handle successful authentication (for setup flows only)
  const handleUnlock = (caretakerId?: string) => {
    if (isTokenSetupFlow) {
      // Token-based setup flow
      router.push(`/setup/${setupToken}`);
    } else if (isSetupFlow) {
      // Regular setup flow - always go to /setup regardless of family context
      router.push('/setup');
    } else {
      // Not a setup flow - redirect to home (shouldn't happen, but safety check)
      router.push('/');
    }
  };

  // Check if already authenticated on page load
  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    const unlockTime = localStorage.getItem('unlockTime');
    
    // If user is authenticated, redirect appropriately (setup flows only)
    if (authToken && unlockTime) {
      try {
        // Basic token validation
        const tokenPayload = JSON.parse(atob(authToken.split('.')[1]));
        const now = Date.now() / 1000;
        
        if (tokenPayload.exp > now) {
          // Token is valid
          if (isTokenSetupFlow) {
            router.push(`/setup/${setupToken}`);
          } else if (isSetupFlow) {
            router.push('/setup');
          } else {
            // Not a setup flow and authenticated - redirect to home
            router.push('/');
          }
        } else {
          // Token expired, clear it
          localStorage.removeItem('authToken');
          localStorage.removeItem('unlockTime');
          localStorage.removeItem('caretakerId');
        }
      } catch (error) {
        // Invalid token, clear it
        localStorage.removeItem('authToken');
        localStorage.removeItem('unlockTime');
        localStorage.removeItem('caretakerId');
      }
    } else if (!isSetupFlow && !isTokenSetupFlow) {
      // Not a setup flow and not authenticated - redirect to home
      router.push('/');
    }
  }, [router, isSetupFlow, isTokenSetupFlow, setupToken]);

  // Handle family selection change
  const handleFamilyChange = (value: string) => {
    setSelectedFamily(value);
  };

  // Show token authentication form if we're in token setup mode
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
                  onChange={(e) => setTokenPassword(e.target.value)}
                  autoFocus
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowTokenPassword(!showTokenPassword)}
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
            <button type="submit" className="sb-btn sb-wide" disabled={tokenLoading}>
              {tokenLoading ? t('One moment…') : t('Continue to setup')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {/* Show setup message if this is setup flow */}
      {isSetupFlow && (
        <div className="w-full max-w-md mx-auto mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
          <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
            {t('Initial Setup Required')}
          </h2>
          <p className="text-blue-700 dark:text-blue-300">
            {t('Please authenticate with the system PIN to complete the initial setup.')}
          </p>
        </div>
      )}
      
      {/* This page only handles setup flows - regular login is on slug pages */}
      <LoginSecurity 
        onUnlock={handleUnlock} 
        familySlug={undefined}
      />
    </div>
  );
}

export default function LoginPage() {
  const { t } = useLocalization();
  
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>{t('Loading')}...</p>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
