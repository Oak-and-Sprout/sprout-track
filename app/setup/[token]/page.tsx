'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeProvider } from '@/src/context/theme';
import SetupWizard from '@/src/components/SetupWizard';

// TODO: Setup wizard implementation needed for future
// This page will handle family setup with invitation tokens
// Currently redirecting to home until implementation is complete

/* 
FUTURE IMPLEMENTATION NOTES:
- Handle token-based family setup invitations
- Integrate with SetupWizard component 
- Support multi-family onboarding flow
- Add proper TypeScript types for Next.js App Router params (Promise-based)

Original logic (commented out for future reference):

import SetupWizard from '@/src/components/SetupWizard';

type SetupPageWithTokenProps = {
  params: Promise<{
    token: string;
  }>;
};

export default function SetupPageWithToken({ params }: SetupPageWithTokenProps) {
  const router = useRouter();
  const { token } = await params;

  const handleSetupComplete = (family: { id: string; name: string; slug: string }) => {
    router.push(`/${family.slug}/login`);
  };

  const handleCaretakerCreate = () => {
    console.log('Caretaker creation will be handled in a later step.');
  };

  const handleBabyCreate = () => {
    console.log('Baby creation will be handled in a later step.');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <SetupWizard
        token={token}
        onComplete={handleSetupComplete}
        onCaretakerCreate={handleCaretakerCreate}
        onBabyCreate={handleBabyCreate}
      />
    </div>
  );
}
*/

type SetupPageWithTokenProps = {
  params: Promise<{
    token: string;
  }>;
};

export default function SetupPageWithToken({ params }: SetupPageWithTokenProps) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const resolveParams = async () => {
      try {
        const resolvedParams = await params;
        const tokenParam = resolvedParams.token;
        setToken(tokenParam);
        
        // Check authentication first
        const authToken = localStorage.getItem('authToken');
        const unlockTime = localStorage.getItem('unlockTime');
        
        if (!authToken || !unlockTime) {
          // Not authenticated - redirect to login with token setup
          router.push(`/login?setup=token&token=${tokenParam}`);
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
            router.push(`/login?setup=token&token=${tokenParam}`);
            return;
          }
        } catch (error) {
          console.error('Error parsing JWT token:', error);
          // Invalid token - redirect to login
          localStorage.removeItem('authToken');
          localStorage.removeItem('unlockTime');
          localStorage.removeItem('caretakerId');
          router.push(`/login?setup=token&token=${tokenParam}`);
          return;
        }
        
        setIsAuthenticated(true);
        
        // Validate the setup token
        const response = await fetch(`/api/setup/validate-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: tokenParam }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setIsValidToken(true);
          } else {
            setError(data.error || 'Invalid setup token');
          }
        } else {
          setError('Failed to validate setup token');
        }
      } catch (error) {
        console.error('Error resolving params or validating token:', error);
        setError('Failed to validate setup token');
      } finally {
        setIsLoading(false);
      }
    };

    resolveParams();
  }, [params, router]);

  const handleSetupComplete = (family: { id: string; name: string; slug: string }) => {
    console.log('Token-based setup completed for family:', family);
    // Redirect to the newly created family's login page (user was logged out)
    router.push(`/${family.slug}/login`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Validating setup invitation...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // This shouldn't render as useEffect will redirect, but just in case
    return null;
  }

  if (error) {
    return (
      <ThemeProvider>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center max-w-md">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-red-900 mb-2">Setup Error</h2>
              <p className="text-red-700 mb-4">{error}</p>
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Return Home
              </button>
            </div>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  if (!isValidToken) {
    return (
      <ThemeProvider>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Validating invitation...</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SetupWizard onComplete={handleSetupComplete} token={token || undefined} />
    </ThemeProvider>
  );
} 