'use client';

import React, { useState, useEffect } from 'react';
import FormPage, { FormPageFooter } from '@/src/components/ui/form-page';
import { FormPageTab } from '@/src/components/ui/form-page/form-page.types';
import { Button } from '@/src/components/ui/button';
import { Loader2, Settings, Users, Download, AlertTriangle } from 'lucide-react';
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
  
  // Data states
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [familyData, setFamilyData] = useState<FamilyData | null>(null);
  
  // Fetch data when the component opens
  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);
  
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

  // Create tabs configuration - conditionally include family people tab
  const tabs: FormPageTab[] = [
    {
      id: 'account-settings',
      label: familyData ? 'Account' : 'Account',
      icon: Settings,
      content: (
        <>
          {/* Loading state */}
          {isLoading && (
            <div className={cn(styles.loadingContainer, "account-manager-loading-container")}>
              <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              <p className={cn("mt-2 text-gray-600", "account-manager-loading-text")}>{t('Loading...')}</p>
            </div>
          )}
          
          {/* Error state */}
          {error && (
            <div className={cn(styles.errorContainer, "account-manager-error-container")}>
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <AlertTriangle className="h-5 w-5" />
                <p className="font-medium">{t('Error')}</p>
              </div>
              <p className={cn("text-red-500 mb-4", "account-manager-error-text")}>{error}</p>
              <Button 
                variant="outline" 
                onClick={fetchData} 
                className="mt-2"
              >
                {t('Retry')}
              </Button>
            </div>
          )}
          
          {/* Tab content */}
          {!isLoading && !error && accountStatus && (
            <AccountSettingsTab
              accountStatus={accountStatus}
              familyData={familyData}
              onDataRefresh={handleDataRefresh}
            />
          )}
        </>
      )
    }
  ];

  // Only add family people tab if family data exists
  if (familyData) {
    tabs.push({
      id: 'family-people',
      label: 'Family & People',
      icon: Users,
      content: (
        <>
          {/* Loading state */}
          {isLoading && (
            <div className={cn(styles.loadingContainer, "account-manager-loading-container")}>
              <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              <p className={cn("mt-2 text-gray-600", "account-manager-loading-text")}>{t('Loading...')}</p>
            </div>
          )}
          
          {/* Error state */}
          {error && (
            <div className={cn(styles.errorContainer, "account-manager-error-container")}>
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <AlertTriangle className="h-5 w-5" />
                <p className="font-medium">{t('Error')}</p>
              </div>
              <p className={cn("text-red-500 mb-4", "account-manager-error-text")}>{error}</p>
              <Button 
                variant="outline" 
                onClick={fetchData} 
                className="mt-2"
              >
                {t('Retry')}
              </Button>
            </div>
          )}
          
          {/* Tab content */}
          {!isLoading && !error && accountStatus && familyData && (
            <FamilyPeopleTab
              familyData={familyData}
              onDataRefresh={handleDataRefresh}
            />
          )}
        </>
      )
    });
  }
  
  return (
    <FormPage
      isOpen={isOpen}
      onClose={onClose}
      title="Account Manager"
      description="Manage your account settings and family information"
      tabs={tabs}
      defaultActiveTab="account-settings"
    >
      <FormPageFooter>
        <div className={cn(styles.footerContainer, "account-manager-footer-container")}>
          <Button onClick={onClose} variant="outline">
            {t('Close')}
          </Button>
        </div>
      </FormPageFooter>
    </FormPage>
  );
};

export default AccountManager;
