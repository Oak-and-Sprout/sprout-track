'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

/**
 * Deployment configuration interface
 */
interface DeploymentConfig {
  deploymentMode: 'saas' | 'selfhosted' | null;
  enableAccounts: boolean | null;
  allowAccountRegistration: boolean | null;
  betaEnabled: boolean | null;
  notificationsEnabled: boolean | null;
}

/**
 * Interface for the deployment context
 */
interface DeploymentContextType {
  /**
   * Whether the deployment context is still loading
   */
  isLoading: boolean;
  
  /**
   * The deployment configuration
   */
  config: DeploymentConfig | null;
  
  /**
   * Whether the app is running in SaaS mode
   */
  isSaasMode: boolean;
  
  /**
   * Whether the app is running in self-hosted mode
   */
  isSelfHosted: boolean;
  
  /**
   * Whether accounts are enabled
   */
  accountsEnabled: boolean;
  
  /**
   * Whether account registration is allowed
   */
  registrationAllowed: boolean;
  
  /**
   * Whether beta mode is enabled
   */
  betaEnabled: boolean;

  /**
   * Whether push notifications are enabled
   */
  notificationsEnabled: boolean;

  /**
   * Force refresh the deployment configuration
   */
  refreshConfig: () => void;
  
  /**
   * Get deployment information for debugging
   */
  getDeploymentInfo: () => {
    config: DeploymentConfig | null;
    isLoading: boolean;
    lastFetched: Date | null;
  };
}

const DeploymentContext = createContext<DeploymentContextType | undefined>(undefined);

/**
 * Provider component for deployment context
 */
export function DeploymentProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [config, setConfig] = useState<DeploymentConfig | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  /**
   * Fetch deployment configuration from the API
   */
  const fetchDeploymentConfig = async (): Promise<void> => {
    setIsLoading(true);
    
    try {
      console.log('Fetching deployment configuration...');
      
      const response = await fetch('/api/deployment-config', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        const deploymentConfig: DeploymentConfig = {
          deploymentMode: result.data.deploymentMode || null,
          enableAccounts: result.data.enableAccounts || false,
          allowAccountRegistration: result.data.allowAccountRegistration || false,
          betaEnabled: result.data.betaEnabled !== undefined ? result.data.betaEnabled : null,
          notificationsEnabled: result.data.notificationsEnabled || false,
        };
        
        setConfig(deploymentConfig);
        setLastFetched(new Date());
        
        console.log('Deployment configuration loaded:', deploymentConfig);
      } else {
        throw new Error(result.error || 'Failed to fetch deployment configuration');
      }
    } catch (error) {
      console.error('Error fetching deployment configuration:', error);
      
      // Fallback to default configuration
      const fallbackConfig: DeploymentConfig = {
        deploymentMode: null,
        enableAccounts: false,
        allowAccountRegistration: false,
        betaEnabled: null,
        notificationsEnabled: false,
      };
      
      setConfig(fallbackConfig);
      setLastFetched(new Date());
      
      console.warn('Using fallback deployment configuration:', fallbackConfig);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize deployment configuration on mount
  useEffect(() => {
    fetchDeploymentConfig();
  }, []);

  // Refresh configuration when window gains focus (in case deployment mode changed)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleFocus = () => {
        // Only refresh if it's been more than 5 minutes since last fetch
        if (lastFetched && Date.now() - lastFetched.getTime() > 5 * 60 * 1000) {
          console.log('Window focused, refreshing deployment configuration');
          fetchDeploymentConfig();
        }
      };
      
      window.addEventListener('focus', handleFocus);
      return () => window.removeEventListener('focus', handleFocus);
    }
  }, [lastFetched]);

  /**
   * Force refresh the deployment configuration
   */
  const refreshConfig = (): void => {
    console.log('Manually refreshing deployment configuration');
    fetchDeploymentConfig();
  };

  /**
   * Get deployment information for debugging
   */
  const getDeploymentInfo = () => {
    return {
      config,
      isLoading,
      lastFetched,
    };
  };

  // Computed values based on configuration
  const isSaasMode = config?.deploymentMode === 'saas';
  const isSelfHosted = config?.deploymentMode === 'selfhosted';
  const accountsEnabled = config?.enableAccounts || false;
  const registrationAllowed = config?.allowAccountRegistration || false;
  const betaEnabled = config?.betaEnabled === true;
  const notificationsEnabled = config?.notificationsEnabled === true;

  return (
    <DeploymentContext.Provider value={{
      isLoading,
      config,
      isSaasMode,
      isSelfHosted,
      accountsEnabled,
      registrationAllowed,
      betaEnabled,
      notificationsEnabled,
      refreshConfig,
      getDeploymentInfo,
    }}>
      {children}
    </DeploymentContext.Provider>
  );
}

/**
 * Hook to use the deployment context
 */
export function useDeployment() {
  const context = useContext(DeploymentContext);
  if (context === undefined) {
    throw new Error('useDeployment must be used within a DeploymentProvider');
  }
  return context;
}
