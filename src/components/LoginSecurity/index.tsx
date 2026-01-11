'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/src/context/theme';
import { useDeployment } from '@/app/context/deployment';
import { useLocalization } from '@/src/context/localization';
import { ShareButton } from '@/src/components/ui/share-button';
import { LanguageSelector } from '@/src/components/ui/side-nav/language-selector';
import PinLogin from './PinLogin';
import AccountLogin from './AccountLogin';
import './login-security.css';

interface LoginSecurityProps {
  onUnlock: (caretakerId?: string) => void;
  familySlug?: string;
  familyName?: string;
}

type LoginMode = 'pin' | 'account';

export default function LoginSecurity({ onUnlock, familySlug, familyName }: LoginSecurityProps) {
  const { theme } = useTheme();
  const { isSaasMode } = useDeployment();
  const { t } = useLocalization();
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
  const [fontSizeAdjusted, setFontSizeAdjusted] = useState(false);
  const familyNameRef = useRef<HTMLHeadingElement>(null);

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

  // Adjust family name font size to fit within 2 rows max
  useEffect(() => {
    if (!isMounted || !familyName || !familyNameRef.current) {
      return;
    }

    let cancelled = false;

    const adjustFontSize = () => {
      if (cancelled) return;
      
      const element = familyNameRef.current;
      if (!element) return;

      // Make element visible for accurate measurement
      element.style.visibility = 'hidden';
      element.style.opacity = '1';
      
      // Reset to default size first
      element.style.fontSize = '';
      
      // Force reflow
      void element.getBoundingClientRect();

      // Get computed styles at default size (text-xl = 20px, line-height = 28px in Tailwind)
      const computedStyle = window.getComputedStyle(element);
      let currentFontSize = parseFloat(computedStyle.fontSize) || 20;
      const lineHeight = parseFloat(computedStyle.lineHeight) || 28;
      
      // Max height for 2 rows (line-height * 2 plus small buffer)
      const maxTwoRowsHeight = lineHeight * 2 + 4;
      
      // Get current height
      let currentHeight = element.getBoundingClientRect().height;
      
      // Only adjust if we have valid measurements and text exceeds 2 rows
      if (currentHeight > 0 && lineHeight > 0) {
        // Shrink font until text fits in 2 rows or hits minimum
        const minFontSize = 12;
        let iterations = 0;
        const maxIterations = 20; // Safety limit
        
        while (currentHeight > maxTwoRowsHeight && currentFontSize > minFontSize && iterations < maxIterations) {
          currentFontSize = Math.max(minFontSize, currentFontSize - 1);
          element.style.fontSize = `${currentFontSize}px`;
          void element.getBoundingClientRect(); // Force reflow
          currentHeight = element.getBoundingClientRect().height;
          iterations++;
        }
      }
      
      // Show the element - keep inline opacity:1 until React re-renders
      element.style.visibility = '';
      element.style.opacity = '1';
      
      if (!cancelled) {
        setFontSizeAdjusted(true);
      }
    };

    // Wait for fonts to be ready, then adjust
    const runAdjustment = async () => {
      // Wait for fonts to load
      try {
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
      } catch (e) {
        // Ignore font loading errors
      }
      
      // Give the layout time to stabilize
      await new Promise(resolve => setTimeout(resolve, 50));
      
      if (!cancelled) {
        requestAnimationFrame(adjustFontSize);
      }
    };

    runAdjustment();

    // Adjust on window resize
    const handleResize = () => {
      setFontSizeAdjusted(false);
      adjustFontSize();
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
    };
  }, [isMounted, familyName, loginMode]);

  // Show loading or normal login regardless of expiration status (soft expiration approach)
  // In soft expiration, we allow users to log in even if expired
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white login-container">
      {/* Language Selector - Top Right */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageSelector />
      </div>
      <div className="w-full max-w-md mx-auto p-6">
        <div className="text-center mt-2 mb-4">
          <div className="flex items-start justify-center gap-2 max-w-[240px] mx-auto">
            <div
              className={`w-[40px] h-[40px] flex items-center justify-center flex-shrink-0 ${isSaasMode ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
              onClick={handleLogoClick}
            >
              <Image
                src="/sprout-128.png"
                alt="Sprout Logo"
                width={40}
                height={40}
                className="object-contain"
                priority
              />
            </div>
            <h2 
              ref={familyNameRef}
              className="text-xl login-title flex-1 min-w-0"
              style={{ 
                opacity: (fontSizeAdjusted || !familyName) ? 1 : 0,
                transition: 'opacity 0.15s ease-in'
              }}
            >
              {isMounted && familyName ? familyName : t('Security Check')}
            </h2>
            {familySlug && familyName && loginMode === 'pin' && (
              <ShareButton
                familySlug={familySlug}
                familyName={familyName}
                variant="ghost"
                size="icon"
                showText={false}
                className="flex-shrink-0"
              />
            )}
          </div>
        </div>
        <div className="flex flex-col items-center space-y-4 pb-6 pl-6 pr-6">

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
                {loginMode === 'pin' ? t('Switch to account login') : t('Switch to PIN login')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
