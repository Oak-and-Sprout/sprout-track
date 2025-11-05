import React, { useState, useCallback } from 'react';
import { cn } from '@/src/lib/utils';
import { styles } from './account-manager.styles';
import { AccountSettingsTabProps } from './account-manager.types';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import PaymentModal from './PaymentModal';
import PaymentHistory from './PaymentHistory';
import {
  User,
  Mail,
  Home,
  Link,
  Download,
  AlertTriangle,
  Edit,
  Save,
  X,
  Loader2,
  CheckCircle,
  Key,
  Crown,
  Calendar,
  Shield,
  CreditCard,
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
              
              window.location.href = '/';
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
      <div className={cn(styles.sectionBorder, "account-manager-section-border")}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={cn(styles.sectionTitle, "account-manager-section-title")}>
            Account Information
          </h3>
          {!editingAccount && !changingPassword && (
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingAccount(true);
                  setAccountMessage('');
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          )}
        </div>

        {editingAccount ? (
          <div className={cn(styles.formGroup, "account-manager-form-group")}>
            <div className={styles.formRow}>
              <div className={cn(styles.formField, "account-manager-form-field")}>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={accountFormData.firstName}
                  onChange={(e) => setAccountFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  disabled={savingAccount}
                />
              </div>
              <div className={cn(styles.formField, "account-manager-form-field")}>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={accountFormData.lastName}
                  onChange={(e) => setAccountFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  disabled={savingAccount}
                />
              </div>
            </div>
            <div className={cn(styles.formField, "account-manager-form-field")}>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={accountFormData.email}
                onChange={(e) => setAccountFormData(prev => ({ ...prev, email: e.target.value }))}
                disabled={savingAccount}
              />
            </div>
            
            <div className={styles.buttonGroup}>
              <Button
                onClick={handleAccountSave}
                disabled={savingAccount}
              >
                {savingAccount ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </>
                )}
              </Button>
              <Button
                variant="outline"
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
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        ) : changingPassword ? (
          <div className={cn(styles.formGroup, "account-manager-form-group")}>
            {passwordStep === 'confirm' ? (
              <>
                <h4 className="text-lg font-medium mb-3">Confirm Current Password</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Please enter your current password to confirm you want to change it.
                </p>
                <div className={cn(styles.formField, "account-manager-form-field")}>
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordFormData.currentPassword}
                    onChange={(e) => setPasswordFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                    disabled={changingPasswordLoading}
                    placeholder="Enter your current password"
                  />
                </div>
                
                <div className={styles.buttonGroup}>
                  <Button
                    onClick={handlePasswordConfirm}
                    disabled={changingPasswordLoading || !passwordFormData.currentPassword}
                  >
                    {changingPasswordLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <Key className="h-4 w-4 mr-2" />
                        Continue
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handlePasswordCancel}
                    disabled={changingPasswordLoading}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h4 className="text-lg font-medium mb-3">Set New Password</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Enter your new password. It must meet all the requirements below.
                </p>
                
                <div className={cn(styles.formField, "account-manager-form-field")}>
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordFormData.newPassword}
                    onChange={(e) => {
                      const newPassword = e.target.value;
                      setPasswordFormData(prev => ({ ...prev, newPassword }));
                      updatePasswordValidation(newPassword);
                    }}
                    disabled={changingPasswordLoading}
                    placeholder="Enter new password"
                  />
                </div>

                <div className={cn(styles.formField, "account-manager-form-field")}>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordFormData.confirmPassword}
                    onChange={(e) => setPasswordFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    disabled={changingPasswordLoading}
                    placeholder="Confirm new password"
                  />
                </div>

                {/* Password Requirements */}
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-gray-700 mb-2">Password Requirements:</p>
                  <div className="grid grid-cols-1 gap-1 text-xs">
                    <div className={`flex items-center gap-2 ${passwordValidation.length ? 'text-green-600' : 'text-gray-500'}`}>
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${passwordValidation.length ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300'}`}>
                        {passwordValidation.length && '✓'}
                      </span>
                      At least 8 characters
                    </div>
                    <div className={`flex items-center gap-2 ${passwordValidation.lowercase ? 'text-green-600' : 'text-gray-500'}`}>
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${passwordValidation.lowercase ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300'}`}>
                        {passwordValidation.lowercase && '✓'}
                      </span>
                      One lowercase letter (a-z)
                    </div>
                    <div className={`flex items-center gap-2 ${passwordValidation.uppercase ? 'text-green-600' : 'text-gray-500'}`}>
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${passwordValidation.uppercase ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300'}`}>
                        {passwordValidation.uppercase && '✓'}
                      </span>
                      One uppercase letter (A-Z)
                    </div>
                    <div className={`flex items-center gap-2 ${passwordValidation.number ? 'text-green-600' : 'text-gray-500'}`}>
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${passwordValidation.number ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300'}`}>
                        {passwordValidation.number && '✓'}
                      </span>
                      One number (0-9)
                    </div>
                    <div className={`flex items-center gap-2 ${passwordValidation.special ? 'text-green-600' : 'text-gray-500'}`}>
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${passwordValidation.special ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300'}`}>
                        {passwordValidation.special && '✓'}
                      </span>
                      One special character (!@#$%^&*)
                    </div>
                  </div>
                </div>
                
                <div className={styles.buttonGroup}>
                  <Button
                    onClick={handlePasswordChange}
                    disabled={changingPasswordLoading || !passwordFormData.newPassword || !passwordFormData.confirmPassword}
                  >
                    {changingPasswordLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Changing Password...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Change Password
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handlePasswordCancel}
                    disabled={changingPasswordLoading}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className={styles.formGroup}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <Label className="font-medium">{accountStatus.firstName} {accountStatus.lastName}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <Label>{accountStatus.email}</Label>
                  {!accountStatus.verified && (
                    <span className="text-amber-600 text-sm">(Unverified)</span>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setChangingPassword(true);
                  setPasswordMessage('');
                }}
                className="self-start"
              >
                <Key className="h-4 w-4 mr-2" />
                Reset Password
              </Button>
            </div>
          </div>
        )}

        {(accountMessage || passwordMessage) && (
          <div className={cn(
            "mt-4 p-3 rounded-md text-sm",
            (accountMessage && accountMessage.startsWith('Error')) || (passwordMessage && passwordMessage.startsWith('Error'))
              ? "bg-red-50 text-red-600 account-manager-error-message" 
              : "bg-green-50 text-green-600 account-manager-success-message"
          )}>
            <div className="flex items-center gap-2">
              {((accountMessage && accountMessage.startsWith('Error')) || (passwordMessage && passwordMessage.startsWith('Error'))) ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              {passwordMessage || accountMessage}
            </div>
          </div>
        )}
      </div>

      {/* Account Status Section */}
      <div className={cn(styles.sectionBorder, "account-manager-section-border")}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={cn(styles.sectionTitle, "account-manager-section-title")}>
            Account Status
          </h3>
        </div>

        <div className={styles.formGroup}>
          {accountStatus.betaparticipant ? (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <Crown className="h-6 w-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-purple-800 mb-2">
                    Beta Participant
                  </h4>
                  <p className="text-purple-700 mb-3">
                    Thank you for being a beta participant and helping Sprout Track grow!
                    You have full access to all features and functionality.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-purple-600">
                    <Shield className="h-4 w-4" />
                    <span className="font-medium">Full Access</span>
                  </div>
                </div>
              </div>
            </div>
          ) : !accountStatus.hasFamily ? (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <Home className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-blue-800 mb-2">
                      No Family Created Yet
                    </h4>
                    <p className="text-blue-700 mb-3">
                      Get started by creating your family to begin tracking activities.
                    </p>
                    {accountStatus.trialEnds && (
                      <p className="text-sm text-blue-600 mb-3">
                        You have a trial that expires on {new Date(accountStatus.trialEnds).toLocaleDateString()}.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => window.location.href = '/account/family-setup'}
                  className="flex-1"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Create Family
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowPaymentModal(true)}
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade Plan
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  accountStatus.accountStatus === 'active' ? "bg-green-500" :
                  accountStatus.accountStatus === 'trial' ? "bg-blue-500" :
                  accountStatus.accountStatus === 'expired' ? "bg-red-500" :
                  accountStatus.accountStatus === 'closed' ? "bg-gray-500" :
                  accountStatus.accountStatus === 'no_family' ? "bg-orange-500" :
                  "bg-yellow-500"
                )} />
                <Label className="font-medium capitalize">
                  {accountStatus.accountStatus.replace('_', ' ')} Account
                </Label>
              </div>

              {accountStatus.subscriptionActive && (
                <div className="flex items-center gap-2">
                  <CheckCircle className={cn(
                    "h-4 w-4",
                    subscriptionStatus?.cancelAtPeriodEnd ? "text-amber-600" : "text-green-600"
                  )} />
                  <Label className={cn(
                    "font-medium",
                    subscriptionStatus?.cancelAtPeriodEnd ? "text-amber-700" : "text-green-600"
                  )}>
                    {accountStatus.accountStatus === 'trial' ? 'Active Trial' :
                     accountStatus.planType === 'full' ? 'Lifetime Member' :
                     subscriptionStatus?.cancelAtPeriodEnd ? 'Subscription Active (Cancelled)' :
                     'Subscription Active'}
                  </Label>
                </div>
              )}

              {accountStatus.trialEnds && (
                <>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <Label className="text-sm">
                      Trial ends {new Date(accountStatus.trialEnds).toLocaleDateString()}
                    </Label>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setShowPaymentModal(true)}
                    className="mt-2"
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade
                  </Button>
                </>
              )}

              {accountStatus.planExpires && !accountStatus.trialEnds && accountStatus.planType !== 'full' && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <Label className="text-sm">
                    Subscription ends {new Date(accountStatus.planExpires).toLocaleDateString()}
                  </Label>
                </div>
              )}

              {accountStatus.accountStatus === 'expired' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Account Expired</span>
                  </div>
                  <p className="text-sm text-red-600 mt-1 mb-3">
                    Your subscription has expired. Please update your payment method to continue using Sprout Track.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setShowPaymentModal(true)}
                    variant="destructive"
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Renew Subscription
                  </Button>
                </div>
              )}

              {((accountStatus.subscriptionActive && accountStatus.planType === 'sub' && accountStatus.accountStatus !== 'trial') || accountStatus.planType === 'full') && (
                <div className="flex flex-col sm:flex-row sm:justify-end gap-2 mt-3">
                  {accountStatus.subscriptionActive && accountStatus.planType === 'sub' && accountStatus.accountStatus !== 'trial' && !subscriptionStatus?.cancelAtPeriodEnd && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowPaymentModal(true)}
                      className="w-full sm:w-auto"
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Manage Subscription
                    </Button>
                  )}
                  {subscriptionStatus?.cancelAtPeriodEnd && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={handleRenewSubscription}
                      disabled={renewingSubscription}
                      className="w-full sm:w-auto"
                    >
                      {renewingSubscription ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Renewing...
                        </>
                      ) : (
                        <>
                          <Crown className="h-4 w-4 mr-2" />
                          Renew Subscription
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowPaymentHistory(true)}
                    className="w-full sm:w-auto"
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    Payment History
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Family Information Section - Only show if family data exists */}
      {familyData && (
        <div className={cn(styles.sectionBorder, "account-manager-section-border")}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={cn(styles.sectionTitle, "account-manager-section-title")}>
              Family Information
            </h3>
            {!editingFamily && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingFamily(true);
                  setFamilyMessage('');
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>

          {editingFamily ? (
            <div className={cn(styles.formGroup, "account-manager-form-group")}>
              <div className={cn(styles.formField, "account-manager-form-field")}>
                <Label htmlFor="familyName">Family Name</Label>
                <Input
                  id="familyName"
                  value={familyFormData.name}
                  onChange={(e) => setFamilyFormData(prev => ({ ...prev, name: e.target.value }))}
                  disabled={savingFamily}
                />
              </div>
              <div className={cn(styles.formField, "account-manager-form-field")}>
                <Label htmlFor="familySlug">Family URL Slug</Label>
                <div className="relative">
                  <Input
                    id="familySlug"
                    value={familyFormData.slug}
                    onChange={(e) => setFamilyFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase() }))}
                    disabled={savingFamily}
                    className={slugError ? 'border-red-500' : ''}
                  />
                  {checkingSlug && (
                    <Loader2 className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                  )}
                </div>
                {/* Validation feedback */}
                <div className="min-h-[20px] mt-1">
                  {checkingSlug && (
                    <div className="flex items-center gap-1 text-blue-600 text-sm">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Checking availability...
                    </div>
                  )}
                  {slugError && (
                    <div className="flex items-center gap-1 text-red-600 text-sm account-manager-validation-error">
                      <AlertTriangle className="h-3 w-3" />
                      {slugError}
                    </div>
                  )}
                  {!checkingSlug && !slugError && familyFormData.slug && familyFormData.slug !== familyData?.slug && (
                    <div className="flex items-center gap-1 text-green-600 text-sm">
                      <span className="h-3 w-3 rounded-full bg-green-600"></span>
                      URL is available
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1 account-manager-info-text">
                  This is your family's unique URL identifier
                </p>
              </div>
              
              <div className={styles.buttonGroup}>
                <Button
                  onClick={handleFamilySave}
                  disabled={savingFamily || !!slugError || checkingSlug}
                >
                  {savingFamily ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
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
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.formGroup}>
              <div className="flex items-center gap-2 mb-2">
                <Home className="h-4 w-4 text-gray-500" />
                <Label className="font-medium">{familyData.name}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Link className="h-4 w-4 text-gray-500" />
                <Label className="font-mono text-sm">/{familyData.slug}</Label>
              </div>
            </div>
          )}

          {familyMessage && (
            <div className={cn(
              "mt-4 p-3 rounded-md text-sm",
              familyMessage.startsWith('Error') 
                ? "bg-red-50 text-red-600 account-manager-error-message" 
                : "bg-green-50 text-green-600 account-manager-success-message"
            )}>
              <div className="flex items-center gap-2">
                {familyMessage.startsWith('Error') ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                {familyMessage}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Data Download Section - Only show if family data exists */}
      {familyData && (
        <div className={cn(styles.sectionBorder, "account-manager-section-border")}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={cn(styles.sectionTitle, "account-manager-section-title")}>
              Download Your Data
            </h3>
          </div>
          
          <div className={styles.formGroup}>
            <p className="text-sm text-gray-600 mb-4 account-manager-info-text">
              Download a complete copy of your family's data including all activities, contacts, and settings.
            </p>
            <Button
              onClick={handleDataDownload}
              disabled={downloadingData}
            >
              {downloadingData ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Preparing Download...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download Data
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Account Closure Section */}
      <div className={cn(styles.sectionBorder, "account-manager-section-border")}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={cn(styles.sectionTitle, "account-manager-section-title text-red-700")}>
            Close Account
          </h3>
        </div>

        {accountClosed ? (
          <div className={cn(styles.formGroup, "account-manager-form-group")}>
            <div className="text-center py-8">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
              </div>
              <h4 className="text-xl font-semibold text-gray-800 mb-2">
                Account Closed Successfully
              </h4>
              <p className="text-gray-600 mb-4">
                Your account has been closed and a confirmation email has been sent.
              </p>
              
              <div className="bg-red-50 rounded-lg p-6 mb-4 max-w-md mx-auto">
                <div className="flex items-center justify-center mb-4">
                  <div className="text-4xl font-bold text-red-600">
                    {logoutCountdown}
                  </div>
                </div>
                <p className="text-red-700 font-medium mb-3">
                  Logging out in {logoutCountdown} second{logoutCountdown !== 1 ? 's' : ''}...
                </p>
                <div className="w-full bg-red-200 rounded-full h-3">
                  <div 
                    className="bg-red-600 h-3 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${((5 - logoutCountdown) / 5) * 100}%` }}
                  />
                </div>
              </div>

              <div className="text-sm text-gray-500">
                <p>Thank you for using Sprout Track.</p>
                <p>You will be redirected to the home page automatically.</p>
              </div>
            </div>
          </div>
        ) : confirmingClosure ? (
          <div className={cn(styles.formGroup, "account-manager-form-group")}>
            <h4 className="text-lg font-medium mb-3 text-red-700">Confirm Account Closure</h4>
            <p className="text-sm text-gray-600 mb-4">
              Please enter your password to confirm you want to permanently close your account.
            </p>
            <div className={cn(styles.formField, "account-manager-form-field")}>
              <Label htmlFor="closurePassword">Password</Label>
              <Input
                id="closurePassword"
                type="password"
                value={closurePasswordData.password}
                onChange={(e) => setClosurePasswordData(prev => ({ ...prev, password: e.target.value }))}
                disabled={closurePasswordLoading || closingAccount}
                placeholder="Enter your password"
              />
            </div>
            
            <div className={styles.buttonGroup}>
              <Button
                onClick={handleClosurePasswordConfirm}
                disabled={closurePasswordLoading || closingAccount || !closurePasswordData.password}
                variant="destructive"
              >
                {closurePasswordLoading || closingAccount ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {closingAccount ? 'Closing Account...' : 'Verifying...'}
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Close Account
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleClosureCancel}
                disabled={closurePasswordLoading || closingAccount}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>

            {closurePasswordMessage && (
              <div className={cn(
                "mt-4 p-3 rounded-md text-sm",
                closurePasswordMessage.startsWith('Error') || closurePasswordMessage.includes('incorrect')
                  ? "bg-red-50 text-red-600 account-manager-error-message" 
                  : "bg-green-50 text-green-600 account-manager-success-message"
              )}>
                <div className="flex items-center gap-2">
                  {closurePasswordMessage.startsWith('Error') || closurePasswordMessage.includes('incorrect') ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  {closurePasswordMessage}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.formGroup}>
            <p className="text-sm text-gray-600 mb-4 account-manager-info-text">
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              Warning: Closing your account will permanently disable access to your {familyData ? "family" : "account"} data. 
              This action cannot be undone. Please download your data first if you want to keep it.
            </p>
            <Button
              onClick={() => setConfirmingClosure(true)}
              variant="destructive"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Close Account
            </Button>
          </div>
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
