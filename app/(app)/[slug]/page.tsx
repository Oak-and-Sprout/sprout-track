'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import LoginSecurity from '@/src/components/LoginSecurity';
import { useTheme } from '@/src/context/theme';
import { useFamily } from '@/src/context/family';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { FamilyResponse } from '@/app/api/types';

function FamilySlugPageContent() {
  const router = useRouter();
  const params = useParams();
  const { theme } = useTheme();
  const { family, loading: familyLoading } = useFamily();
  const [families, setFamilies] = useState<FamilyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [slugValidated, setSlugValidated] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const hasRedirectedRef = useRef(false);
  const familySlug = params?.slug as string;

  // Validate family slug exists first
  useEffect(() => {
    const validateSlug = async () => {
      if (!familySlug) {
        setSlugValidated(true);
        return;
      }

      try {
        const response = await fetch(`/api/family/by-slug/${encodeURIComponent(familySlug)}`);
        const data = await response.json();
        
        // If family doesn't exist, redirect to home
        if (!data.success || !data.data) {
          console.log(`Family slug "${familySlug}" not found, redirecting to home...`);
          router.push('/');
          return;
        }
        
        // Family exists, allow page to continue loading
        setSlugValidated(true);
      } catch (error) {
        console.error('Error validating family slug:', error);
        // On error, redirect to home to be safe
        router.push('/');
      }
    };

    validateSlug();
  }, [familySlug, router]);

  // Load families for the dropdown
  useEffect(() => {
    // Don't load families until slug is validated
    if (!slugValidated) return;
    const loadFamilies = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/family/public-list');
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.data)) {
            setFamilies(data.data);
          }
        }
      } catch (error) {
        console.error('Error loading families:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFamilies();
  }, [slugValidated]);

  // Check authentication status (only once when slug is validated)
  useEffect(() => {
    // Don't check auth until slug is validated
    if (!slugValidated) return;
    
    setIsCheckingAuth(true);
    
    const checkAuth = () => {
      const authToken = localStorage.getItem('authToken');
      const unlockTime = localStorage.getItem('unlockTime');
      
      // Check if user is authenticated via account
      let isAccountAuth = false;
      if (authToken) {
        try {
          const payload = authToken.split('.')[1];
          const decodedPayload = JSON.parse(atob(payload));
          isAccountAuth = decodedPayload.isAccountAuth || false;
          
          // Check if token has expired
          if (decodedPayload.exp && decodedPayload.exp * 1000 < Date.now()) {
            // Token expired, clear it
            localStorage.removeItem('authToken');
            localStorage.removeItem('unlockTime');
            localStorage.removeItem('caretakerId');
            setIsAuthenticated(false);
            setIsCheckingAuth(false);
            return;
          }
        } catch (error) {
          console.error('Error parsing JWT token:', error);
          // Invalid token, clear it
          localStorage.removeItem('authToken');
          localStorage.removeItem('unlockTime');
          localStorage.removeItem('caretakerId');
          setIsAuthenticated(false);
          setIsCheckingAuth(false);
          return;
        }
      }
      
      // Account holders don't need unlockTime, PIN-based users do
      if (authToken && (isAccountAuth || unlockTime)) {
        setIsAuthenticated(true);
        // Redirect authenticated users to log-entry (one-time redirect)
        if (!hasRedirectedRef.current) {
          hasRedirectedRef.current = true;
          router.push(`/${familySlug}/log-entry`);
        }
      } else {
        setIsAuthenticated(false);
        hasRedirectedRef.current = false; // Reset if not authenticated
      }
      
      setIsCheckingAuth(false);
    };
    
    // Only check once when slug is validated, not continuously
    checkAuth();
  }, [slugValidated]); // Only depend on slugValidated to prevent loops

  // Check if family is inactive and redirect to root
  useEffect(() => {
    // Only check after slug is validated and family context has finished loading
    if (!slugValidated || familyLoading) return;
    
    if (family && family.isActive === false) {
      // Family exists but is inactive - redirect to root
      router.push('/');
    } else if (!family && familySlug) {
      // Family not found for the given slug - redirect to root
      router.push('/');
    }
  }, [family, familyLoading, familySlug, router, slugValidated]);

  // Handle successful authentication
  const handleUnlock = (caretakerId?: string) => {
    setIsAuthenticated(true);
    // Redirect to main app after successful authentication
    router.push(`/${familySlug}/log-entry`);
  };

  // Handle family selection change
  const handleFamilyChange = (value: string) => {
    const selectedFamily = families.find(f => f.slug === value);
    if (selectedFamily) {
      router.push(`/${selectedFamily.slug}`);
    }
  };

  // Show loading while validating slug or checking auth
  if (!slugValidated || isCheckingAuth) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-500">
            {!slugValidated ? 'Validating family...' : 'Checking authentication...'}
          </p>
        </div>
      </div>
    );
  }

  // If authenticated, layout will handle redirecting to log-entry
  // Show loading state briefly while layout processes the redirect
  if (isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show login UI
  return (
    <div className="flex flex-col items-center">
      {families.length > 1 && (
        <div className="w-full max-w-md mx-auto mb-4 p-4">
          <label className="block text-sm font-medium mb-2">Select Family</label>
          <Select
            value={familySlug || ''}
            onValueChange={handleFamilyChange}
            disabled={loading}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a family" />
            </SelectTrigger>
            <SelectContent>
              {families.map((f) => (
                <SelectItem key={f.id} value={f.slug}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      
      <LoginSecurity 
        onUnlock={handleUnlock} 
        familySlug={familySlug} 
        familyName={!familyLoading && family ? family.name : undefined} 
      />
    </div>
  );
}

export default function FamilySlugPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <FamilySlugPageContent />
    </Suspense>
  );
}
