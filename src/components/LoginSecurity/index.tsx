'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/src/context/theme';
import { useDeployment } from '@/app/context/deployment';
import { ShareButton } from '@/src/components/ui/share-button';
import ExpiredAccountMessage from '@/src/components/ExpiredAccountMessage';
import PinLogin from './PinLogin';
import AccountLogin from './AccountLogin';
import './login-security.css';
import { ApiResponse } from '@/app/api/types';

interface LoginSecurityProps {
  onUnlock: (caretakerId?: string) => void;
  familySlug?: string;
  familyName?: string;
}

type LoginMode = 'pin' | 'account';

export default function LoginSecurity({ onUnlock, familySlug, familyName }: LoginSecurityProps) {
  const { theme } = useTheme();
  const { isSaasMode } = useDeployment();
  const router = useRouter();
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [loginMode, setLoginMode] = useState<LoginMode>('pin');

  // Account status for SAAS mode
  const [accountStatus, setAccountStatus] = useState<{
    isExpired: boolean;
    isTrialExpired: boolean;
    expirationDate?: string;
    betaparticipant: boolean;
  } | null>(null);
  const [checkingAccountStatus, setCheckingAccountStatus] = useState(false);

  // Track when component has mounted to prevent hydration issues
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handle lockout changes
  const handleLockoutChange = (time: number | null) => {
    setLockoutTime(time);
  };

  // Update lockout timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (lockoutTime) {
      timer = setInterval(() => {
        if (Date.now() >= lockoutTime) {
          setLockoutTime(null);
          localStorage.removeItem('lockoutTime');
          localStorage.removeItem('attempts');
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutTime]);

  // Check account status in SAAS mode
  useEffect(() => {
    const checkAccountStatus = async () => {
      if (!isSaasMode || !familySlug) return;

      setCheckingAccountStatus(true);
      try {
        // Get family info with account status
        const familyResponse = await fetch(`/api/family/by-slug/${encodeURIComponent(familySlug)}`);
        const familyData = await familyResponse.json();

        if (!familyData.success || !familyData.data) {
          // Family doesn't exist - allow the normal flow to handle this
          setAccountStatus(null);
          return;
        }

        // Check if family has account status data
        if (familyData.data.accountStatus) {
          setAccountStatus(familyData.data.accountStatus);
        } else {
          // No account associated with family - allow access (legacy families)
          setAccountStatus(null);
        }
      } catch (error) {
        console.error('Error checking account status:', error);
        // On error, don't block access
        setAccountStatus(null);
      } finally {
        setCheckingAccountStatus(false);
      }
    };

    if (isMounted) {
      checkAccountStatus();
    }
  }, [isSaasMode, familySlug, isMounted]);

  // Handle logo click - redirect to home in SaaS mode
  const handleLogoClick = () => {
    if (isSaasMode) {
      router.push('/');
    }
  };

  // Switch between login modes
  const toggleLoginMode = () => {
    setLoginMode(loginMode === 'pin' ? 'account' : 'pin');
  };

  // Show expired account message if account is expired in SAAS mode
  if (isSaasMode && accountStatus?.isExpired && !checkingAccountStatus) {
    return (
      <ExpiredAccountMessage
        familyName={familyName}
        familySlug={familySlug}
        isTrialExpired={accountStatus.isTrialExpired}
        expirationDate={accountStatus.expirationDate}
      />
    );
  }

  // Show loading or normal login if account is valid or not in SAAS mode
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white login-container">
      <div className="w-full max-w-md mx-auto p-6">
        <div className="text-center mt-2 mb-4">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-xl font-semibold login-title">
              {isMounted && familyName ? familyName : 'Security Check'}
            </h2>
            {familySlug && familyName && loginMode === 'pin' && (
              <ShareButton
                familySlug={familySlug}
                familyName={familyName}
                variant="ghost"
                size="sm"
              />
            )}
          </div>
        </div>
        <div className="flex flex-col items-center space-y-4 pb-6 pl-6 pr-6">
          <div
            className={`w-24 h-24 p-1 flex items-center justify-center ${isSaasMode ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            onClick={handleLogoClick}
          >
            <Image
              src="/sprout-128.png"
              alt="Sprout Logo"
              width={128}
              height={128}
              className="object-contain"
              priority
            />
          </div>

          {/* Render appropriate login component based on mode */}
          {loginMode === 'pin' ? (
            <PinLogin
              onUnlock={onUnlock}
              familySlug={familySlug}
              lockoutTime={lockoutTime}
              onLockoutChange={handleLockoutChange}
            />
          ) : (
            <AccountLogin
              lockoutTime={lockoutTime}
              onLockoutChange={handleLockoutChange}
            />
          )}

          {/* Switch login mode link - only show in SAAS mode */}
          {isSaasMode && (
            <div className="w-full max-w-[320px] text-center mt-4">
              <button
                onClick={toggleLoginMode}
                className="text-sm text-teal-600 hover:text-teal-700 hover:underline transition-colors"
              >
                {loginMode === 'pin' ? 'Switch to account login' : 'Switch to PIN login'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
