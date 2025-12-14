'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useDeployment } from '../../app/context/deployment';

interface Family {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

interface FamilyContextType {
  family: Family | null;
  loading: boolean;
  error: string | null;
  setFamily: (family: Family) => void;
  families: Family[];
  loadFamilies: () => Promise<void>;
  handleLogout?: () => void;
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const FamilyContext = createContext<FamilyContextType | undefined>(undefined);

export function FamilyProvider({ children, onLogout }: { children: ReactNode; onLogout?: () => void }) {
  const [family, setFamily] = useState<Family | null>(() => {
    // Try to get from localStorage first for persistence
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedFamily');
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();
  const { isSaasMode } = useDeployment();

  // Extract family slug from URL
  const getFamilySlugFromUrl = () => {
    if (!pathname) return null;
    const segments = pathname.split('/').filter(Boolean);
    return segments.length > 0 ? segments[0] : null;
  };

  // Persist selected family
  useEffect(() => {
    if (family) {
      localStorage.setItem('selectedFamily', JSON.stringify(family));
    }
  }, [family]);

  // Load family data based on slug in URL or system admin context
  useEffect(() => {
    const loadFamilyFromUrl = async () => {
      const slug = getFamilySlugFromUrl();
      if (!slug) {
        setLoading(false);
        return;
      }

      try {
        // Check if user is a system administrator
        const authToken = localStorage.getItem('authToken');
        let isSysAdmin = false;
        
        if (authToken) {
          try {
            const payload = authToken.split('.')[1];
            const decodedPayload = JSON.parse(atob(payload));
            isSysAdmin = decodedPayload.isSysAdmin || false;
          } catch (error) {
            console.error('Error parsing JWT token in family context:', error);
          }
        }

        // For system administrators, we need to load family by slug since they don't have a fixed familyId
        // For regular users, this also works as expected
        const response = await fetch(`/api/family/by-slug/${slug}`, {
          headers: authToken ? {
            'Authorization': `Bearer ${authToken}`
          } : {}
        });
        
        if (!response.ok) {
          throw new Error('Failed to load family data');
        }
        
        const data = await response.json();
        if (data.success && data.data) {
          setFamily(data.data);
          
          // For system administrators, store the family context so APIs can use it
          if (isSysAdmin && typeof window !== 'undefined') {
            // Store the current family context for the session
            sessionStorage.setItem('sysadmin-family-context', JSON.stringify(data.data));
          }
        } else {
          setError(data.error || 'Failed to load family data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    loadFamilyFromUrl();
  }, [pathname]);

  // Load all available families
  const loadFamilies = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/family/list');
      if (!response.ok) {
        throw new Error('Failed to load families');
      }

      const data = await response.json();
      if (data.success && data.data) {
        setFamilies(data.data);
      } else {
        setError(data.error || 'Failed to load families');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Function to check if account has expired in SAAS mode (checks JWT token in memory)
  const checkAccountExpiration = useCallback(() => {
    // Only check if we have a family and are in client environment
    if (typeof window === 'undefined' || !family?.slug) return;

    try {
      const authToken = localStorage.getItem('authToken');
      if (!authToken) return;

      // Only check expiration in SAAS mode
      if (!isSaasMode) return;

      // Decode JWT token to get account info
      let decodedPayload;
      try {
        const payload = authToken.split('.')[1];
        decodedPayload = JSON.parse(atob(payload));
      } catch (error) {
        console.error('Error parsing JWT token for expiration check:', error);
        return;
      }

      // Only check expiration for account-based auth
      if (!decodedPayload.isAccountAuth) return;

      // Skip check for beta participants (from JWT token)
      if (decodedPayload.betaparticipant) return;

      // Check if account/trial is expired based on JWT token data
      const now = new Date();
      let isExpired = false;

      if (decodedPayload.trialEnds) {
        const trialEndDate = new Date(decodedPayload.trialEnds);
        isExpired = now > trialEndDate;
      } else if (decodedPayload.planExpires) {
        const planEndDate = new Date(decodedPayload.planExpires);
        isExpired = now > planEndDate;
      } else if (!decodedPayload.planType && !decodedPayload.betaparticipant) {
        // No trial, no plan, and not beta - expired
        isExpired = true;
      }

      if (isExpired) {
        console.log('Account expired (from JWT token) - soft expiration: user remains logged in with read-only access');
        // SOFT EXPIRATION: Do NOT log out expired accounts
        // They should remain logged in with read-only access
        // The backend will block write operations via writeProtection middleware
        // The UI will show expiration banners and upgrade prompts
      }
    } catch (error) {
      console.error('Error checking account expiration:', error);
    }
  }, [family?.slug, onLogout, isSaasMode]);

  // Set up periodic account expiration checking
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Initial check
    checkAccountExpiration();

    // Check every 30 seconds
    const expirationCheckInterval = setInterval(checkAccountExpiration, 30000);

    return () => {
      clearInterval(expirationCheckInterval);
    };
  }, [checkAccountExpiration]);

  // Set up global fetch interceptor to add Authorization header and handle 401
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Store the original fetch function
    const originalFetch = window.fetch;

    // Override fetch to automatically add Authorization header and intercept 401 responses
    window.fetch = async (...args) => {
      try {
        // Get auth token from localStorage
        const authToken = localStorage.getItem('authToken');

        // Only add Authorization header for API calls to our own backend
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url;
        // Ensure url is a string before calling string methods
        const isApiCall = url && typeof url === 'string' && (url.startsWith('/api') || url.includes('/api/'));

        // If this is an API call and we have a token, add the Authorization header
        if (isApiCall && authToken) {
          const options = args[1] || {};
          const headers = new Headers(options.headers || {});

          // Only add header if not already present
          if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${authToken}`);
          }

          // Update the request with the new headers
          args[1] = {
            ...options,
            headers
          };
        }

        const response = await originalFetch(...args);

        // If we get a 401 Unauthorized, trigger logout
        // BUT: Don't trigger logout if we're on the root slug page (login page)
        // The login page expects 401s and handles authentication
        if (response.status === 401) {
          // Check if we're on a root slug page (login page)
          const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
          const pathSegments = currentPath.split('/').filter(Boolean);
          const isRootSlugPage = pathSegments.length === 1; // e.g., /goober-family
          
          // Only trigger logout if NOT on root slug page (login page)
          if (!isRootSlugPage && onLogout) {
            // Trigger logout after a short delay to avoid interfering with the current call stack
            setTimeout(() => {
              if (onLogout) {
                onLogout();
              }
            }, 100);
          }
        }

        return response;
      } catch (error) {
        throw error;
      }
    };

    // Restore original fetch on cleanup
    return () => {
      window.fetch = originalFetch;
    };
  }, [onLogout]);

  // Authenticated fetch wrapper that automatically handles 401 responses
  const authenticatedFetch = useCallback(async (url: string, options?: RequestInit): Promise<Response> => {
    // Get auth token from localStorage
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

    // Merge authorization header with provided options
    const headers = new Headers(options?.headers || {});
    if (authToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${authToken}`);
    }

    const mergedOptions: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, mergedOptions);

      // If we get a 401 Unauthorized, trigger logout
      if (response.status === 401) {
        // Trigger logout after a short delay to avoid interfering with the current call stack
        if (onLogout) {
          setTimeout(() => {
            if (onLogout) {
              onLogout();
            }
          }, 100);
        }
      }

      return response;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }, [onLogout]);

  const value = {
    family,
    loading,
    error,
    setFamily,
    families,
    loadFamilies,
    handleLogout: onLogout,
    authenticatedFetch,
  };

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily() {
  const context = useContext(FamilyContext);
  if (context === undefined) {
    throw new Error('useFamily must be used within a FamilyProvider');
  }
  return context;
}
