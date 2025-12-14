'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeProvider } from '@/src/context/theme';
import SetupWizard from '@/src/components/SetupWizard';

// TODO: Setup wizard implementation needed for future
// This page will handle initial family setup and onboarding
// Currently redirecting to home until implementation is complete

/* 
FUTURE IMPLEMENTATION NOTES:
- Implement full setup wizard flow
- Handle family creation and initial configuration
- Support caretaker and baby setup
- Integrate with multi-family architecture

Original logic (commented out for future reference):

import SetupWizard from '@/src/components/SetupWizard';

export default function SetupPage() {
  const router = useRouter();

  const handleSetupComplete = (family: { id: string; name: string; slug: string }) => {
    router.push(`/${family.slug}`);
  };

  const handleCaretakerCreate = () => {
    console.log('Caretaker creation will be handled in a later step.');
  };

  const handleBabyCreate = () => {
    console.log('Baby creation will be handled in a later step.');
  };
  
  return (
    <ThemeProvider>
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <SetupWizard
        onComplete={handleSetupComplete}
        onCaretakerCreate={handleCaretakerCreate}
        onBabyCreate={handleBabyCreate}
      />
    </div>
    </ThemeProvider>
  );
}
*/

export default function SetupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        // First check if user is authenticated
        const authToken = localStorage.getItem('authToken');
        const unlockTime = localStorage.getItem('unlockTime');
        
        if (!authToken || !unlockTime) {
          // Not authenticated - redirect to login with setup parameter
          router.push('/login?setup=true');
          return;
        }
        
        // Check if token is still valid
        try {
          const payload = authToken.split('.')[1];
          const decodedPayload = JSON.parse(atob(payload));
          
          if (decodedPayload.exp && decodedPayload.exp * 1000 <= Date.now()) {
            // Token expired - redirect to login
            localStorage.removeItem('authToken');
            localStorage.removeItem('unlockTime');
            localStorage.removeItem('caretakerId');
            router.push('/login?setup=true');
            return;
          }
        } catch (error) {
          console.error('Error parsing JWT token:', error);
          // Invalid token - redirect to login
          localStorage.removeItem('authToken');
          localStorage.removeItem('unlockTime');
          localStorage.removeItem('caretakerId');
          router.push('/login?setup=true');
          return;
        }
        
        setIsAuthenticated(true);
        
        // Check if setup is needed by looking at multiple factors
        const [familiesResponse, caretakerExistsResponse] = await Promise.all([
          fetch('/api/family/public-list'),
          fetch('/api/auth/caretaker-exists')
        ]);
        
        const familiesData = await familiesResponse.json();
        const caretakerData = await caretakerExistsResponse.json();
        
        if (familiesData.success && caretakerData.success) {
          const families = familiesData.data || [];
          const hasCaretakers = caretakerData.data?.exists || false;
          
          // Setup is needed if:
          // 1. No families exist, OR
          // 2. Only one family exists (the default "My Family") AND no caretakers exist (other than system)
          if (families.length === 0 || 
              (families.length === 1 && families[0].slug === 'my-family' && !hasCaretakers)) {
            setNeedsSetup(true);
          } else {
            // Setup already completed, redirect to home
            router.push('/');
          }
        } else {
          // If we can't determine setup status, assume setup is needed
          setNeedsSetup(true);
        }
      } catch (error) {
        console.error('Error checking setup status:', error);
        // On error, assume setup is needed
        setNeedsSetup(true);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkSetupStatus();
  }, [router]);

  const handleSetupComplete = (family: { id: string; name: string; slug: string }) => {
    console.log('Setup completed for family:', family);

    // Check if user is authenticated with an account
    const authToken = localStorage.getItem('authToken');
    let isAccountAuth = false;

    if (authToken) {
      try {
        const base64Url = authToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const decoded = JSON.parse(jsonPayload);
        isAccountAuth = decoded.isAccountAuth === true;
      } catch (error) {
        console.error('Error checking account auth:', error);
      }
    }

    // Redirect to family root (which shows login UI for PIN users, or app for account users)
    router.push(`/${family.slug}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Checking setup status...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // This shouldn't render as useEffect will redirect, but just in case
    return null;
  }

  if (!needsSetup) {
    // This shouldn't render as useEffect will redirect, but just in case
    return null;
  }

  return (
    <ThemeProvider>
      <SetupWizard 
        onComplete={handleSetupComplete} 
        initialSetup={true}
      />
    </ThemeProvider>
  );
} 