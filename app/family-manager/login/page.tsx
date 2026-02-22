'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/src/components/ui/card';
import { Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useTheme } from '@/src/context/theme';
import { useLocalization } from '@/src/context/localization';
import { ApiResponse } from '@/app/api/types';
import '../layout.css';

export default function FamilyManagerLoginPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLocalization();
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  // Track when component has mounted to prevent hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check if already authenticated as sysadmin
  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    if (authToken) {
      try {
        const tokenPayload = JSON.parse(atob(authToken.split('.')[1]));
        if (tokenPayload.isSysAdmin) {
          router.push('/family-manager');
          return;
        }
      } catch (error) {
        // Invalid token, continue with login
        localStorage.removeItem('authToken');
      }
    }
  }, [router]);

  // Check for server-side IP lockout on mount
  useEffect(() => {
    const checkIpLockout = async () => {
      try {
        const response = await fetch('/api/auth/ip-lockout');
        const data = await response.json() as ApiResponse<{ locked: boolean; remainingTime: number }>;
        
        if (data.success && data.data && data.data.locked) {
          const remainingTime = data.data.remainingTime || 300000;
          const remainingMinutes = Math.ceil(remainingTime / 60000);
          setLockoutTime(Date.now() + remainingTime);
          const minutesText = remainingMinutes > 1 ? t('minutes') : t('minute');
          setError(`${t('Too many failed attempts. Please try again in')} ${remainingMinutes} ${minutesText}.`);
        }
      } catch (error) {
        console.error('Error checking IP lockout:', error);
      }
    };
    
    if (mounted) {
      checkIpLockout();
    }
  }, [mounted]);

  // Update lockout timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (lockoutTime) {
      timer = setInterval(() => {
        if (Date.now() >= lockoutTime) {
          setLockoutTime(null);
          setError('');
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (lockoutTime) return;
    
    if (!adminPassword.trim()) {
      setError(t('Admin password is required'));
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Check for server-side IP lockout first
      const ipCheckResponse = await fetch('/api/auth/ip-lockout');
      const ipCheckData = await ipCheckResponse.json() as ApiResponse<{ locked: boolean; remainingTime: number }>;
      
      if (ipCheckData.success && ipCheckData.data && ipCheckData.data.locked) {
        const remainingTime = ipCheckData.data.remainingTime || 300000;
        const remainingMinutes = Math.ceil(remainingTime / 60000);
        setLockoutTime(Date.now() + remainingTime);
        setError(`Too many failed attempts. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`);
        return;
      }

      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminPassword,
        }),
      });

      const data = await response.json();

      if (data.success && data.data.isSysAdmin) {
        // Store sysadmin authentication
        localStorage.setItem('authToken', data.data.token);
        localStorage.setItem('unlockTime', Date.now().toString());
        
        // Clear any existing caretaker auth
        localStorage.removeItem('caretakerId');
        
        // Redirect to family manager
        router.push('/family-manager');
      } else {
        setError(t('Invalid admin password'));
        setAdminPassword('');
        
        // Check if we're now locked out
        const lockoutCheckResponse = await fetch('/api/auth/ip-lockout');
        const lockoutCheckData = await lockoutCheckResponse.json() as ApiResponse<{ locked: boolean; remainingTime: number }>;
        
        if (lockoutCheckData.success && lockoutCheckData.data && lockoutCheckData.data.locked) {
          const remainingTime = lockoutCheckData.data.remainingTime || 300000;
          const remainingMinutes = Math.ceil(remainingTime / 60000);
          setLockoutTime(Date.now() + remainingTime);
          const minutesText = remainingMinutes > 1 ? t('minutes') : t('minute');
          setError(`${t('Too many failed attempts. Please try again in')} ${remainingMinutes} ${minutesText}.`);
        }
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setError(t('Authentication failed. Please try again.'));
      setAdminPassword('');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRemaining = (lockoutTime: number) => {
    const remaining = Math.ceil((lockoutTime - Date.now()) / 1000);
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!mounted) {
    return null; // Prevent hydration issues
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-blue-50 p-4 family-manager-login-background">
      <Card className="w-full max-w-md family-manager-login-card">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Image
              src="/sprout-128.png"
              alt="Sprout Logo"
              width={80}
              height={80}
              className="object-contain"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            {t('Family Manager Login')}
          </CardTitle>
          <p className="text-sm text-gray-600 family-manager-login-description">
            {t('Enter the system administrator password to access family management')}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adminPassword">{t('Administrator Password')}</Label>
              <div className="relative mt-3">
                <Input
                  id="adminPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    setError('');
                  }}
                  placeholder={t('Enter admin password')}
                  disabled={loading || !!lockoutTime}
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading || !!lockoutTime}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            {error && (
              <div className="text-red-500 text-sm family-manager-login-error">
                {error}
                {lockoutTime && ` (${formatTimeRemaining(lockoutTime)})`}
              </div>
            )}
            
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !!lockoutTime || !adminPassword.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('Authenticating...')}
                </>
              ) : (
                t('Login as Administrator')
              )}
            </Button>
          </form>
          
          {/* Go back to home button */}
          <div className="mt-4 pt-4 border-t border-gray-200 family-manager-login-separator">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => router.push('/')}
              disabled={loading}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('Go back to home')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 