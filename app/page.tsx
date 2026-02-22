'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FamilyResponse } from './api/types';
import { ThemeProvider } from '@/src/context/theme';
import ComingSoon from './home/page';
import { useLocalization } from '@/src/context/localization';

export default function HomePage() {
  const { t } = useLocalization();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [families, setFamilies] = useState<FamilyResponse[]>([]);
  const [deploymentMode, setDeploymentMode] = useState<string>('selfhosted');

  useEffect(() => {
    // This page handles all routing logic for the root path
    // Individual family pages handle their own authentication checks
    const checkDeploymentMode = async () => {
      try {
        setLoading(true);
        
        // Check deployment mode first
        const configResponse = await fetch('/api/deployment-config');
        const configData = await configResponse.json();
        
        if (configData.success && configData.data?.deploymentMode === 'saas') {
          // SaaS mode - render SaaS homepage directly
          setDeploymentMode('saas');
          setLoading(false);
          return;
        }
        
        // Self-hosted mode - continue with existing logic
        setDeploymentMode('selfhosted');
        
        const [familiesResponse, caretakerExistsResponse] = await Promise.all([
          fetch('/api/family/public-list'),
          fetch('/api/auth/caretaker-exists')
        ]);
        
        const familiesData = await familiesResponse.json();
        const caretakerData = await caretakerExistsResponse.json();
        
        if (familiesData.success && Array.isArray(familiesData.data)) {
          const familiesList = familiesData.data;
          setFamilies(familiesList);
          
          // Check if setup is needed
          const hasCaretakers = caretakerData.success && caretakerData.data?.exists;
          const needsSetup = familiesList.length === 0 || 
                            (familiesList.length === 1 && familiesList[0].slug === 'my-family' && !hasCaretakers);
          
          if (needsSetup) {
            // Setup needed - redirect to login first for authentication
            router.push('/login?setup=true');
          } else if (familiesList.length === 1) {
            // If only one family exists (and setup is complete), redirect to that family
            const familySlug = familiesList[0].slug;
            
            // Check if user is already authenticated
            const authToken = localStorage.getItem('authToken');
            const unlockTime = localStorage.getItem('unlockTime');
            const accountUser = localStorage.getItem('accountUser');
            
            // Check if this is an account user (this logic only runs in self-hosted mode, 
            // where account users don't exist, so isAccountAuth will always be false)
            let isAccountAuth = false;
            if (authToken && accountUser) {
              try {
                // Parse JWT to check if it's account authentication
                const payload = JSON.parse(atob(authToken.split('.')[1]));
                isAccountAuth = payload.isAccountAuth || false;
              } catch (e) {
                // If we can't parse the token, fall back to checking accountUser existence
                isAccountAuth = !!accountUser;
              }
            }
            
            if (authToken && unlockTime && !isAccountAuth) {
              // PIN-based user is authenticated, redirect to main app
              router.push(`/${familySlug}/log-entry`);
            } else if (!authToken && !isAccountAuth) {
              // Not authenticated, redirect to family root (which shows login UI)
              router.push(`/${familySlug}`);
            }
            // If isAccountAuth is true, don't redirect - let them stay on homepage
          } else {
            // Multiple families case
            const authToken = localStorage.getItem('authToken');
            const accountUser = localStorage.getItem('accountUser');
            
            // Check if this is an account user (this logic only runs in self-hosted mode, 
            // where account users don't exist, so isAccountAuth will always be false)
            let isAccountAuth = false;
            if (authToken && accountUser) {
              try {
                const payload = JSON.parse(atob(authToken.split('.')[1]));
                isAccountAuth = payload.isAccountAuth || false;
              } catch (e) {
                isAccountAuth = !!accountUser;
              }
            }
            
            if (!isAccountAuth) {
              // PIN-based users with multiple families go to family selection
              router.push('/family-select');
            }
            // Account users stay on homepage (they only have one family anyway)
          }
        }
      } catch (error) {
        console.error('Error checking deployment mode or families:', error);
      } finally {
        setLoading(false);
      }
    };
    
    checkDeploymentMode();
  }, [router]);

  // Return loading state while checking deployment mode
  if (loading) {
    return <div className="flex items-center justify-center h-screen">{t('Loading...')}</div>;
  }
  
  // If SaaS mode, render the SaaS homepage directly
  if (deploymentMode === 'saas') {
    return (
      <ThemeProvider>
        <ComingSoon />
      </ThemeProvider>
    );
  }
  
  // This should not render for self-hosted as useEffect will redirect
  return null;
}
