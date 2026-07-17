'use client';

import React, { useState, useEffect } from 'react';
import { User, LogOut, Home, AlertCircle, Settings, Users, Mail, MessageSquare, ChevronDown } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import AccountModal from '@/src/components/modals/AccountModal';
import FeedbackPage from '@/src/components/forms/FeedbackForm/FeedbackPage';
import { useLocalization } from '@/src/context/localization';
import { literata, alegreyaSans } from '@/src/components/landing/fonts';

import './account-button.css';
import '@/src/components/ui/storybook-drawer/storybook-drawer.css';

interface AccountStatus {
  accountId: string;
  email: string;
  firstName: string;
  lastName?: string;
  verified: boolean;
  hasFamily: boolean;
  familySlug?: string;
  familyName?: string;
  betaparticipant: boolean;
  closed: boolean;
  closedAt?: string;
  planType?: string;
  planExpires?: string;
  trialEnds?: string;
  subscriptionActive: boolean;
  accountStatus: 'active' | 'inactive' | 'trial' | 'expired' | 'closed' | 'no_family';
}

interface AccountButtonProps {
  className?: string;
  label?: string;
  showIcon?: boolean;
  variant?: 'button' | 'link' | 'white';
  initialMode?: 'login' | 'register';
  hideWhenLoggedIn?: boolean;
  hideFamilyDashboardLink?: boolean;
  onAccountManagerOpen?: () => void;
  onOpenAccountModal?: (mode: 'login' | 'register') => void;
  /**
   * Renders the trigger/guest button as a bare <button> styled only by the
   * caller's classes — no Button variants or account-button state classes.
   * Lets surfaces with their own design system (e.g. the landing pages)
   * fully own the styling without fighting this component's CSS.
   */
  unstyled?: boolean;
  /**
   * Classes for the logged-in dropdown trigger when `unstyled` is set. One
   * AccountButton can span both auth states (the landing "Log in" link
   * becomes the account pill once logged in), so the two states may need
   * different styling. Falls back to `className`.
   */
  loggedInClassName?: string;
}

export function AccountButton({
  className,
  label,
  showIcon = true,
  variant = 'button',
  initialMode = 'register',
  hideWhenLoggedIn = false,
  hideFamilyDashboardLink = false,
  onAccountManagerOpen,
  onOpenAccountModal,
  unstyled = false,
  loggedInClassName
}: AccountButtonProps) {
  const { t } = useLocalization();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  // Check authentication status on component mount and when localStorage changes
  useEffect(() => {
    const checkAuthStatus = async () => {
      const token = localStorage.getItem('authToken');
      
      if (token) {
        try {
          // Fetch account status from API
          const response = await fetch('/api/accounts/status', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setAccountStatus(data.data);
              setIsLoggedIn(true);
            } else {
              handleLogout();
            }
          } else {
            // Token might be invalid or expired
            handleLogout();
          }
        } catch (error) {
          console.error('Error fetching account status:', error);
          // Fall back to localStorage data for offline scenarios
          const userInfo = localStorage.getItem('accountUser');
          if (userInfo) {
            try {
              const user = JSON.parse(userInfo);
              // Create basic status from cached data
              setAccountStatus({
                accountId: 'cached',
                email: user.email,
                firstName: user.firstName,
                verified: true, // Assume verified if cached
                hasFamily: !!user.familySlug,
                familySlug: user.familySlug,
                familyName: undefined,
                betaparticipant: false, // Default to false for cached data
                closed: false,
                subscriptionActive: true, // Assume active for cached data
                accountStatus: !!user.familySlug ? 'active' : 'no_family'
              });
              setIsLoggedIn(true);
            } catch (parseError) {
              console.error('Error parsing cached user info:', parseError);
              handleLogout();
            }
          } else {
            handleLogout();
          }
        }
      } else {
        setIsLoggedIn(false);
        setAccountStatus(null);
      }
    };

    checkAuthStatus();

    // Listen for storage changes (in case user logs in/out in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'authToken' || e.key === 'accountUser') {
        checkAuthStatus();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleLogout = async () => {
    try {
      // Call the logout API to invalidate the token server-side
      const token = localStorage.getItem('authToken');
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (error) {
      console.error('Logout API error:', error);
      // Continue with client-side logout even if API fails
    }

    // Clear client-side auth data
    localStorage.removeItem('authToken');
    localStorage.removeItem('accountUser');
    localStorage.removeItem('unlockTime');
    localStorage.removeItem('caretakerId');
    
    // Update state
    setIsLoggedIn(false);
    setAccountStatus(null);
    
    // Redirect to home page (reason code identifies deliberate logouts — issue #209)
    window.location.href = '/?src=logout-user';
  };

  const handleFamilyLink = () => {
    // Update activity timer when navigating
    const unlockTime = localStorage.getItem('unlockTime');
    if (unlockTime) {
      localStorage.setItem('unlockTime', Date.now().toString());
    }
    
    if (accountStatus?.familySlug) {
      window.location.href = `/${accountStatus.familySlug}`;
    }
  };

  const handleResendVerification = async () => {
    if (!accountStatus?.email) return;

    try {
      const response = await fetch('/api/accounts/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: accountStatus.email,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        alert(t('Verification email sent! Please check your inbox.'));
      } else {
        alert(data.error || t('Failed to send verification email.'));
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      alert(t('Network error. Please try again.'));
    }
  };

  const handleFamilySetup = () => {
    // Navigate to family setup page
    window.location.href = '/account/family-setup';
  };

  // Hide button if logged in and hideWhenLoggedIn is true
  if (isLoggedIn && hideWhenLoggedIn) {
    return null;
  }

  if (isLoggedIn && accountStatus) {
    // Determine button state and styling
    let buttonClass = variant === 'white' ? 'account-button-white' : 'account-button-logged-in';
    let buttonText = `${t('Hi,')} ${accountStatus.firstName}`;

    if (!accountStatus.verified) {
      buttonClass = 'account-button-verification-needed';
      buttonText = t('Verify Account');
    } else if (!accountStatus.hasFamily) {
      buttonClass = 'account-button-family-setup-needed';
      buttonText = t('Setup Family');
    }

    const buttonIcon = !accountStatus.verified ? (
      <AlertCircle size={16} strokeWidth={1.8} aria-hidden="true" />
    ) : !accountStatus.hasFamily ? (
      <Users size={16} strokeWidth={1.8} aria-hidden="true" />
    ) : (
      <User size={16} strokeWidth={1.8} aria-hidden="true" />
    );

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {unstyled ? (
            <button type="button" className={loggedInClassName ?? className}>
              {buttonText}
            </button>
          ) : (
          <button
            className={`${alegreyaSans.variable} sb-btn sb-sm sb-acct-btn ${buttonClass} ${loggedInClassName ?? className ?? ''}`}
          >
            {showIcon && buttonIcon}
            {buttonText}
            <ChevronDown size={15} strokeWidth={1.8} className="sb-chev" />
          </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={10}
          className={`${literata.variable} ${alegreyaSans.variable} sb-menu`}
        >
          <div className="sb-menu-id">
            <b>{accountStatus.firstName} {accountStatus.lastName || ''}</b>
            <span>{accountStatus.email}</span>
            {accountStatus.betaparticipant && (
              <span className="sb-chip sb-c-apr" style={{ display: 'inline-block', marginTop: 6 }}>
                {t('Beta user')}
              </span>
            )}
            {!accountStatus.verified && (
              <span className="sb-msg-err" style={{ display: 'block', marginTop: 6 }}>
                {t('Email verification required')}
              </span>
            )}
            {accountStatus.verified && !accountStatus.hasFamily && (
              <span className="sb-msg-ok" style={{ display: 'block', marginTop: 6 }}>
                {t('Ready to set up your family')}
              </span>
            )}
          </div>

          {/* Verification-specific options */}
          {!accountStatus.verified && (
            <>
              <DropdownMenuItem onClick={handleResendVerification} className="sb-menu-item">
                <Mail size={18} strokeWidth={1.8} aria-hidden="true" />
                {t('Resend Verification Email')}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="sb-menu-sep" />
            </>
          )}

          {/* Family setup option for verified users without family */}
          {accountStatus.verified && !accountStatus.hasFamily && (
            <>
              <DropdownMenuItem
                onClick={handleFamilySetup}
                className="sb-menu-item"
              >
                <Users size={18} strokeWidth={1.8} aria-hidden="true" />
                {t('Set up your family')}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="sb-menu-sep" />
            </>
          )}

          {/* Account Settings */}
          <DropdownMenuItem onClick={() => {
            onAccountManagerOpen?.();
          }} className="sb-menu-item">
            <Settings size={18} strokeWidth={1.8} aria-hidden="true" />
            {t('Account settings')}
          </DropdownMenuItem>

          {/* Feedback option */}
          <DropdownMenuItem onClick={() => setShowFeedback(true)} className="sb-menu-item">
            <MessageSquare size={18} strokeWidth={1.8} aria-hidden="true" />
            {t('Send feedback')}
          </DropdownMenuItem>

          {/* Family dashboard link for verified users with family */}
          {!hideFamilyDashboardLink && accountStatus.verified && accountStatus.hasFamily && (
            <>
              <DropdownMenuSeparator className="sb-menu-sep" />
              <DropdownMenuItem onClick={handleFamilyLink} className="sb-menu-item">
                <Home size={18} strokeWidth={1.8} aria-hidden="true" />
                {t('Go to Family Dashboard')}
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator className="sb-menu-sep" />
          <DropdownMenuItem onClick={handleLogout} className="sb-menu-item sb-out">
            <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />
            {t('Log out')}
          </DropdownMenuItem>
        </DropdownMenuContent>

        {/* Feedback Page - always mounted so slide transition works */}
        <FeedbackPage
          isOpen={showFeedback}
          onClose={() => setShowFeedback(false)}
          appearance="storybook"
        />
      </DropdownMenu>
    );
  }

  const buttonVariant = variant === 'link' ? 'ghost' : 'outline';
  const buttonClass = variant === 'link'
    ? 'account-button-link'
    : variant === 'white'
    ? 'account-button-white'
    : 'account-button-guest';
  const displayLabel = label || t('Account');

  const handleGuestClick = () => {
    if (onOpenAccountModal) {
      onOpenAccountModal(initialMode);
    } else {
      setShowAccountModal(true);
    }
  };

  return (
    <>
      {unstyled ? (
        <button type="button" className={className} onClick={handleGuestClick}>
          {displayLabel}
        </button>
      ) : (
      <Button
        variant={buttonVariant}
        size="sm"
        className={`${buttonClass} ${className}`}
        onClick={handleGuestClick}
      >
        {showIcon && <User className="w-4 h-4 mr-2" aria-hidden="true" />}
        {displayLabel}
      </Button>
      )}
      
      {!onOpenAccountModal && (
        <AccountModal 
          open={showAccountModal} 
          onClose={() => setShowAccountModal(false)}
          initialMode={initialMode}
        />
      )}
    </>
  );
}

export default AccountButton;
