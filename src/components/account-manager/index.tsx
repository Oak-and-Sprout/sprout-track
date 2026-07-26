'use client';

import React, { useState, useEffect } from 'react';
import { StorybookDrawer } from '@/src/components/ui/storybook-drawer';
import { Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { styles } from './account-manager.styles';
import { AccountManagerProps, AccountStatus, FamilyData } from './account-manager.types';
import AccountSettingsTab from './AccountSettingsTab';
import FamilyPeopleTab from './FamilyPeopleTab';
import { useLocalization } from '@/src/context/localization';

import './account-manager.css';

/**
 * AccountManager Component
 * 
 * A tabbed component that allows authenticated users to manage their account
 * and family settings, including account information, family settings, and
 * managing family members (babies, caretakers, contacts).
 * 
 * @example
 * ```tsx
 * <AccountManager
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 * />
 * ```
 */
const AccountManager: React.FC<AccountManagerProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useLocalization();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'account' | 'family'>('account');

  // Data states
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [familyData, setFamilyData] = useState<FamilyData | null>(null);

  // Fetch data when the component opens
  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  // Fall back to the account tab if the family tab becomes unavailable
  useEffect(() => {
    if (!familyData) {
      setActiveTab('account');
    }
  }, [familyData]);
  
  // Fetch all necessary data
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const authToken = localStorage.getItem('authToken');
      if (!authToken) {
        throw new Error('Authentication token not found');
      }
      
      const fetchOptions = {
        headers: { 'Authorization': `Bearer ${authToken}` }
      };
      
      // Fetch account status first (includes family info)
      const accountStatusRes = await fetch('/api/accounts/status', fetchOptions);
      
      if (accountStatusRes.ok) {
        const data = await accountStatusRes.json();
        if (data.success) {
          setAccountStatus(data.data);
          
          // If account has family, fetch detailed family data
          if (data.data.hasFamily && data.data.familySlug) {
            try {
              const familyRes = await fetch('/api/family', fetchOptions);
              if (familyRes.ok) {
                const familyData = await familyRes.json();
                if (familyData.success) {
                  setFamilyData(familyData.data);
                } else {
                  // Family data fetch failed, but we can still show account info
                  console.warn('Failed to fetch detailed family data:', familyData.error);
                  setFamilyData(null);
                }
              } else {
                // Family API call failed, but we can still show account info
                console.warn('Family API call failed');
                setFamilyData(null);
              }
            } catch (familyErr) {
              // Family fetch failed, but we can still show account info
              console.warn('Family data not available:', familyErr);
              setFamilyData(null);
            }
          } else {
            // Account has no family - this is normal for new accounts
            setFamilyData(null);
          }
        } else {
          throw new Error(data.error || 'Failed to fetch account status');
        }
      } else {
        throw new Error('Failed to fetch account status');
      }
    } catch (err) {
      console.error('Error fetching account data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load account data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle data refresh
  const handleDataRefresh = () => {
    fetchData();
  };

  return (
    <StorybookDrawer
      open={isOpen}
      onClose={onClose}
      title={t('Your account')}
      art="butterfly"
      headerExtras={
        <nav className="sb-tabs">
          <button
            type="button"
            className={`sb-tab${activeTab === 'account' ? ' sb-on' : ''}`}
            onClick={() => setActiveTab('account')}
          >
            {t('Account')}
          </button>
          {familyData && (
            <button
              type="button"
              className={`sb-tab${activeTab === 'family' ? ' sb-on' : ''}`}
              onClick={() => setActiveTab('family')}
            >
              {t('Family & people')}
            </button>
          )}
        </nav>
      }
    >
      {isLoading ? (
        <div className={cn(styles.loadingContainer, "account-manager-loading-container")}>
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" aria-hidden="true" />
          <p className={cn("mt-2 text-gray-600", "account-manager-loading-text")}>{t('Loading...')}</p>
        </div>
      ) : error ? (
        <div className={cn(styles.errorContainer, "account-manager-error-container")}>
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            <p className="font-medium">{t('Error')}</p>
          </div>
          <p className="sb-form-error">{error}</p>
          <button type="button" className="sb-btn sb-ghost sb-sm mt-2" onClick={fetchData}>
            {t('Retry')}
          </button>
        </div>
      ) : activeTab === 'account' && accountStatus ? (
        <AccountSettingsTab
          accountStatus={accountStatus}
          familyData={familyData}
          onDataRefresh={handleDataRefresh}
        />
      ) : familyData ? (
        <FamilyPeopleTab familyData={familyData} onDataRefresh={handleDataRefresh} />
      ) : null}
    </StorybookDrawer>
  );
};

export default AccountManager;
