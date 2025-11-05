'use client';

import React, { useState, useEffect } from 'react';
import { User, LogOut, Home, AlertCircle, Settings, Users, Mail, MessageSquare } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import AccountModal from '@/src/components/modals/AccountModal';
import FeedbackForm from '@/src/components/forms/FeedbackForm';
import './account-button.css';

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
  onAccountManagerOpen?: () => void;
  onOpenAccountModal?: (mode: 'login' | 'register') => void;
}

export function AccountButton({ 
  className, 
  label,
  showIcon = true,
  variant = 'button',
  initialMode = 'register',
  hideWhenLoggedIn = false,
  onAccountManagerOpen,
  onOpenAccountModal
}: AccountButtonProps) {
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
    
    // Redirect to home page
    window.location.href = '/';
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
        alert('Verification email sent! Please check your inbox.');
      } else {
        alert(data.error || 'Failed to send verification email.');
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      alert('Network error. Please try again.');
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
    let buttonText = `Hi, ${accountStatus.firstName}`;

    if (!accountStatus.verified) {
      buttonClass = 'account-button-verification-needed';
      buttonText = 'Verify Account';
    } else if (!accountStatus.hasFamily) {
      buttonClass = 'account-button-family-setup-needed';
      buttonText = 'Setup Family';
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`${buttonClass} ${className}`}
          >
            {showIcon && (
              <>
                {!accountStatus.verified ? (
                  <AlertCircle className="w-4 h-4 mr-2" />
                ) : !accountStatus.hasFamily ? (
                  <Users className="w-4 h-4 mr-2" />
                ) : (
                  <User className="w-4 h-4 mr-2" />
                )}
              </>
            )}
            {buttonText}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium leading-none">{accountStatus.firstName}</p>
                {accountStatus.betaparticipant && (
                  <div className="beta-badge">
                    <span className="beta-badge-text">✨ Beta User</span>
                  </div>
                )}
              </div>
              <p className="text-xs leading-none text-muted-foreground">
                {accountStatus.email}
              </p>
              {accountStatus.betaparticipant && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium italic">
                  Thank you for being a beta user! 🙏
                </p>
              )}
              {!accountStatus.verified && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  ⚠️ Email verification required
                </p>
              )}
              {accountStatus.verified && !accountStatus.hasFamily && (
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                  ✅ Ready to setup family
                </p>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* Verification-specific options */}
          {!accountStatus.verified && (
            <>
              <DropdownMenuItem onClick={handleResendVerification}>
                <Mail className="w-4 h-4 mr-2" />
                Resend Verification Email
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          
          {/* Family setup option for verified users without family */}
          {accountStatus.verified && !accountStatus.hasFamily && (
            <>
              <DropdownMenuItem 
                onClick={handleFamilySetup}
                className="family-setup-gradient focus:family-setup-gradient"
              >
                <Users className="w-4 h-4 mr-2" />
                Set up your family
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          
          {/* Account Settings */}
          <DropdownMenuItem onClick={() => {
            onAccountManagerOpen?.();
          }}>
            <Settings className="w-4 h-4 mr-2" />
            Account Settings
          </DropdownMenuItem>
          
          {/* Feedback option */}
          <DropdownMenuItem onClick={() => setShowFeedback(true)}>
            <MessageSquare className="w-4 h-4 mr-2" />
            Send Feedback
          </DropdownMenuItem>
          
          {/* Family dashboard link for verified users with family */}
          {accountStatus.verified && accountStatus.hasFamily && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleFamilyLink}>
                <Home className="w-4 h-4 mr-2" />
                Go to Family Dashboard
              </DropdownMenuItem>
            </>
          )}
          
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
        
        {/* Feedback Form */}
        <FeedbackForm
          isOpen={showFeedback}
          onClose={() => setShowFeedback(false)}
          onSuccess={() => setShowFeedback(false)}
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
  const displayLabel = label || 'Account';

  return (
    <>
      <Button 
        variant={buttonVariant}
        size="sm" 
        className={`${buttonClass} ${className}`}
        onClick={() => {
          if (onOpenAccountModal) {
            onOpenAccountModal(initialMode);
          } else {
            setShowAccountModal(true);
          }
        }}
      >
        {showIcon && <User className="w-4 h-4 mr-2" />}
        {displayLabel}
      </Button>
      
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
