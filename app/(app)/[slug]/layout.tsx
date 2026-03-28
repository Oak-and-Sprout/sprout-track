'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { BabyProvider, useBaby } from '../../context/baby';
import { TimezoneProvider } from '../../context/timezone';
import { DeploymentProvider, useDeployment } from '../../context/deployment';
import { LocalizationProvider } from '@/src/context/localization';
import { ThemeProvider } from '@/src/context/theme';
import { FamilyProvider, useFamily } from '@/src/context/family';
import { useLocalization } from '@/src/context/localization';
import { ToastProvider } from '@/src/components/ui/toast';
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
// SetupWizard moved to dedicated /{slug}/resume-setup route
import { DynamicTitle } from '@/src/components/ui/dynamic-title';
import { AccountButton } from '@/src/components/ui/account-button';
import AccountManager from '@/src/components/account-manager';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import AccountExpirationBanner from '@/src/components/ui/account-expiration-banner';
import NotificationSplashModal from '@/src/components/modals/NotificationSplashModal';
import { checkPushSupport, checkSubscriptionStatus } from '@/src/lib/notifications/client';

// Lazy load PaymentModal to prevent Stripe initialization in self-hosted mode
const PaymentModal = dynamic(
  () => import('@/src/components/account-manager/PaymentModal'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
      </div>
    )
  }
);

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
  const { isSaasMode, notificationsEnabled } = useDeployment();
  const { t } = useLocalization();
  const [mounted, setMounted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickStatsOpen, setQuickStatsOpen] = useState(false);
  const [sideNavOpen, setSideNavOpen] = useState(false);
  const [isWideScreen, setIsWideScreen] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [babies, setBabies] = useState<Baby[]>([]);
  const [showSetup] = useState(false); // Kept for layout compatibility; setup now uses dedicated route
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
  const [showAccountManager, setShowAccountManager] = useState(false);
  const [isAccountAuth, setIsAccountAuth] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showNotificationSplash, setShowNotificationSplash] = useState(false);
  const [paymentAccountStatus, setPaymentAccountStatus] = useState<any>(null);
  const familySlug = params?.slug as string;
  const isRefreshingRef = useRef(false);

  // Refresh the access token using the HTTP-only refresh token cookie
  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    if (isRefreshingRef.current) return false;
    isRefreshingRef.current = true;

    try {
      const response = await fetch('/api/auth/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.token) {
          localStorage.setItem('authToken', data.data.token);
          // Reset unlock time for PIN-based users
          if (localStorage.getItem('unlockTime')) {
            localStorage.setItem('unlockTime', Date.now().toString());
          }
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      return false;
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

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
            setIsAccountAuth(true);
            // Account holders are always admins of their family
            setIsAdmin(true);
          } else {
            setIsAccountAuth(false);
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
          
          // If no active babies, check setup status and redirect accordingly
          if (activeBabies.length === 0) {
            try {
              const setupUrl = isSysAdmin && family?.id
                ? `/api/family/setup-status?familyId=${family.id}`
                : '/api/family/setup-status';
              const setupResponse = await fetch(setupUrl, {
                headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
              });
              if (setupResponse.ok) {
                const setupData = await setupResponse.json();
                if (setupData.success && setupData.data.setupStage < 3) {
                  if (setupData.data.canSetup) {
                    router.push(`/${familySlug}/resume-setup`);
                    return;
                  } else {
                    router.push('/');
                    return;
                  }
                }
              }
            } catch (e) {
              console.error('Error checking setup status:', e);
            }
          }
          
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
    
    // Account holders go to home page, PIN users go to family root (which shows login UI)
    if (isAccountAuth) {
      router.push('/');
    } else if (familySlug) {
      router.push(`/${familySlug}`);
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
    
    // Check if we're on root slug page - if so, don't fetch data (page handles login)
    const isRootSlugPage = pathname === `/${familySlug}` || pathname === `/${familySlug}/`;
    const authToken = localStorage.getItem('authToken');
    const unlockTime = localStorage.getItem('unlockTime');
    
    // Check if user is authenticated via account or is a system admin
    let isAccountAuth = false;
    let isSysAdmin = false;
    if (authToken) {
      try {
        const payload = authToken.split('.')[1];
        const decodedPayload = JSON.parse(atob(payload));
        isAccountAuth = decodedPayload.isAccountAuth || false;
        isSysAdmin = decodedPayload.isSysAdmin || false;
      } catch (error) {
        // Ignore parsing errors
      }
    }

    const isAuthenticated = authToken && (isAccountAuth || isSysAdmin || unlockTime);

    // Only fetch data if authenticated or not on root slug page
    // Root slug page handles its own data fetching for login
    if (!isRootSlugPage || isAuthenticated) {
      fetchData();
    }
    
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

  // Watch for family changes and refetch data (only if authenticated and not on root slug page)
  useEffect(() => {
    const isRootSlugPage = pathname === `/${familySlug}` || pathname === `/${familySlug}/`;
    const authToken = localStorage.getItem('authToken');
    const unlockTime = localStorage.getItem('unlockTime');

    let isAccountAuth = false;
    let isSysAdmin = false;
    if (authToken) {
      try {
        const payload = authToken.split('.')[1];
        const decodedPayload = JSON.parse(atob(payload));
        isAccountAuth = decodedPayload.isAccountAuth || false;
        isSysAdmin = decodedPayload.isSysAdmin || false;
      } catch (error) {
        // Ignore parsing errors
      }
    }

    const isAuthenticated = authToken && (isAccountAuth || isSysAdmin || unlockTime);

    if (family?.id && (!isRootSlugPage || isAuthenticated)) {
      fetchData();
    }
  }, [family?.id, pathname, familySlug]);
  
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
    
    // Skip auth check entirely if we're on root slug page (page component handles login UI)
    const isRootSlugPage = pathname === `/${familySlug}` || pathname === `/${familySlug}/`;
    
    // Function to check authentication status
    const checkAuthStatus = () => {
      // If on root slug page, skip auth checks - page component handles it
      if (isRootSlugPage) {
        return;
      }
      
      const authToken = localStorage.getItem('authToken');
      const unlockTime = localStorage.getItem('unlockTime');

      // Check if user is authenticated via account or is a system admin
      let isAccountAuth = false;
      let isSysAdmin = false;
      if (authToken) {
        try {
          const payload = authToken.split('.')[1];
          const decodedPayload = JSON.parse(atob(payload));
          isAccountAuth = decodedPayload.isAccountAuth || false;
          isSysAdmin = decodedPayload.isSysAdmin || false;
        } catch (error) {
          console.error('Error parsing JWT token for account auth check:', error);
        }
      }

      // Account holders and system admins don't need unlockTime, PIN-based users do
      // If not authenticated and on a sub-route, redirect to root slug page
      if (!authToken || (!isAccountAuth && !isSysAdmin && !unlockTime)) {
        // If we're on a sub-route, redirect to root slug page to show login
        if (familySlug && pathname && pathname.startsWith(`/${familySlug}/`)) {
          router.push(`/${familySlug}`);
        } else if (!familySlug) {
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
        
        // Check if token has expired or is near expiry — attempt refresh
        if (decodedPayload.exp) {
          const expiresAt = decodedPayload.exp * 1000;
          const now = Date.now();
          // Calculate buffer: 10% of token lifetime or 2 minutes, whichever is smaller
          const tokenLifetime = decodedPayload.iat ? (decodedPayload.exp - decodedPayload.iat) * 1000 : 1800000;
          const refreshBuffer = Math.min(120000, tokenLifetime * 0.1);

          if (expiresAt < now) {
            // Token already expired — try refresh before logging out
            console.log('JWT token has expired, attempting refresh...');
            refreshAccessToken().then(success => {
              if (!success) {
                console.log('Refresh failed, logging out...');
                handleLogout();
              }
            });
            return;
          } else if (expiresAt - now < refreshBuffer && !isRefreshingRef.current) {
            // Token about to expire — proactively refresh
            refreshAccessToken();
          }
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
      
      // Check if user is on the family root page and authenticated - redirect to log-entry
      // (This check is skipped if we're already on root slug page due to early return above)
      // This code only runs for authenticated users on sub-routes
      
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
    
    // Only set up auth checking if NOT on root slug page
    // Root slug page handles its own auth checking via page component
    if (!isRootSlugPage) {
      // Initial check
      checkAuthStatus();
      
      // Set up continuous checking every second for sub-routes only
      const authCheckInterval = setInterval(checkAuthStatus, 1000);
      
      return () => {
        clearInterval(authCheckInterval);
      };
    }
  }, [mounted, router, handleLogout, refreshAccessToken, familySlug, pathname]);


  // Listen for payment modal requests from child components
  useEffect(() => {
    const handleOpenPayment = () => {
      // Check if user is an account user before opening modal
      const authToken = localStorage.getItem('authToken');
      if (!authToken) return;
      
      try {
        const payload = authToken.split('.')[1];
        const decodedPayload = JSON.parse(atob(payload));
        const isAccountUser = decodedPayload.isAccountAuth || false;
        
        // Only open PaymentModal for account users
        if (!isAccountUser) {
          console.log('PaymentModal can only be opened by account users');
          return;
        }
      } catch (error) {
        console.error('Error parsing JWT token for payment modal:', error);
        return;
      }
      
      // Fetch account status for PaymentModal
      const fetchAccountStatusForPayment = async () => {
        try {
          const response = await fetch('/api/accounts/status', {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setPaymentAccountStatus({
                accountStatus: data.data.accountStatus || 'active',
                planType: data.data.planType || null,
                subscriptionActive: data.data.subscriptionActive || false,
                trialEnds: data.data.trialEnds || null,
                planExpires: data.data.planExpires || null,
                subscriptionId: data.data.subscriptionId || null,
              });
              setShowPaymentModal(true);
            }
          }
        } catch (error) {
          console.error('Error fetching account status for payment modal:', error);
        }
      };
      
      fetchAccountStatusForPayment();
    };
    
    window.addEventListener('openPaymentModal', handleOpenPayment);
    return () => window.removeEventListener('openPaymentModal', handleOpenPayment);
  }, []);

  // Check if we should show the notification splash modal
  useEffect(() => {
    if (!mounted || !isUnlocked || babies.length === 0 || !notificationsEnabled) return;

    const checkNotificationSplash = async () => {
      try {
        // Check if already dismissed on this device
        const dismissed = localStorage.getItem('notificationSplashDismissed');
        if (dismissed) return;

        // Check if browser supports push notifications
        if (!checkPushSupport()) return;

        // Check if already subscribed on this device
        const status = await checkSubscriptionStatus();
        if (status.isSubscribed && status.isRegisteredOnServer) return;

        // All checks passed - show the modal
        setShowNotificationSplash(true);
      } catch (error) {
        console.error('Error checking notification splash eligibility:', error);
      }
    };

    // Small delay to avoid showing immediately on page load
    const timeoutId = setTimeout(checkNotificationSplash, 1500);
    return () => clearTimeout(timeoutId);
  }, [mounted, isUnlocked, babies.length, notificationsEnabled]);

  // Check unlock status based on JWT token and extract user info
  useEffect(() => {
    const checkUnlockStatus = () => {
      const authToken = localStorage.getItem('authToken');
      const unlockTime = localStorage.getItem('unlockTime');

      // Check if user is authenticated via account or is a system admin
      let isAccountAuth = false;
      let isSysAdmin = false;
      if (authToken) {
        try {
          const payload = authToken.split('.')[1];
          const decodedPayload = JSON.parse(atob(payload));
          isAccountAuth = decodedPayload.isAccountAuth || false;
          isSysAdmin = decodedPayload.isSysAdmin || false;
        } catch (error) {
          console.error('Error parsing JWT token for unlock status:', error);
        }
      }

      // Account holders and system admins are automatically unlocked, PIN-based users need unlockTime
      const newUnlockState = !!(authToken && (isAccountAuth || isSysAdmin || unlockTime));
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

  // Check if we're on the root slug page and not authenticated
  // In this case, show only the page content (login UI) without app UI (header, side nav)
  const isRootSlugPage = pathname === `/${familySlug}` || pathname === `/${familySlug}/`;
  const shouldShowAppUI = (isUnlocked || process.env.NODE_ENV === 'development') && !(isRootSlugPage && !isUnlocked);

  return (
    <>
      {shouldShowAppUI && (
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
                      {/* Show caretaker name for PIN-based authentication */}
                      {!isAccountAuth && caretakerName && caretakerName !== 'system' && (
                        <span className="text-white text-xs opacity-80">
                          {t('Hi,')} {caretakerName}
                        </span>
                      )}
                      {/* Show AccountButton for account-based authentication */}
                      {isAccountAuth && (
                        <div className="mb-1">
                          <AccountButton
                            variant="white"
                            className="h-8 px-2 text-xs origin-left"
                            showIcon={false}
                            hideFamilyDashboardLink={true}
                            onAccountManagerOpen={() => setShowAccountManager(true)}
                          />
                        </div>
                      )}
                      <span className="text-white text-sm font-medium">
                        {family?.name || familyName} - {pathname?.includes('/log-entry')
                          ? t('Log Entry')
                          : pathname?.includes('/calendar')
                          ? t('Calendar')
                          : pathname?.includes('/reports')
                          ? t('Reports')
                          : t('Full Log')}
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
            
            {/* Account Expiration Banner - shows for both account users and caretakers */}
            <AccountExpirationBanner isAccountAuth={isAccountAuth} />
            
            <main className="flex-1 relative z-0">
              {children}
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

      {/* Show page content without app UI when on root slug page and not authenticated */}
      {!shouldShowAppUI && (
        <div className="min-h-screen">
          {children}
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
        isAdmin={isAdmin}
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

      {/* Account Manager */}
      <AccountManager
        isOpen={showAccountManager}
        onClose={() => setShowAccountManager(false)}
      />

      {/* Payment Modal - can be opened from toast or other components (only in SaaS mode) */}
      {isSaasMode && isAccountAuth && paymentAccountStatus && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          accountStatus={paymentAccountStatus}
          onPaymentSuccess={() => {
            setShowPaymentModal(false);
            // Refresh page to get updated subscription status
            window.location.reload();
          }}
        />
      )}

      {/* Notification Splash Modal */}
      <NotificationSplashModal
        open={showNotificationSplash}
        onClose={() => setShowNotificationSplash(false)}
        babies={babies}
      />
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

    // Redirect to home page for account holders or family root (which shows login UI) for PIN users
    if (isAccountAuth) {
      window.location.href = '/';
    } else {
      const familySlug = window.location.pathname.split('/')[1];
      if (familySlug) {
        window.location.href = `/${familySlug}`;
      } else {
        window.location.href = '/login';
      }
    }
  };

  return (
    <DeploymentProvider>
      <LocalizationProvider>
        <FamilyProvider onLogout={handleLogout}>
          <BabyProvider>
            <TimezoneProvider>
              <ThemeProvider>
                <ToastProvider>
                  <DynamicTitle />
                  <AppContent>{children}</AppContent>
                </ToastProvider>
              </ThemeProvider>
            </TimezoneProvider>
          </BabyProvider>
        </FamilyProvider>
      </LocalizationProvider>
    </DeploymentProvider>
  );
}
