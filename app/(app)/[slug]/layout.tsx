'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { BabyProvider, useBaby } from '../../context/baby';
import { TimezoneProvider } from '../../context/timezone';
import { DeploymentProvider, useDeployment } from '../../context/deployment';
import { ThemeProvider } from '@/src/context/theme';
import { FamilyProvider, useFamily } from '@/src/context/family';
import Image from 'next/image';
import '../../globals.css';
import SettingsForm from '@/src/components/forms/SettingsForm';
import { DebugSessionTimer } from '@/src/components/debugSessionTimer';
import { TimezoneDebug } from '@/src/components/debugTimezone';
import { SideNav, SideNavTrigger } from '@/src/components/ui/side-nav';
import { Inter as FontSans } from 'next/font/google';
import { cn } from '@/src/lib/utils';
import { Baby } from '@prisma/client';
import BabySelector from '@/src/components/BabySelector';
import BabyQuickInfo from '@/src/components/BabyQuickInfo';
import SetupWizard from '@/src/components/SetupWizard';
import { DynamicTitle } from '@/src/components/ui/dynamic-title';

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans',
});

function AppContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const { family } = useFamily();
  const { selectedBaby, setSelectedBaby, sleepingBabies } = useBaby();
  const { isSaasMode } = useDeployment();
  const [mounted, setMounted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickStatsOpen, setQuickStatsOpen] = useState(false);
  const [sideNavOpen, setSideNavOpen] = useState(false);
  const [isWideScreen, setIsWideScreen] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [babies, setBabies] = useState<Baby[]>([]);
  const [showSetup, setShowSetup] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(() => {
    // Only run this on client-side
    if (typeof window !== 'undefined') {
      const unlockTime = localStorage.getItem('unlockTime');
      if (unlockTime && Date.now() - parseInt(unlockTime) <= 60 * 1000) {
        return true;
      }
    }
    return false;
  });
  
  const [caretakerName, setCaretakerName] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const familySlug = params?.slug as string;

  // Function to calculate baby's age
  const calculateAge = (birthday: Date) => {
    const today = new Date();
    const birthDate = new Date(birthday);
    
    const ageInWeeks = Math.floor((today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
    const ageInMonths = Math.floor((today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
    const ageInYears = Math.floor((today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    
    if (ageInMonths < 6) {
      return `${ageInWeeks} weeks`;
    } else if (ageInMonths < 24) {
      return `${ageInMonths} months`;
    } else {
      return `${ageInYears} ${ageInYears === 1 ? 'year' : 'years'}`;
    }
  };

  const fetchData = async () => {
    try {
      // Get auth token once for all requests
      const authToken = localStorage.getItem('authToken');
      let isSysAdmin = false;
      
      // Check if user is system administrator
      if (authToken) {
        try {
          const payload = authToken.split('.')[1];
          const decodedPayload = JSON.parse(atob(payload));
          isSysAdmin = decodedPayload.isSysAdmin || false;
        } catch (error) {
          console.error('Error parsing JWT token:', error);
        }
      }
      
      // Fetch settings
      let settingsUrl = '/api/settings';
      if (isSysAdmin && family?.id) {
        settingsUrl += `?familyId=${family.id}`;
      }
      
      const settingsResponse = await fetch(settingsUrl, {
        headers: authToken ? {
          'Authorization': `Bearer ${authToken}`
        } : {}
      });
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        if (settingsData.success && settingsData.data.familyName) {
          setFamilyName(settingsData.data.familyName);
        }
      }
      
      // Fetch caretaker information if authenticated via PIN, or extract from JWT if account
      let accountUserInfo = null;
      if (authToken) {
        try {
          const payload = authToken.split('.')[1];
          const decodedPayload = JSON.parse(atob(payload));
          if (decodedPayload.isAccountAuth) {
            accountUserInfo = {
              name: decodedPayload.name,
              isAccountAuth: true
            };
            setCaretakerName(decodedPayload.name);
            // Account holders are always admins of their family
            setIsAdmin(true);
          }
        } catch (error) {
          console.error('Error parsing JWT token for user info:', error);
        }
      }
      
      // Only fetch caretaker info if not an account holder
      if (!accountUserInfo) {
        const caretakerId = localStorage.getItem('caretakerId');
        if (caretakerId) {
          const caretakerResponse = await fetch(`/api/caretaker?id=${caretakerId}`);
          if (caretakerResponse.ok) {
            const caretakerData = await caretakerResponse.json();
            if (caretakerData.success && caretakerData.data) {
              setCaretakerName(caretakerData.data.name);
            }
          }
        }
      }

      // Fetch babies - the API will automatically filter by family ID from JWT token
      let babiesUrl = '/api/baby';
      if (isSysAdmin && family?.id) {
        babiesUrl += `?familyId=${family.id}`;
      }
      
      const babiesResponse = await fetch(babiesUrl, {
        headers: authToken ? {
          'Authorization': `Bearer ${authToken}`
        } : {}
      });
      if (babiesResponse.ok) {
        const babiesData = await babiesResponse.json();
        if (babiesData.success) {
          const activeBabies = babiesData.data.filter((baby: Baby) => !baby.inactive);
          setBabies(activeBabies);
          
          // Check if we need to show setup
          setShowSetup(activeBabies.length === 0);
          
          // Get selected baby from URL or select first baby if only one exists
          const urlParams = new URLSearchParams(window.location.search);
          const babyId = urlParams.get('babyId');
          
          // If current selected baby is inactive, clear selection
          const foundBaby = activeBabies.find((b: Baby) => b.id === babyId);
          if (foundBaby) {
            setSelectedBaby(foundBaby);
          } else if (activeBabies.length === 1) {
            setSelectedBaby(activeBabies[0]);
          } else {
            setSelectedBaby(null);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  // Update unlock timer on any activity
  const updateUnlockTimer = () => {
    const unlockTime = localStorage.getItem('unlockTime');
    if (unlockTime) {
      localStorage.setItem('unlockTime', Date.now().toString());
    }
  };
  
  const handleUnlock = (caretakerId?: string) => {
    setIsUnlocked(true);
    fetchData();
    
    // Dispatch a custom event to notify components about caretaker change
    if (caretakerId) {
      const caretakerChangedEvent = new CustomEvent('caretakerChanged', {
        detail: { caretakerId }
      });
      window.dispatchEvent(caretakerChangedEvent);
    }
  };
  
  const handleLogout = async () => {
    // Get the token to invalidate it server-side
    const token = localStorage.getItem('authToken');
    const currentCaretakerId = localStorage.getItem('caretakerId');
    
    // Check if this is an account holder
    let isAccountAuth = false;
    if (token) {
      try {
        const payload = token.split('.')[1];
        const decodedPayload = JSON.parse(atob(payload));
        isAccountAuth = decodedPayload.isAccountAuth || false;
      } catch (error) {
        console.error('Error parsing JWT token during logout:', error);
      }
    }
    
    // Call the logout API to clear server-side cookies and invalidate the token
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });
    } catch (error) {
      console.error('Error during logout:', error);
    }
    
    // Clear all client-side authentication data including JWT token
    localStorage.removeItem('unlockTime');
    localStorage.removeItem('caretakerId');
    localStorage.removeItem('authToken');
    localStorage.removeItem('accountUser'); // Clear account user info
    localStorage.removeItem('attempts');
    localStorage.removeItem('lockoutTime');
    
    // Dispatch a custom event to notify components about caretaker change
    if (currentCaretakerId) {
      const caretakerChangedEvent = new CustomEvent('caretakerChanged', {
        detail: { caretakerId: null }
      });
      window.dispatchEvent(caretakerChangedEvent);
    }
    
    // Reset state
    setIsUnlocked(false);
    setCaretakerName('');
    setIsAdmin(false);
    setSideNavOpen(false);
    
    // Clear baby selection
    setSelectedBaby(null);
    setBabies([]);
    
    // Account holders go to home page, PIN users go to family login
    if (isAccountAuth) {
      router.push('/');
    } else if (familySlug) {
      router.push(`/${familySlug}/login`);
    } else {
      router.push('/login');
    }
  };


  // Check if screen is wider than 600px
  const checkScreenWidth = useCallback(() => {
    if (typeof window !== 'undefined') {
      const isWide = window.innerWidth > 600;
      setIsWideScreen(isWide);
      
      // Automatically open side nav on wide screens, hide on small screens
      setSideNavOpen(isWide);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    
    // Fetch data only once on mount
    fetchData();
    
    // Check screen width initially
    checkScreenWidth();

    // Add listeners for user activity
    window.addEventListener('click', updateUnlockTimer);
    window.addEventListener('keydown', updateUnlockTimer);
    window.addEventListener('mousemove', updateUnlockTimer);
    window.addEventListener('touchstart', updateUnlockTimer);
    
    // Add resize listener
    window.addEventListener('resize', checkScreenWidth);

    return () => {
      // Clean up event listeners
      window.removeEventListener('click', updateUnlockTimer);
      window.removeEventListener('keydown', updateUnlockTimer);
      window.removeEventListener('mousemove', updateUnlockTimer);
      window.removeEventListener('touchstart', updateUnlockTimer);
      window.removeEventListener('resize', checkScreenWidth);
    };
  }, [checkScreenWidth]); // Remove fetchData from dependencies to prevent infinite loop

  // Watch for family changes and refetch data
  useEffect(() => {
    if (family?.id) {
      fetchData();
    }
  }, [family?.id]);
  
  // Validate family slug exists
  const validateFamilySlug = useCallback(async (slug: string) => {
    try {
      const response = await fetch(`/api/family/by-slug/${encodeURIComponent(slug)}`);
      const data = await response.json();
      
      // If family doesn't exist, redirect to home
      if (!data.success || !data.data) {
        console.log(`Family slug "${slug}" not found, redirecting to home...`);
        router.push('/');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error validating family slug:', error);
      // On error, redirect to home to be safe
      router.push('/');
      return false;
    }
  }, [router]);

  // Validate family slug on mount
  useEffect(() => {
    if (!mounted || !familySlug) return;
    
    validateFamilySlug(familySlug);
  }, [mounted, familySlug, validateFamilySlug]);

  // Add continuous authentication check and redirect
  useEffect(() => {
    if (!mounted) return;
    
    // Function to check authentication status
    const checkAuthStatus = () => {
      const authToken = localStorage.getItem('authToken');
      const unlockTime = localStorage.getItem('unlockTime');
      
      // Check if user is authenticated via account
      let isAccountAuth = false;
      if (authToken) {
        try {
          const payload = authToken.split('.')[1];
          const decodedPayload = JSON.parse(atob(payload));
          isAccountAuth = decodedPayload.isAccountAuth || false;
        } catch (error) {
          console.error('Error parsing JWT token for account auth check:', error);
        }
      }
      
      // Account holders don't need unlockTime, PIN-based users do
      if (!authToken || (!isAccountAuth && !unlockTime)) {
        if (familySlug) {
          router.push(`/${familySlug}/login`);
        } else {
          router.push('/login');
        }
        return;
      }
      
      // Check if JWT token has expired and validate family access
      try {
        // JWT tokens are in format: header.payload.signature
        // We need the payload part (index 1)
        const payload = authToken.split('.')[1];
        // The payload is base64 encoded, so we need to decode it
        const decodedPayload = JSON.parse(atob(payload));
        
        // Check if token has expired
        if (decodedPayload.exp && decodedPayload.exp * 1000 < Date.now()) {
          console.log('JWT token has expired, logging out...');
          handleLogout();
          return;
        }
        
        // Check if user's family slug matches the current URL slug
        if (decodedPayload.familySlug && familySlug && decodedPayload.familySlug !== familySlug) {
          console.log('User trying to access different family. Redirecting to correct family...');
          // Redirect to the user's actual family
          const currentPath = pathname?.split('/').slice(2).join('/') || 'log-entry'; // Remove family slug from path
          router.push(`/${decodedPayload.familySlug}/${currentPath}`);
          return;
        }
        
      } catch (error) {
        console.error('Error parsing JWT token:', error);
        handleLogout();
        return;
      }
      
      // Check if user is on the family root page and redirect to log-entry
      if (pathname === `/${familySlug}` || pathname === `/${familySlug}/`) {
        console.log('User on family root, redirecting to log-entry...');
        router.push(`/${familySlug}/log-entry`);
        return;
      }
      
      // Check for idle timeout (separate from token expiration)
      if (unlockTime) {
        const lastActivity = parseInt(unlockTime);
        const idleTimeSeconds = parseInt(localStorage.getItem('idleTimeSeconds') || '1800', 10);
        if (Date.now() - lastActivity > idleTimeSeconds * 1000) {
          // Session expired due to inactivity, redirect to login
          console.log('Session expired due to inactivity, logging out...');
          handleLogout();
        }
      }
    };
    
    // Initial check
    checkAuthStatus();
    
    // Set up continuous checking every second
    const authCheckInterval = setInterval(checkAuthStatus, 1000);
    
    return () => {
      clearInterval(authCheckInterval);
    };
  }, [mounted, router, handleLogout, familySlug, pathname]);


  // Check unlock status based on JWT token and extract user info
  useEffect(() => {
    const checkUnlockStatus = () => {
      const authToken = localStorage.getItem('authToken');
      const unlockTime = localStorage.getItem('unlockTime');
      
      // Check if user is authenticated via account
      let isAccountAuth = false;
      if (authToken) {
        try {
          const payload = authToken.split('.')[1];
          const decodedPayload = JSON.parse(atob(payload));
          isAccountAuth = decodedPayload.isAccountAuth || false;
        } catch (error) {
          console.error('Error parsing JWT token for unlock status:', error);
        }
      }
      
      // Account holders are automatically unlocked, PIN-based users need unlockTime
      const newUnlockState = !!(authToken && (isAccountAuth || unlockTime));
      setIsUnlocked(newUnlockState);
      
      // Extract user information from JWT token
      if (authToken) {
        try {
          // JWT tokens are in format: header.payload.signature
          // We need the payload part (index 1)
          const payload = authToken.split('.')[1];
          // The payload is base64 encoded, so we need to decode it
          const decodedPayload = JSON.parse(atob(payload));
          
          // Set caretaker name and admin status from token
          if (decodedPayload.name) {
            setCaretakerName(decodedPayload.name);
            // Account holders are always admins of their family, plus system admins
            const isAccountAdmin = decodedPayload.isAccountAuth && decodedPayload.role === 'OWNER';
            const isRegularAdmin = decodedPayload.role === 'ADMIN';
            const isSysAdmin = decodedPayload.isSysAdmin === true;
            setIsAdmin(isAccountAdmin || isRegularAdmin || isSysAdmin);
          }
        } catch (error) {
          console.error('Error parsing JWT token:', error);
        }
      }
    };

    // Check immediately on mount
    checkUnlockStatus();

    // Then check every second
    const interval = setInterval(checkUnlockStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  // Helper function to add family slug to paths
  const withFamilySlug = (path: string) => {
    if (!familySlug) return path;
    
    // If path starts with /, remove it
    if (path.startsWith('/')) {
      path = path.substring(1);
    }
    
    // If path already includes the family slug, return as is
    if (path.startsWith(`${familySlug}/`)) {
      return `/${path}`;
    }
    
    return `/${familySlug}/${path}`;
  };

  return (
    <>
      {(isUnlocked || process.env.NODE_ENV === 'development') && (
        <div className="min-h-screen flex">
          {/* Side Navigation - non-modal on wide screens */}
          {isWideScreen && (
            <SideNav
              isOpen={true}
              nonModal={true}
              onClose={() => {}}
              currentPath={window.location.pathname}
              onNavigate={(path) => {
                // Add family slug to navigation paths
                router.push(withFamilySlug(path));
              }}
              onSettingsClick={() => {
                setSettingsOpen(true);
              }}
              onLogout={handleLogout}
              isAdmin={isAdmin}
              className="h-screen sticky top-0"
              familySlug={familySlug}
              familyName={family?.name || familyName}
            />
          )}
          
          {/* Main content area */}
          <div className={`flex flex-col flex-1 min-h-screen ${isWideScreen ? 'w-[calc(100%-16rem)]' : 'w-full'}`}>
            <header className="w-full bg-gradient-to-r from-teal-600 to-teal-700 sticky top-0 z-40">
              <div className="mx-auto py-2">
                <div className="flex justify-between items-center h-16"> {/* Fixed height for consistency */}
                  <div className={`flex items-center ${isWideScreen ? 'ml-8' : 'ml-4 sm:ml-6 lg:ml-8'}`}>
                    {/* Only show Sprout button on small screens */}
                    {!isWideScreen ? (
                      <SideNavTrigger
                        onClick={() => setSideNavOpen(true)}
                        isOpen={sideNavOpen}
                        className="w-16 h-16 flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-110 mr-4"
                      >
                        <Image
                          src="/sprout-128.png"
                          alt="Sprout Logo"
                          width={64}
                          height={64}
                          className="object-contain"
                          priority
                        />
                      </SideNavTrigger>
                    ) : null}
                    <div className="flex flex-col">
                      {caretakerName && caretakerName !== 'system' && (
                        <span className="text-white text-xs opacity-80">
                          Hi, {caretakerName}
                        </span>
                      )}
                      <span className="text-white text-sm font-medium">
                        {family?.name || familyName} - {pathname?.includes('/log-entry') 
                          ? 'Log Entry' 
                          : pathname?.includes('/calendar')
                          ? 'Calendar'
                          : 'Full Log'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center mr-4 sm:mr-6 lg:mr-8">
                    {babies.length > 0 && (
                      <BabySelector
                        selectedBaby={selectedBaby}
                        onBabySelect={(baby) => setSelectedBaby(baby)}
                        babies={babies}
                        sleepingBabies={sleepingBabies}
                        calculateAge={calculateAge}
                        onOpenQuickStats={() => setQuickStatsOpen(true)}
                      />
                    )}
                  </div>
                </div>
              </div>
            </header>
            
            <main className="flex-1 relative z-0">
              {showSetup ? (
                <SetupWizard onComplete={fetchData} />
              ) : (
                children
              )}
            </main>
          </div>

          {/* Modal Side Navigation - only for small screens */}
          {!isWideScreen && (
            <SideNav
              isOpen={sideNavOpen}
              onClose={() => setSideNavOpen(false)}
              currentPath={window.location.pathname}
              onNavigate={(path) => {
                // Add family slug to navigation paths
                router.push(withFamilySlug(path));
                setSideNavOpen(false);
              }}
              onSettingsClick={() => {
                setSettingsOpen(true);
                setSideNavOpen(false);
              }}
              onLogout={handleLogout}
              isAdmin={isAdmin}
              familySlug={familySlug}
              familyName={family?.name || familyName}
            />
          )}
        </div>
      )}

      <SettingsForm
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onBabySelect={(id: string) => {
          const baby = babies.find((b: Baby) => b.id === id);
          if (baby) {
            setSelectedBaby(baby);
          }
        }}
        onBabyStatusChange={fetchData}
        selectedBabyId={selectedBaby?.id || ''}
        familyId={family?.id}
      />
      
      {/* Baby Quick Info Form */}
      <BabyQuickInfo
        isOpen={quickStatsOpen}
        onClose={() => setQuickStatsOpen(false)}
        selectedBaby={selectedBaby}
        calculateAge={calculateAge}
      />
      
      {/* Debug components - only visible in development mode */}
      <DebugSessionTimer />
      <TimezoneDebug />
    </>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Define handleLogout function within the layout scope
  const handleLogout = async () => {
    // Get the token to invalidate it server-side
    const token = localStorage.getItem('authToken');
    const currentCaretakerId = localStorage.getItem('caretakerId');

    // Check if this is an account holder
    let isAccountAuth = false;
    if (token) {
      try {
        const payload = token.split('.')[1];
        const decodedPayload = JSON.parse(atob(payload));
        isAccountAuth = decodedPayload.isAccountAuth || false;
      } catch (error) {
        console.error('Error parsing JWT token during logout:', error);
      }
    }

    // Call the logout API to clear server-side cookies and invalidate the token
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });
    } catch (error) {
      console.error('Error during logout:', error);
    }

    // Clear all client-side authentication data including JWT token
    localStorage.removeItem('unlockTime');
    localStorage.removeItem('caretakerId');
    localStorage.removeItem('authToken');
    localStorage.removeItem('accountUser'); // Clear account user info
    localStorage.removeItem('attempts');
    localStorage.removeItem('lockoutTime');

    // Dispatch a custom event to notify components about caretaker change
    if (currentCaretakerId) {
      const caretakerChangedEvent = new CustomEvent('caretakerChanged', {
        detail: { caretakerId: null }
      });
      window.dispatchEvent(caretakerChangedEvent);
    }

    // Redirect to home page for account holders or family login for PIN users
    if (isAccountAuth) {
      window.location.href = '/';
    } else {
      const familySlug = window.location.pathname.split('/')[1];
      if (familySlug) {
        window.location.href = `/${familySlug}/login`;
      } else {
        window.location.href = '/login';
      }
    }
  };

  return (
    <DeploymentProvider>
      <FamilyProvider onLogout={handleLogout}>
        <BabyProvider>
          <TimezoneProvider>
            <ThemeProvider>
              <DynamicTitle />
              <AppContent>{children}</AppContent>
            </ThemeProvider>
          </TimezoneProvider>
        </BabyProvider>
      </FamilyProvider>
    </DeploymentProvider>
  );
}
