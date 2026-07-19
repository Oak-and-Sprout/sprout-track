import React, { useState, useCallback } from 'react';
import { cn } from '@/src/lib/utils';
import { styles } from './account-manager.styles';
import { AccountSettingsTabProps } from './account-manager.types';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import PaymentModal from './PaymentModal';
import PaymentHistory from './PaymentHistory';
import { useLocalization } from '@/src/context/localization';
import { getSubscriptionView } from '@/src/utils/accountPresentation';

import {
  User,
  Mail,
  Home,
  Download,
  AlertTriangle,
  X,
  Loader2,
  CheckCircle,
  Key,
  Shield,
  Receipt
} from 'lucide-react';

/**
 * AccountSettingsTab Component
 * 
 * First tab of the account manager that handles account and family settings
 */
const AccountSettingsTab: React.FC<AccountSettingsTabProps> = ({
  accountStatus,
  familyData,
  onDataRefresh,
}) => {

  const { t } = useLocalization();
  // Edit states
  const [editingAccount, setEditingAccount] = useState(false);
  const [editingFamily, setEditingFamily] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Form data states
  const [accountFormData, setAccountFormData] = useState({
    firstName: accountStatus.firstName,
    lastName: accountStatus.lastName || '',
    email: accountStatus.email,
  });
  
  const [familyFormData, setFamilyFormData] = useState({
    name: familyData?.name || '',
    slug: familyData?.slug || '',
  });

  // Password change form data
  const [passwordFormData, setPasswordFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Password change states
  const [passwordStep, setPasswordStep] = useState<'confirm' | 'change'>('confirm');
  const [changingPasswordLoading, setChangingPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');

  // Account closure states
  const [confirmingClosure, setConfirmingClosure] = useState(false);
  const [closurePasswordLoading, setClosurePasswordLoading] = useState(false);
  const [closurePasswordMessage, setClosurePasswordMessage] = useState('');
  const [closurePasswordData, setClosurePasswordData] = useState({
    password: '',
  });
  const [accountClosed, setAccountClosed] = useState(false);
  const [logoutCountdown, setLogoutCountdown] = useState(5);

  // Password validation state for real-time feedback
  const [passwordValidation, setPasswordValidation] = useState({
    length: false,
    lowercase: false,
    uppercase: false,
    number: false,
    special: false,
  });
  
  // Loading and error states
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingFamily, setSavingFamily] = useState(false);
  const [downloadingData, setDownloadingData] = useState(false);
  const [closingAccount, setClosingAccount] = useState(false);
  
  // Validation states
  const [slugError, setSlugError] = useState('');
  const [checkingSlug, setCheckingSlug] = useState(false);
  
  // Success/error messages
  const [accountMessage, setAccountMessage] = useState('');
  const [familyMessage, setFamilyMessage] = useState('');

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Payment history modal state
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);

  // Subscription status state
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    isActive: boolean;
    planType: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    paymentMethod?: {
      brand: string;
      last4: string;
    };
  } | null>(null);
  const [loadingSubscriptionStatus, setLoadingSubscriptionStatus] = useState(false);
  const [renewingSubscription, setRenewingSubscription] = useState(false);

  // Storybook-style view of the subscription state, derived from account + subscription status
  const subscriptionView = getSubscriptionView(
    {
      accountStatus: accountStatus.accountStatus,
      planType: accountStatus.planType,
      trialEnds: accountStatus.trialEnds,
      planExpires: accountStatus.planExpires,
      cancelAtPeriodEnd: subscriptionStatus?.cancelAtPeriodEnd,
    },
    new Date()
  );

  // Check slug uniqueness
  const checkSlugUniqueness = useCallback(async (slug: string) => {
    if (!familyData || !slug || slug.trim() === '' || slug === familyData.slug) {
      setSlugError('');
      return;
    }

    setCheckingSlug(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`/api/family/by-slug/${encodeURIComponent(slug)}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await response.json();
      
      if (response.status === 400) {
        // Validation error (format or reserved word)
        setSlugError(data.error || 'Invalid slug format');
      } else if (data.success && data.data && data.data.id !== familyData.id) {
        setSlugError('This slug is already taken');
      } else {
        setSlugError('');
      }
    } catch (error) {
      console.error('Error checking slug:', error);
      setSlugError('Error checking slug availability');
    } finally {
      setCheckingSlug(false);
    }
  }, [familyData?.id, familyData?.slug]);

  // Handle account form submission
  const handleAccountSave = async () => {
    setSavingAccount(true);
    setAccountMessage('');
    
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch('/api/accounts/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          firstName: accountFormData.firstName,
          lastName: accountFormData.lastName,
          email: accountFormData.email,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setEditingAccount(false);
        setAccountMessage('Account information updated successfully');
        onDataRefresh();
        
        // Clear message after 3 seconds
        setTimeout(() => setAccountMessage(''), 3000);
      } else {
        setAccountMessage(`Error: ${data.error || 'Failed to update account'}`);
      }
    } catch (error) {
      console.error('Error updating account:', error);
      setAccountMessage('Error: Failed to update account');
    } finally {
      setSavingAccount(false);
    }
  };

  // Handle family form submission
  const handleFamilySave = async () => {
    if (slugError) {
      setFamilyMessage('Please fix the slug error before saving');
      return;
    }

    setSavingFamily(true);
    setFamilyMessage('');
    
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch('/api/family', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          name: familyFormData.name,
          slug: familyFormData.slug,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setEditingFamily(false);
        setFamilyMessage('Family information updated successfully');
        onDataRefresh();
        
        // Clear message after 3 seconds
        setTimeout(() => setFamilyMessage(''), 3000);
      } else {
        setFamilyMessage(`Error: ${data.error || 'Failed to update family'}`);
      }
    } catch (error) {
      console.error('Error updating family:', error);
      setFamilyMessage('Error: Failed to update family');
    } finally {
      setSavingFamily(false);
    }
  };

  // Handle data download
  const handleDataDownload = async () => {
    setDownloadingData(true);
    
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch('/api/accounts/download-data', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${familyData?.slug || 'account'}-data-export.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const data = await response.json();
        alert(`Error: ${data.error || 'Failed to download data'}`);
      }
    } catch (error) {
      console.error('Error downloading data:', error);
      alert('Error: Failed to download data');
    } finally {
      setDownloadingData(false);
    }
  };

  // Fetch subscription status
  const fetchSubscriptionStatus = useCallback(async () => {
    if (!accountStatus.subscriptionId || accountStatus.planType !== 'sub') {
      return;
    }

    setLoadingSubscriptionStatus(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch('/api/accounts/payments/subscription-status', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setSubscriptionStatus(data.data);
      }
    } catch (error) {
      console.error('Error fetching subscription status:', error);
    } finally {
      setLoadingSubscriptionStatus(false);
    }
  }, [accountStatus.subscriptionId, accountStatus.planType]);

  // Fetch subscription status on mount and when account status changes
  React.useEffect(() => {
    if (accountStatus.subscriptionActive && accountStatus.subscriptionId && accountStatus.planType === 'sub') {
      fetchSubscriptionStatus();
    }
  }, [accountStatus.subscriptionActive, accountStatus.subscriptionId, accountStatus.planType, fetchSubscriptionStatus]);

  // Handle renewing a cancelled subscription
  const handleRenewSubscription = async () => {
    setRenewingSubscription(true);
    try {
      const authToken = localStorage.getItem('authToken');

      // Check if subscription is still valid (before period end)
      if (subscriptionStatus?.currentPeriodEnd) {
        const periodEndDate = new Date(subscriptionStatus.currentPeriodEnd);
        const now = new Date();

        if (now < periodEndDate) {
          // Subscription is still active, just reactivate it
          const response = await fetch('/api/accounts/payments/reactivate-subscription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            }
          });

          const data = await response.json();
          if (data.success) {
            await fetchSubscriptionStatus();
            onDataRefresh();
          } else {
            alert(`Error: ${data.error || 'Failed to reactivate subscription'}`);
          }
        } else {
          // Subscription has ended, redirect to payment modal to create new subscription
          setShowPaymentModal(true);
        }
      } else {
        // No period end info, redirect to payment modal
        setShowPaymentModal(true);
      }
    } catch (error) {
      console.error('Error renewing subscription:', error);
      alert('Error: Failed to renew subscription');
    } finally {
      setRenewingSubscription(false);
    }
  };

  // Real-time password validation for visual feedback
  const updatePasswordValidation = (password: string) => {  

    setPasswordValidation({
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password),
    });
  };

  // Handle password change step 1: confirm current password
  const handlePasswordConfirm = async () => {
    if (!passwordFormData.currentPassword) {
      setPasswordMessage('Please enter your current password');
      return;
    }

    setChangingPasswordLoading(true);
    setPasswordMessage('');

    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch('/api/accounts/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          currentPassword: passwordFormData.currentPassword,
          newPassword: passwordFormData.currentPassword, // Dummy new password for validation
        }),
      });

      const data = await response.json();
      
      if (response.status === 400 && data.error === 'New password must be different from current password') {
        // This means current password is correct, proceed to step 2
        setPasswordStep('change');
        setPasswordMessage('');
      } else if (response.status === 400 && data.error === 'Current password is incorrect') {
        setPasswordMessage('Current password is incorrect');
      } else if (!data.success) {
        setPasswordMessage(`Error: ${data.error || 'Failed to verify password'}`);
      }
    } catch (error) {
      console.error('Error verifying password:', error);
      setPasswordMessage('Error: Failed to verify password');
    } finally {
      setChangingPasswordLoading(false);
    }
  };

  // Handle password change step 2: set new password
  const handlePasswordChange = async () => {
    // Validate new password
    if (!passwordFormData.newPassword) {
      setPasswordMessage('Please enter a new password');
      return;
    }

    if (!passwordValidation.length || !passwordValidation.lowercase || !passwordValidation.uppercase || 
        !passwordValidation.number || !passwordValidation.special) {
      setPasswordMessage('New password does not meet the requirements');
      return;
    }

    if (passwordFormData.newPassword !== passwordFormData.confirmPassword) {
      setPasswordMessage('Passwords do not match');
      return;
    }

    if (passwordFormData.currentPassword === passwordFormData.newPassword) {
      setPasswordMessage('New password must be different from current password');
      return;
    }

    setChangingPasswordLoading(true);
    setPasswordMessage('');

    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch('/api/accounts/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          currentPassword: passwordFormData.currentPassword,
          newPassword: passwordFormData.newPassword,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setPasswordMessage('Password changed successfully');
        setChangingPassword(false);
        setPasswordStep('confirm');
        setPasswordFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        setPasswordValidation({
          length: false,
          lowercase: false,
          uppercase: false,
          number: false,
          special: false,
        });
        
        // Clear message after 3 seconds
        setTimeout(() => setPasswordMessage(''), 3000);
      } else {
        setPasswordMessage(`Error: ${data.error || 'Failed to change password'}`);
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordMessage('Error: Failed to change password');
    } finally {
      setChangingPasswordLoading(false);
    }
  };

  // Handle cancel password change
  const handlePasswordCancel = () => {
    setChangingPassword(false);
    setPasswordStep('confirm');
    setPasswordFormData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setPasswordValidation({
      length: false,
      lowercase: false,
      uppercase: false,
      number: false,
      special: false,
    });
    setPasswordMessage('');
  };

  // Handle closure password confirmation and account closure in one step
  const handleClosurePasswordConfirm = async () => {
    if (!closurePasswordData.password) {
      setClosurePasswordMessage('Please enter your password to confirm account closure');
      return;
    }

    setClosurePasswordLoading(true);
    setClosingAccount(true);
    setClosurePasswordMessage('');

    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch('/api/accounts/close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          password: closurePasswordData.password,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Set account as closed and start countdown
        setAccountClosed(true);
        setClosurePasswordLoading(false);
        setClosingAccount(false);
        
        // Start countdown timer
        const countdownInterval = setInterval(() => {
          setLogoutCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              // Clear authentication and redirect
              localStorage.removeItem('authToken');
              localStorage.removeItem('accountUser');
              localStorage.removeItem('unlockTime');
              localStorage.removeItem('caretakerId');
              
              window.location.href = '/?src=account-closed';
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setClosurePasswordMessage(`Error: ${data.error || 'Failed to close account'}`);
        setClosurePasswordLoading(false);
        setClosingAccount(false);
      }
    } catch (error) {
      console.error('Error closing account:', error);
      setClosurePasswordMessage('Error: Failed to close account');
      setClosurePasswordLoading(false);
      setClosingAccount(false);
    }
  };

  // Handle cancel closure
  const handleClosureCancel = () => {
    setConfirmingClosure(false);
    setClosurePasswordData({ password: '' });
    setClosurePasswordMessage('');
  };

  // Handle slug input change with debounced validation
  React.useEffect(() => {
    if (familyData && familyFormData.slug && familyFormData.slug !== familyData.slug) {
      const timeoutId = setTimeout(() => {
        checkSlugUniqueness(familyFormData.slug);
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [familyFormData.slug, familyData?.slug, checkSlugUniqueness]);

  return (
    <div className="space-y-6">
      {/* Account Information Section */}
      <div className="sb-sect">
        <div className="sb-sect-hd">
          <User size={20} strokeWidth={1.8} />
          <h3>{t('Account')}</h3>
          {!editingAccount && !changingPassword && (
            <button
              type="button"
              className="sb-btn sb-ghost sb-sm"
              onClick={() => {
                setEditingAccount(true);
                setAccountMessage('');
              }}
            >
              {t('Edit')}
            </button>
          )}
        </div>

        {editingAccount ? (
          <div className="sb-f-grid">
            <div className="sb-f2">
              <div>
                <label className="sb-fl" htmlFor="firstName">{t('First name')}</label>
                <input
                  id="firstName"
                  className="sb-fi"
                  value={accountFormData.firstName}
                  onChange={(e) => setAccountFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  disabled={savingAccount}
                />
              </div>
              <div>
                <label className="sb-fl" htmlFor="lastName">{t('Last name')}</label>
                <input
                  id="lastName"
                  className="sb-fi"
                  value={accountFormData.lastName}
                  onChange={(e) => setAccountFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  disabled={savingAccount}
                />
              </div>
            </div>
            <div>
              <label className="sb-fl" htmlFor="email">{t('Email')}</label>
              <input
                id="email"
                className="sb-fi"
                type="email"
                value={accountFormData.email}
                onChange={(e) => setAccountFormData(prev => ({ ...prev, email: e.target.value }))}
                disabled={savingAccount}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="sb-btn sb-sm" onClick={handleAccountSave} disabled={savingAccount}>
                {savingAccount ? t('Saving…') : t('Save')}
              </button>
              <button
                type="button"
                className="sb-btn sb-ghost sb-sm"
                onClick={() => {
                  setEditingAccount(false);
                  setAccountFormData({
                    firstName: accountStatus.firstName,
                    lastName: accountStatus.lastName || '',
                    email: accountStatus.email,
                  });
                  setAccountMessage('');
                }}
                disabled={savingAccount}
              >
                {t('Cancel')}
              </button>
            </div>
          </div>
        ) : changingPassword ? (
          <div className="sb-f-grid">
            {passwordStep === 'confirm' ? (
              <>
                <div>
                  <label className="sb-fl" htmlFor="currentPassword">{t('Current password')}</label>
                  <input
                    id="currentPassword"
                    className="sb-fi"
                    type="password"
                    value={passwordFormData.currentPassword}
                    onChange={(e) => setPasswordFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                    disabled={changingPasswordLoading}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="sb-btn sb-sm"
                    onClick={handlePasswordConfirm}
                    disabled={changingPasswordLoading || !passwordFormData.currentPassword}
                  >
                    {t('Continue')}
                  </button>
                  <button
                    type="button"
                    className="sb-btn sb-ghost sb-sm"
                    onClick={handlePasswordCancel}
                    disabled={changingPasswordLoading}
                  >
                    {t('Cancel')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="sb-fl" htmlFor="newPassword">{t('New password')}</label>
                  <input
                    id="newPassword"
                    className="sb-fi"
                    type="password"
                    value={passwordFormData.newPassword}
                    onChange={(e) => {
                      const newPassword = e.target.value;
                      setPasswordFormData(prev => ({ ...prev, newPassword }));
                      updatePasswordValidation(newPassword);
                    }}
                    disabled={changingPasswordLoading}
                  />
                  <div className="sb-reqs">
                    <span className={passwordValidation.length ? 'sb-ok' : undefined}><i aria-hidden="true">✓</i>{t('8+ characters')}</span>
                    <span className={passwordValidation.number ? 'sb-ok' : undefined}><i aria-hidden="true">✓</i>{t('A number')}</span>
                    <span className={passwordValidation.lowercase ? 'sb-ok' : undefined}><i aria-hidden="true">✓</i>{t('A lowercase letter')}</span>
                    <span className={passwordValidation.special ? 'sb-ok' : undefined}><i aria-hidden="true">✓</i>{t('A symbol')}</span>
                    <span className={passwordValidation.uppercase ? 'sb-ok' : undefined}><i aria-hidden="true">✓</i>{t('An uppercase letter')}</span>
                  </div>
                </div>

                <div>
                  <label className="sb-fl" htmlFor="confirmPassword">{t('Confirm new password')}</label>
                  <input
                    id="confirmPassword"
                    className="sb-fi"
                    type="password"
                    value={passwordFormData.confirmPassword}
                    onChange={(e) => setPasswordFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    disabled={changingPasswordLoading}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="sb-btn sb-sm"
                    onClick={handlePasswordChange}
                    disabled={changingPasswordLoading || !passwordFormData.newPassword || !passwordFormData.confirmPassword}
                  >
                    {changingPasswordLoading ? t('Saving…') : t('Save')}
                  </button>
                  <button
                    type="button"
                    className="sb-btn sb-ghost sb-sm"
                    onClick={handlePasswordCancel}
                    disabled={changingPasswordLoading}
                  >
                    {t('Cancel')}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="sb-irow">
              <User size={16} strokeWidth={1.8} />
              <b>{accountStatus.firstName} {accountStatus.lastName || ''}</b>
            </div>
            <div className="sb-irow">
              <Mail size={16} strokeWidth={1.8} />
              {accountStatus.email}
              {!accountStatus.verified && <span className="sb-chip sb-c-red">{t('Unverified')}</span>}
            </div>
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                className="sb-btn sb-ghost sb-sm"
                onClick={() => {
                  setChangingPassword(true);
                  setPasswordMessage('');
                }}
              >
                <Key size={15} strokeWidth={1.8} />
                {t('Reset password')}
              </button>
            </div>
          </>
        )}

        {(accountMessage || passwordMessage) && (
          <p
            className={
              (accountMessage && accountMessage.startsWith('Error')) || (passwordMessage && passwordMessage.startsWith('Error'))
                ? 'sb-msg-err'
                : 'sb-msg-ok'
            }
            style={{ marginTop: 12 }}
          >
            {passwordMessage || accountMessage}
          </p>
        )}
      </div>

      {/* Subscription Section */}
      <div className="sb-sect">
        <div className="sb-sect-hd">
          <Shield size={20} strokeWidth={1.8} />
          <h3>{t('Subscription')}</h3>
        </div>

        {accountStatus.betaparticipant ? (
          <>
            <div className="sb-status-line"><i /><span>{t('Beta access')}</span></div>
            <p className="sb-status-sub">{t('Thanks for helping us test Sprout Track — everything is free for you.')}</p>
          </>
        ) : !accountStatus.hasFamily ? (
          <>
            <p className="sb-status-sub">
              {t('Get started by creating your family to begin tracking activities.')}
              {accountStatus.trialEnds && ` ${t('You have a trial that expires on')} ${new Date(accountStatus.trialEnds).toLocaleDateString()}.`}
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="sb-btn sb-sm" onClick={() => window.location.href = '/account/family-setup'}>
                {t('Create Family')}
              </button>
              <button type="button" className="sb-btn sb-ghost sb-sm" onClick={() => setShowPaymentModal(true)}>
                {t('Upgrade Plan')}
              </button>
            </div>
          </>
        ) : subscriptionView.kind === 'lifetime' ? (
          <div className="sb-status-line"><i /><span>{t('Lifetime member')}</span></div>
        ) : subscriptionView.kind === 'trial' ? (
          <>
            <div className="sb-status-line">
              <i />
              <span>{t('Free trial — {days} days left').replace('{days}', String(subscriptionView.daysLeft))}</span>
            </div>
            <p className="sb-status-sub">
              {subscriptionView.endDate
                ? t('Ends {date} · then $2.99/month').replace('{date}', subscriptionView.endDate.toLocaleDateString())
                : t('Then $2.99/month')}
            </p>
            <button type="button" className="sb-btn sb-ghost sb-sm" onClick={() => setShowPaymentModal(true)}>
              {t('Start my subscription')}
            </button>
          </>
        ) : subscriptionView.kind === 'active' ? (
          <>
            <div className="sb-status-line"><i /><span>{t('Active')}</span></div>
            <p className="sb-status-sub">
              {subscriptionView.endDate
                ? (subscriptionView.cancelAtPeriodEnd
                    ? t('Ends {date} · $2.99/month').replace('{date}', subscriptionView.endDate.toLocaleDateString())
                    : t('Renews {date} · $2.99/month').replace('{date}', subscriptionView.endDate.toLocaleDateString()))
                : t('$2.99/month')}
            </p>
            {subscriptionView.cancelAtPeriodEnd ? (
              <button type="button" className="sb-btn sb-ghost sb-sm" onClick={handleRenewSubscription} disabled={renewingSubscription}>
                {renewingSubscription ? t('Renewing...') : t('Renew Subscription')}
              </button>
            ) : (
              <button type="button" className="sb-btn sb-ghost sb-sm" onClick={() => setShowPaymentModal(true)}>
                {t('Manage billing')}
              </button>
            )}
          </>
        ) : subscriptionView.kind === 'expired' ? (
          <>
            <div className="sb-status-line"><i className="sb-bad" /><span>{t('Expired')}</span></div>
            <div className="sb-alertbox">
              <b>{t('Logging is paused — your data is safe.')}</b>
              <p>{t('Everything your family tracked is still here. Renew and you pick up right where you left off.')}</p>
              <button type="button" className="sb-btn sb-sm" onClick={() => setShowPaymentModal(true)}>
                {t('Renew for $2.99/month')}
              </button>
            </div>
          </>
        ) : null}

        {(accountStatus.subscriptionActive || accountStatus.planType) && (
          <div style={{ marginTop: 12 }}>
            <button type="button" className="sb-btn sb-ghost sb-sm" onClick={() => setShowPaymentHistory(true)}>
              <Receipt size={15} strokeWidth={1.8} />
              {t('Payment history')}
            </button>
          </div>
        )}
      </div>

      {/* Family Information Section - Only show if family data exists */}
      {familyData && (
        <div className="sb-sect">
          <div className="sb-sect-hd">
            <Home size={20} strokeWidth={1.8} />
            <h3>{t('Family')}</h3>
            {!editingFamily && (
              <button
                type="button"
                className="sb-btn sb-ghost sb-sm"
                onClick={() => {
                  setEditingFamily(true);
                  setFamilyMessage('');
                }}
              >
                {t('Edit')}
              </button>
            )}
          </div>

          {editingFamily ? (
            <div className="sb-f-grid">
              <div>
                <label className="sb-fl" htmlFor="familyName">{t('Family name')}</label>
                <input
                  id="familyName"
                  className="sb-fi"
                  value={familyFormData.name}
                  onChange={(e) => setFamilyFormData(prev => ({ ...prev, name: e.target.value }))}
                  disabled={savingFamily}
                />
              </div>
              <div>
                <label className="sb-fl" htmlFor="familySlug">{t('Family link')}</label>
                <input
                  id="familySlug"
                  className="sb-fi sb-mono"
                  value={familyFormData.slug}
                  onChange={(e) => setFamilyFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase() }))}
                  disabled={savingFamily}
                />
                <p className="sb-fh">{t("Your family's private address — share it with caretakers.")}</p>
                {slugError && <p className="sb-form-error">{slugError}</p>}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="sb-btn sb-sm"
                  onClick={handleFamilySave}
                  disabled={savingFamily || !!slugError || checkingSlug}
                >
                  {savingFamily ? t('Saving…') : t('Save')}
                </button>
                <button
                  type="button"
                  className="sb-btn sb-ghost sb-sm"
                  onClick={() => {
                    setEditingFamily(false);
                    setFamilyFormData({
                      name: familyData?.name || '',
                      slug: familyData?.slug || '',
                    });
                    setSlugError('');
                    setFamilyMessage('');
                  }}
                  disabled={savingFamily}
                >
                  {t('Cancel')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="sb-irow"><Home size={16} strokeWidth={1.8} /><b>{familyData.name}</b></div>
              <div className="sb-irow">
                <Key size={16} strokeWidth={1.8} />
                <span className="sb-mono">{typeof window !== 'undefined' ? window.location.host : ''}/{familyData.slug}</span>
              </div>
            </>
          )}

          {familyMessage && (
            <p className={familyMessage.startsWith('Error') ? 'sb-msg-err' : 'sb-msg-ok'} style={{ marginTop: 12 }}>
              {familyMessage}
            </p>
          )}
        </div>
      )}

      {/* Your data Section - Only show if family data exists */}
      {familyData && (
        <div className="sb-sect">
          <div className="sb-sect-hd">
            <Download size={20} strokeWidth={1.8} />
            <h3>{t('Your data')}</h3>
          </div>
          <p>{t('Everything your family has logged — feeds, naps, contacts, settings — in one file, whenever you like.')}</p>
          <button type="button" className="sb-btn sb-ghost sb-sm" onClick={handleDataDownload} disabled={downloadingData}>
            <Download size={15} strokeWidth={1.8} />
            {downloadingData ? t('Preparing…') : t('Download my data')}
          </button>
        </div>
      )}

      {/* Account Closure Section */}
      <div className="sb-sect">
        <div className="sb-sect-hd">
          <AlertTriangle size={20} strokeWidth={1.8} style={{ color: 'var(--rust)' }} />
          <h3 style={{ color: 'var(--rust)' }}>{t('Close account')}</h3>
        </div>

        {accountClosed ? (
          <div className="sb-alertbox">
            <b>{t('Your account is closed.')}</b>
            <p>{t('Signing you out in {seconds}s…').replace('{seconds}', String(logoutCountdown))}</p>
          </div>
        ) : confirmingClosure ? (
          <div className="sb-f-grid">
            <p style={{ fontWeight: 700, color: 'var(--rust)', margin: 0 }}>
              {t('This closes the book for good. Are you sure?')}
            </p>
            <div>
              <label className="sb-fl" htmlFor="closurePassword">{t('Confirm with your password')}</label>
              <input
                id="closurePassword"
                className="sb-fi"
                type="password"
                value={closurePasswordData.password}
                onChange={(e) => setClosurePasswordData({ password: e.target.value })}
                disabled={closurePasswordLoading || closingAccount}
              />
            </div>
            {closurePasswordMessage && <p className="sb-form-error">{closurePasswordMessage}</p>}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="sb-btn sb-danger sb-solid sb-sm"
                onClick={handleClosurePasswordConfirm} disabled={closurePasswordLoading || closingAccount || !closurePasswordData.password}>
                {closurePasswordLoading || closingAccount ? t('One moment…') : t('Yes, close it')}
              </button>
              <button type="button" className="sb-btn sb-ghost sb-sm" onClick={handleClosureCancel} disabled={closurePasswordLoading || closingAccount}>
                {t('Keep my account')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p>{t("Closing your account permanently ends access to your family's data. Download your data first if you want to keep it.")}</p>
            <button type="button" className="sb-btn sb-danger sb-sm" onClick={() => setConfirmingClosure(true)}>
              {t('Close my account')}
            </button>
          </>
        )}
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        accountStatus={{
          accountStatus: accountStatus.accountStatus,
          planType: accountStatus.planType || null,
          subscriptionActive: accountStatus.subscriptionActive,
          trialEnds: accountStatus.trialEnds || null,
          planExpires: accountStatus.planExpires || null,
          subscriptionId: accountStatus.subscriptionId || null,
        }}
        onPaymentSuccess={() => {
          setShowPaymentModal(false);
          onDataRefresh();
        }}
      />

      {/* Payment History Modal */}
      <PaymentHistory
        isOpen={showPaymentHistory}
        onClose={() => setShowPaymentHistory(false)}
      />
    </div>
  );
};

export default AccountSettingsTab;
