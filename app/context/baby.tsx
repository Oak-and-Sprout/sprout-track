'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Baby } from '@prisma/client';

interface AccountStatus {
  accountId: string;
  email: string;
  firstName: string;
  lastName?: string;
  verified: boolean;
  hasFamily: boolean;
  familySlug?: string;
  familyName?: string;
}

interface BabyContextType {
  selectedBaby: Baby | null;
  setSelectedBaby: (baby: Baby | null) => void;
  sleepingBabies: Set<string>;
  setSleepingBabies: (babies: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  feedingBabies: Set<string>;
  setFeedingBabies: (babies: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  accountStatus: AccountStatus | null;
  isAccountAuth: boolean;
  isCheckingAccountStatus: boolean;
}

const BabyContext = createContext<BabyContextType>({
  selectedBaby: null,
  setSelectedBaby: () => {},
  sleepingBabies: new Set(),
  setSleepingBabies: () => {},
  feedingBabies: new Set(),
  setFeedingBabies: () => {},
  accountStatus: null,
  isAccountAuth: false,
  isCheckingAccountStatus: false,
});

interface BabyProviderProps {
  children: React.ReactNode;
}

export function BabyProvider({ children }: BabyProviderProps) {
  const [selectedBaby, setSelectedBaby] = useState<Baby | null>(null);
  const [sleepingBabies, setSleepingBabies] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sleepingBabies');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    }
    return new Set();
  });
  const [feedingBabies, setFeedingBabies] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('feedingBabies');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    }
    return new Set();
  });
  const [currentFamily, setCurrentFamily] = useState<{id: string, slug: string} | null>(null);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [isAccountAuth, setIsAccountAuth] = useState(false);
  const [isCheckingAccountStatus, setIsCheckingAccountStatus] = useState(false);

  // Helper function to check if user is authenticated with an account token
  const checkAccountAuth = (): boolean => {
    if (typeof window === 'undefined') return false;
    
    const authToken = localStorage.getItem('authToken');
    if (!authToken) return false;
    
    try {
      const base64Url = authToken.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      const decoded = JSON.parse(jsonPayload);
      return decoded.isAccountAuth === true;
    } catch (error) {
      console.error('Error checking account auth:', error);
      return false;
    }
  };

  // Helper function to fetch account status
  const fetchAccountStatus = async (): Promise<AccountStatus | null> => {
    if (typeof window === 'undefined') return null;
    
    const authToken = localStorage.getItem('authToken');
    if (!authToken) return null;
    
    try {
      setIsCheckingAccountStatus(true);
      const response = await fetch('/api/accounts/status', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          return data.data;
        }
      }
      return null;
    } catch (error) {
      console.error('Error fetching account status:', error);
      return null;
    } finally {
      setIsCheckingAccountStatus(false);
    }
  };

  // Helper function to get current family from URL, localStorage, or account status
  const getCurrentFamily = (): {id: string, slug: string} | null => {
    if (typeof window === 'undefined') return null;
    
    // Try to get family from URL first
    const pathname = window.location.pathname;
    const segments = pathname.split('/').filter(Boolean);
    const familySlug = segments.length > 0 ? segments[0] : null;
    
    if (familySlug) {
      // Try to get family info from localStorage (set by FamilyProvider)
      const savedFamily = localStorage.getItem('selectedFamily');
      if (savedFamily) {
        try {
          const family = JSON.parse(savedFamily);
          if (family.slug === familySlug) {
            return { id: family.id, slug: family.slug };
          }
        } catch (e) {
          console.error('Error parsing saved family:', e);
        }
      }
    }
    
    // If no family from URL/localStorage, check account status
    if (accountStatus?.hasFamily && accountStatus.familySlug) {
      // If we're on the coming-soon page or account pages and user has a family, 
      // we should redirect them to their family
      if (pathname === '/coming-soon' || pathname.startsWith('/account/')) {
        window.location.href = `/${accountStatus.familySlug}`;
        return null;
      }
      
      // For other cases, don't return account family unless URL matches
      return null;
    }
    
    return null;
  };

  // Helper function to get family-specific localStorage key
  const getFamilySpecificKey = (baseKey: string, familyId?: string): string => {
    if (familyId) {
      return `${baseKey}_${familyId}`;
    }
    return baseKey;
  };

  // Check account authentication status on mount and when auth token changes
  useEffect(() => {
    const checkAuth = async () => {
      const isAuth = checkAccountAuth();
      setIsAccountAuth(isAuth);
      
      if (isAuth) {
        const status = await fetchAccountStatus();
        setAccountStatus(status);
        
        // If user is verified but has no family, and they're not on the account setup page,
        // redirect them to family setup
        if (status?.verified && !status.hasFamily && typeof window !== 'undefined') {
          const pathname = window.location.pathname;
          if (pathname !== '/account/family-setup' && pathname !== '/coming-soon') {
            window.location.href = '/coming-soon';
          }
        }
      } else {
        setAccountStatus(null);
      }
    };
    
    checkAuth();
    
    // Also check when localStorage changes (for auth token updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'authToken') {
        checkAuth();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Load family-specific baby selection from localStorage
  useEffect(() => {
    const family = getCurrentFamily();
    
    // If family changed, clear current selection and load family-specific data
    if (family && (!currentFamily || currentFamily.id !== family.id)) {
      setCurrentFamily(family);
      
      // Load family-specific selected baby
      const familyBabyKey = getFamilySpecificKey('selectedBaby', family.id);
      const saved = localStorage.getItem(familyBabyKey);
      
      if (saved) {
        try {
          const baby = JSON.parse(saved);
          // Validate that the baby belongs to the current family
          if (baby.familyId === family.id) {
            setSelectedBaby(baby);
          } else {
            // Baby doesn't belong to current family, clear selection
            setSelectedBaby(null);
            localStorage.removeItem(familyBabyKey);
          }
        } catch (e) {
          console.error('Error parsing saved baby:', e);
          setSelectedBaby(null);
        }
      } else {
        setSelectedBaby(null);
      }
      
      // Load family-specific sleeping babies
      const familySleepingKey = getFamilySpecificKey('sleepingBabies', family.id);
      const savedSleeping = localStorage.getItem(familySleepingKey);
      if (savedSleeping) {
        try {
          setSleepingBabies(new Set(JSON.parse(savedSleeping)));
        } catch (e) {
          console.error('Error parsing saved sleeping babies:', e);
          setSleepingBabies(new Set());
        }
      } else {
        setSleepingBabies(new Set());
      }

      // Load family-specific feeding babies
      const familyFeedingKey = getFamilySpecificKey('feedingBabies', family.id);
      const savedFeeding = localStorage.getItem(familyFeedingKey);
      if (savedFeeding) {
        try {
          setFeedingBabies(new Set(JSON.parse(savedFeeding)));
        } catch (e) {
          console.error('Error parsing saved feeding babies:', e);
          setFeedingBabies(new Set());
        }
      } else {
        setFeedingBabies(new Set());
      }
    } else if (!family && currentFamily) {
      // No family context, clear everything
      setCurrentFamily(null);
      setSelectedBaby(null);
      setSleepingBabies(new Set());
      setFeedingBabies(new Set());
    }
  }, [currentFamily]);

  // Monitor for family changes via URL changes
  useEffect(() => {
    const handlePopState = () => {
      const family = getCurrentFamily();
      if (family && (!currentFamily || currentFamily.id !== family.id)) {
        // Trigger re-evaluation in next effect
        setCurrentFamily(family);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentFamily]);

  // Persist selected baby (family-specific)
  useEffect(() => {
    if (currentFamily?.id) {
      const familyBabyKey = getFamilySpecificKey('selectedBaby', currentFamily.id);
      
      if (selectedBaby) {
        // Only persist if baby belongs to current family
        if (selectedBaby.familyId === currentFamily.id) {
          localStorage.setItem(familyBabyKey, JSON.stringify(selectedBaby));
        }
      } else {
        localStorage.removeItem(familyBabyKey);
      }
    }
  }, [selectedBaby, currentFamily]);

  // Persist sleeping babies (family-specific)
  useEffect(() => {
    if (currentFamily?.id) {
      const familySleepingKey = getFamilySpecificKey('sleepingBabies', currentFamily.id);
      localStorage.setItem(familySleepingKey, JSON.stringify(Array.from(sleepingBabies)));
    }
  }, [sleepingBabies, currentFamily]);

  // Persist feeding babies (family-specific)
  useEffect(() => {
    if (currentFamily?.id) {
      const familyFeedingKey = getFamilySpecificKey('feedingBabies', currentFamily.id);
      localStorage.setItem(familyFeedingKey, JSON.stringify(Array.from(feedingBabies)));
    }
  }, [feedingBabies, currentFamily]);

  // Update URL when selected baby changes
  useEffect(() => {
    if (selectedBaby) {
      const url = new URL(window.location.href);
      url.searchParams.set('babyId', selectedBaby.id);
      window.history.replaceState({}, '', url.toString());
    }
  }, [selectedBaby]);

  // Enhanced setSelectedBaby function that validates family membership
  const setSelectedBabyWithValidation = (baby: Baby | null) => {
    if (baby && currentFamily?.id && baby.familyId !== currentFamily.id) {
      // Baby doesn't belong to current family, don't select it
      console.warn('Attempted to select baby from different family:', baby.familyId, 'vs', currentFamily.id);
      return;
    }
    setSelectedBaby(baby);
  };

  return (
    <BabyContext.Provider value={{
      selectedBaby,
      setSelectedBaby: setSelectedBabyWithValidation,
      sleepingBabies,
      setSleepingBabies,
      feedingBabies,
      setFeedingBabies,
      accountStatus,
      isAccountAuth,
      isCheckingAccountStatus
    }}>
      {children}
    </BabyContext.Provider>
  );
}

export function useBaby() {
  const context = useContext(BabyContext);
  if (!context) {
    throw new Error('useBaby must be used within a BabyProvider');
  }
  return context;
}
