'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from '@/src/context/theme';
import { useLocalization } from '@/src/context/localization';

import './account-expiration-banner.css';

interface AccountStatus {
  accountStatus: 'active' | 'inactive' | 'trial' | 'expired' | 'closed' | 'no_family';
  subscriptionActive: boolean;
}

interface JWTExpirationInfo {
  isExpired?: boolean;
  trialEnds?: string | null;
  planExpires?: string | null;
  planType?: string | null;
  betaparticipant?: boolean;
}

interface AccountExpirationBannerProps {
  isAccountAuth: boolean;
}

export default function AccountExpirationBanner({
 isAccountAuth }: AccountExpirationBannerProps) {
  const { theme } = useTheme();
  const { t } = useLocalization();
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [jwtExpirationInfo, setJwtExpirationInfo] = useState<JWTExpirationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState<'account' | 'caretaker' | null>(null);

  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
      setLoading(false);
      return;
    }

    // Parse JWT token to determine user type and get expiration info
    let parsedUserType: 'account' | 'caretaker' | null = null;
    let parsedJwtInfo: JWTExpirationInfo | null = null;

    try {
      const payload = authToken.split('.')[1];
      const decodedPayload = JSON.parse(atob(payload));
      const isAccountUser = decodedPayload.isAccountAuth || false;
      const isSysAdmin = decodedPayload.isSysAdmin || false;

      // Skip banner only for actual system administrators (not system PIN users)
      // System PIN users are regular caretakers and should see the banner
      if (isSysAdmin) {
        setLoading(false);
        return;
      }

      if (isAccountUser) {
        parsedUserType = 'account';
      } else {
        // This includes both regular caretakers and system PIN users
        parsedUserType = 'caretaker';
        // Extract expiration info from JWT for caretakers/system PIN users
        parsedJwtInfo = {
          isExpired: decodedPayload.isExpired || false,
          trialEnds: decodedPayload.trialEnds || null,
          planExpires: decodedPayload.planExpires || null,
          planType: decodedPayload.planType || null,
          betaparticipant: decodedPayload.betaparticipant || false,
        };
        setJwtExpirationInfo(parsedJwtInfo);
      }
      setUserType(parsedUserType);
    } catch (error) {
      console.error('Error parsing JWT token:', error);
      setLoading(false);
      return;
    }

    // For account users, fetch account status from API
    if (parsedUserType === 'account') {
      const fetchAccountStatus = async () => {
        try {
          const response = await fetch('/api/accounts/status', {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              setAccountStatus({
                accountStatus: data.data.accountStatus,
                subscriptionActive: data.data.subscriptionActive,
              });
            }
          }
        } catch (error) {
          console.error('Error fetching account status:', error);
        } finally {
          setLoading(false);
        }
      };

      fetchAccountStatus();

      // Refresh status periodically (every 5 minutes)
      const interval = setInterval(fetchAccountStatus, 5 * 60 * 1000);
      return () => clearInterval(interval);
    } else if (parsedUserType === 'caretaker') {
      // For caretakers, check expiration from JWT token
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [isAccountAuth]);

  const handleUpgradeClick = () => {
    // Only account users can upgrade
    if (userType === 'account') {
      // Dispatch event to open PaymentModal (layout listens for this)
      window.dispatchEvent(new CustomEvent('openPaymentModal'));
    }
  };

  // Don't show banner if loading or no user type determined
  if (loading || !userType) {
    return null;
  }

  // Check if we should show the banner
  let shouldShow = false;

  if (userType === 'account' && accountStatus) {
    // Show banner only if account is expired
    // Don't show for accounts without a family (they're still in setup)
    // Don't show for accounts in active trial (trial status means trial is still active)
    shouldShow = 
      accountStatus.accountStatus !== 'no_family' &&
      accountStatus.accountStatus === 'expired';
  } else if (userType === 'caretaker' && jwtExpirationInfo) {
    // Show banner for caretakers/system PIN users if family account is expired
    // Skip if beta participant (they have lifetime access)
    // Calculate expiration client-side since JWT token doesn't include isExpired
    if (!jwtExpirationInfo.betaparticipant) {
      // Only check expiration if we have account info (indicates SAAS mode with account)
      const hasAccountInfo = jwtExpirationInfo.trialEnds !== null || 
                             jwtExpirationInfo.planExpires !== null || 
                             jwtExpirationInfo.planType !== null;
      
      if (hasAccountInfo) {
        const now = new Date();
        let calculatedIsExpired = false;

        // Check trial expiration
        if (jwtExpirationInfo.trialEnds) {
          const trialEndDate = new Date(jwtExpirationInfo.trialEnds);
          calculatedIsExpired = now > trialEndDate;
        }
        // Check plan expiration (if no trial)
        else if (jwtExpirationInfo.planExpires) {
          const planEndDate = new Date(jwtExpirationInfo.planExpires);
          calculatedIsExpired = now > planEndDate;
        }
        // No trial and no plan = expired
        else if (!jwtExpirationInfo.planType) {
          calculatedIsExpired = true;
        }

        shouldShow = calculatedIsExpired;
      }
    }
  }

  if (!shouldShow) {
    return null;
  }

  return (
    <div className={`account-expiration-banner account-expiration-banner-${theme}`}>
      <div className="account-expiration-banner-content">
        <div className="account-expiration-banner-message">
          <span className="account-expiration-banner-icon">⚠️</span>
          <span>
            {userType === 'account' ? (
              <>
                {t('Your account does not have an active subscription or license. The app is read-only until you upgrade.')}
              </>
            ) : (
              <>
                {t('The account owner\'s subscription has expired. Please contact them to upgrade. The app is read-only until they upgrade.')}
              </>
            )}
          </span>
        </div>
        {userType === 'account' && (
          <button
            onClick={handleUpgradeClick}
            className="account-expiration-banner-button"
          >
            {t('Upgrade Now')}
          </button>
        )}
      </div>
    </div>
  );
}

