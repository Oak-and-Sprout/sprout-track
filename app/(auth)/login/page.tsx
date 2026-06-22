'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoginSecurity from '@/src/components/LoginSecurity';
import { useTheme } from '@/src/context/theme';
import { useLocalization } from '@/src/context/localization';
import { Card, CardHeader, CardTitle, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { FamilyResponse } from '@/app/api/types';

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

  // Ref pentru a pune focus direct pe input la randare
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

  // Pune focus automat pe input-ul parolei când se deschide ecranul de invitație
  useEffect(() => {
    if (isTokenSetupFlow && passwordInputRef.current) {
      passwordInputRef.current.focus();
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
        localStorage.setItem('authToken', data.data.token);
        localStorage.setItem('unlockTime', Date.now().toString());
        router.push(`/setup/${setupToken}`);
      } else {
        setTokenError(data.error || t('Invalid password'));
        setTokenPassword('');
        passwordInputRef.current?.focus(); // Returnează focusul pe input la eroare
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
    const authToken = localStorage.getItem('authToken');
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
          localStorage.removeItem('authToken');
          localStorage.removeItem('unlockTime');
          localStorage.removeItem('caretakerId');
        }
      } catch (error) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('unlockTime');
        localStorage.removeItem('caretakerId');
      }
    } else if (!isSetupFlow && !isTokenSetupFlow) {
      router.push('/');
    }
  }, [router, isSetupFlow, isTokenSetupFlow, setupToken]);

  if (isTokenSetupFlow) {
    return (
      <div className="flex flex-col items-center">
        {/* Regiune marcată cu alert pentru cititoarele de ecran */}
        <div
          role="region"
          aria-label={t('Invitation notice')}
          className="w-full max-w-md mx-auto mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg"
        >
          <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
            {t('Family Setup Invitation')}
          </h2>
          <p className="text-blue-700 dark:text-blue-300">
            {t('Please enter the password provided with this setup invitation to continue.')}
          </p>
        </div>

        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {t('Setup Authentication')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTokenAuth} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tokenPassword">{t('Setup Password')}</Label>
                <div className="relative">
                  <Input
                    ref={passwordInputRef}
                    id="tokenPassword"
                    type={showTokenPassword ? 'text' : 'password'}
                    value={tokenPassword}
                    onChange={(e) => {
                      setTokenPassword(e.target.value);
                      setTokenError('');
                    }}
                    placeholder={t('Enter setup password')}
                    disabled={tokenLoading}
                    className="pr-10" // Spațiu pentru a nu suprapune textul cu butonul de ochi
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    /* Atribute ARIA esențiale pentru accesibilitatea butonului toggle */
                    aria-label={showTokenPassword ? t('Hide password') : t('Show password')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 focus:ring-2 focus:ring-blue-500"
                    onClick={() => setShowTokenPassword(!showTokenPassword)}
                    disabled={tokenLoading}
                  >
                    {showTokenPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>
              </div>

              {tokenError && (
                <div id="password-error" role="alert" aria-live='assertive' className="text-red-500 text-sm font-medium animate-pulse">
                  {tokenError}
                </div>
              )}

              <Button
                type="submit"
                className="w-full focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                disabled={tokenLoading || !tokenPassword.trim()}
              >
                {tokenLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    {t('Authenticating…')}
                  </>
                ) : (
                  t('Continue to Setup')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
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

      {/* IMPORTANT: Asigură-te că în componentul intern <LoginSecurity /> 
        ai aplicat logica keydown (pe care am scris-o în pasul anterior) 
        pentru ca tastatura numerică de PIN să preia apăsările de taste!
      */}
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