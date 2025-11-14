import React, { useEffect, useState } from 'react';
import ChangelogModal from '@/src/components/modals/changelog';
import FeedbackPage from '@/src/components/forms/FeedbackForm/FeedbackPage';
import PaymentModal from '@/src/components/account-manager/PaymentModal';
import { X, Settings, LogOut, MessageSquare, CreditCard, Clock } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import ThemeToggle from '@/src/components/ui/theme-toggle';
import { ShareButton } from '@/src/components/ui/share-button';
import { Label } from '@/src/components/ui/label';
import Image from 'next/image';
import { useTheme } from '@/src/context/theme';
import { useDeployment } from '@/app/context/deployment';
import { cn } from '@/src/lib/utils';
import { sideNavStyles, triggerButtonVariants } from './side-nav.styles';
import { SideNavProps, SideNavTriggerProps, SideNavItemProps } from './side-nav.types';
import { ReactNode } from 'react';
import './side-nav.css'; // Import the CSS file with dark mode overrides
import packageInfo from '@/package.json';

// Interface for the FooterButton component
interface FooterButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  ariaLabel?: string;
}

// Interface for account status
interface AccountStatus {
  accountId: string;
  email: string;
  firstName: string;
  lastName?: string;
  verified: boolean;
  hasFamily: boolean;
  familySlug?: string;
  familyName?: string;
  betaparticipant: boolean;
  closed: boolean;
  closedAt?: string;
  planType?: string;
  planExpires?: string;
  trialEnds?: string;
  subscriptionActive: boolean;
  accountStatus: 'active' | 'inactive' | 'trial' | 'expired' | 'closed' | 'no_family';
}

/**
 * FooterButton component
 * 
 * A button used in the footer of the side navigation
 */
const FooterButton: React.FC<FooterButtonProps> = ({
  icon,
  label,
  onClick,
  ariaLabel,
}) => {
  return (
    <button
      className={cn(sideNavStyles.settingsButton, "side-nav-settings-button")}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <span className={sideNavStyles.settingsIcon}>{icon}</span>
      <span className={sideNavStyles.settingsLabel}>{label}</span>
    </button>
  );
};

/**
 * SideNavTrigger component
 * 
 * A button that toggles the side navigation menu
 */
export const SideNavTrigger: React.FC<SideNavTriggerProps> = ({
  onClick,
  isOpen,
  className,
  children,
}) => {
  return (
    <div 
      onClick={onClick}
      className={cn(triggerButtonVariants({ isOpen }), className)}
    >
      {children}
    </div>
  );
};

/**
 * SideNavItem component
 * 
 * An individual navigation item in the side navigation menu
 */
export const SideNavItem: React.FC<SideNavItemProps> = ({
  path,
  label,
  icon,
  isActive,
  onClick,
  className,
}) => {
  return (
    <button
      className={cn(
        sideNavStyles.navItem,
        isActive && sideNavStyles.navItemActive,
        className,
        isActive && "active" // Add active class for CSS targeting
      )}
      onClick={() => onClick(path)}
    >
      {icon && <span className={sideNavStyles.navItemIcon}>{icon}</span>}
      <span className={sideNavStyles.navItemLabel}>{label}</span>
    </button>
  );
};

/**
 * SideNav component
 * 
 * A responsive side navigation menu that slides in from the left
 */
/**
 * SideNav component
 * 
 * A responsive side navigation menu that slides in from the left
 */
export const SideNav: React.FC<SideNavProps> = ({
  isOpen,
  onClose,
  currentPath,
  onNavigate,
  onSettingsClick,
  onLogout,
  isAdmin,
  className,
  nonModal = false,
  familySlug,
  familyName,
}) => {
  const { theme } = useTheme();
  const { isSaasMode } = useDeployment();
  const [isSystemDarkMode, setIsSystemDarkMode] = useState<boolean>(false);
  const [showChangelog, setShowChangelog] = useState<boolean>(false);
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [isAccountAuth, setIsAccountAuth] = useState<boolean>(false);
  
  // Fetch account status if in SaaS mode and authenticated
  useEffect(() => {
    const fetchAccountStatus = async () => {
      if (!isSaasMode) return;

      const authToken = localStorage.getItem('authToken');
      if (!authToken) {
        setIsAccountAuth(false);
        return;
      }

      // Check if this is account-based authentication
      try {
        const payload = authToken.split('.')[1];
        const decodedPayload = JSON.parse(atob(payload));
        const isAccountBased = decodedPayload.isAccountAuth || false;
        setIsAccountAuth(isAccountBased);

        if (!isAccountBased) return;

        // Fetch account status
        const response = await fetch('/api/accounts/status', {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setAccountStatus(data.data);
          }
        }
      } catch (error) {
        console.error('Error fetching account status:', error);
      }
    };

    fetchAccountStatus();
  }, [isSaasMode]);

  // Check if system is in dark mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setIsSystemDarkMode(darkModeMediaQuery.matches);

      const handleChange = (e: MediaQueryListEvent) => {
        setIsSystemDarkMode(e.matches);
      };

      darkModeMediaQuery.addEventListener('change', handleChange);
      return () => darkModeMediaQuery.removeEventListener('change', handleChange);
    }
  }, []);
  
  // Close the side nav when pressing Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !nonModal) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    // Prevent scrolling when side nav is open in modal mode
    if (isOpen && !nonModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, nonModal]);

  return (
    <>
      {/* Overlay - only shown in modal mode */}
      {!nonModal && (
        <div 
          className={cn(
            sideNavStyles.overlay,
            isOpen ? sideNavStyles.overlayOpen : sideNavStyles.overlayClosed
          )}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Side Navigation Panel */}
      <div
        className={cn(
          nonModal ? sideNavStyles.containerNonModal : sideNavStyles.container,
          !nonModal && (isOpen ? sideNavStyles.containerOpen : sideNavStyles.containerClosed),
          className,
          "side-nav" // Add this class for direct CSS targeting
        )}
        role={nonModal ? "navigation" : "dialog"}
        aria-modal={nonModal ? "false" : "true"}
        aria-label="Main navigation"
      >
        {/* Header - matching the structure of the green bar in the main layout */}
        <header className="w-full bg-white sticky top-0 z-40 side-nav-header">
          <div className="mx-auto">
            <div className={cn("flex justify-between items-center min-h-20", sideNavStyles.header)}>
              <div className="flex items-center gap-3 flex-1">
                {/* Logo positioned to center between app name and family name */}
                <div className="flex items-center">
                  <Image
                    src="/sprout-128.png"
                    alt="Sprout Logo"
                    width={40}
                    height={40}
                    className={sideNavStyles.logo}
                    priority
                  />
                </div>

                {/* App name and family name container */}
                <div className="flex flex-col justify-center flex-1">
                  {isSaasMode ? (
                    <button
                      onClick={() => {
                        window.location.href = '/';
                      }}
                      className="text-left cursor-pointer hover:opacity-80 transition-opacity"
                      aria-label="Go to home page"
                    >
                      <span className={cn(sideNavStyles.appName, "side-nav-app-name")}>Sprout Track</span>
                    </button>
                  ) : (
                    <span className={cn(sideNavStyles.appName, "side-nav-app-name")}>Sprout Track</span>
                  )}

                  {/* Family name with share button */}
                  {familyName && (
                    <div className="flex items-center gap-2 mt-1">
                      <Label className="text-sm text-gray-600 truncate">
                        {familyName}
                      </Label>
                      {familySlug && (
                        <ShareButton
                          familySlug={familySlug}
                          familyName={familyName}
                          variant="ghost"
                          size="sm"
                          showText={false}
                          className="h-5 w-5 p-0"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Only show close button in modal mode */}
              {!nonModal && (
                <button
                  onClick={onClose}
                  className={cn(sideNavStyles.closeButton, "side-nav-close-button")}
                  aria-label="Close navigation"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Navigation Items */}
        <nav className={sideNavStyles.navItems}>
          <SideNavItem
            path="/log-entry"
            label="Log Entry"
            isActive={currentPath === '/log-entry'}
            onClick={onNavigate}
            className="side-nav-item"
          />
          <SideNavItem
            path="/full-log"
            label="Full Log"
            isActive={currentPath === '/full-log'}
            onClick={onNavigate}
            className="side-nav-item"
          />
          <SideNavItem
            path="/calendar"
            label="Calendar"
            isActive={currentPath === '/calendar'}
            onClick={onNavigate}
            className="side-nav-item"
          />
        </nav>

        {/* Version display at bottom of nav items */}
        <div className="w-full text-center mb-4">
          <span 
            className="text-xs text-gray-500 cursor-pointer hover:text-teal-600 transition-colors"
            onClick={() => setShowChangelog(true)}
            aria-label="View changelog"
          >
            v{packageInfo.version}
          </span>
          
          {/* Feedback link - only shown in SaaS mode */}
          {isSaasMode && (
            <div className="mt-2">
              <button
                className="flex items-center justify-center w-full text-xs text-gray-500 hover:text-emerald-600 transition-colors cursor-pointer"
                onClick={() => setShowFeedback(true)}
                aria-label="Provide feedback about the app"
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                Send Feedback
              </button>
            </div>
          )}

          {/* Trial information and payment button - only shown in SaaS mode for accounts in trial */}
          {isSaasMode && isAccountAuth && accountStatus && (
            <>
              {/* Show trial info if user is in trial and not a beta participant */}
              {accountStatus.trialEnds &&
               !accountStatus.subscriptionActive &&
               !accountStatus.betaparticipant &&
               accountStatus.accountStatus === 'trial' && (
                <div className="mt-4 px-4">
                  <div className={cn("bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2", "side-nav-trial-container")}>
                    <div className={cn("flex items-center justify-center text-amber-700", "side-nav-trial-header")}>
                      <Clock className="h-4 w-4 mr-1" />
                      <span className="text-xs font-medium">Trial Version</span>
                    </div>
                    <div className="text-center">
                      <p className={cn("text-xs text-amber-600", "side-nav-trial-text")}>
                        Ending: {new Date(accountStatus.trialEnds).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white"
                      onClick={() => setShowPaymentModal(true)}
                    >
                      <CreditCard className="h-3 w-3 mr-1" />
                      Buy Now
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Changelog Modal */}
        <ChangelogModal 
          open={showChangelog} 
          onClose={() => setShowChangelog(false)} 
          version={packageInfo.version}
        />

        {/* Feedback Page - only shown in SaaS mode and when feedback is requested */}
        {isSaasMode && showFeedback && (
          <FeedbackPage
            isOpen={showFeedback}
            onClose={() => setShowFeedback(false)}
          />
        )}

        {/* Payment Modal - only shown in SaaS mode */}
        {isSaasMode && isAccountAuth && accountStatus && (
          <PaymentModal
            isOpen={showPaymentModal}
            onClose={() => setShowPaymentModal(false)}
            accountStatus={{
              accountStatus: accountStatus.accountStatus,
              planType: accountStatus.planType || null,
              subscriptionActive: accountStatus.subscriptionActive,
              trialEnds: accountStatus.trialEnds || null,
              planExpires: accountStatus.planExpires || null,
              subscriptionId: null, // This will be fetched by the modal if needed
            }}
            onPaymentSuccess={() => {
              setShowPaymentModal(false);
              // Refresh account status after successful payment
              const fetchAccountStatus = async () => {
                const authToken = localStorage.getItem('authToken');
                if (!authToken) return;

                try {
                  const response = await fetch('/api/accounts/status', {
                    headers: {
                      'Authorization': `Bearer ${authToken}`
                    }
                  });

                  if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                      setAccountStatus(data.data);
                    }
                  }
                } catch (error) {
                  console.error('Error refreshing account status:', error);
                }
              };
              fetchAccountStatus();
            }}
          />
        )}

        {/* Footer with Theme Toggle, Settings and Logout */}
        <div className={cn(sideNavStyles.footer, "side-nav-footer")}>
          {/* Theme Toggle Component */}
          <ThemeToggle className="mb-2" />
          
          {/* Settings Button - only shown for admins */}
          {isAdmin && (
            <FooterButton
              icon={<Settings />}
              label="Settings"
              onClick={onSettingsClick}
            />
          )}
          
          {/* Logout Button */}
          <FooterButton
            icon={<LogOut />}
            label="Logout"
            onClick={onLogout}
          />
        </div>
      </div>
    </>
  );
};

export default SideNav;
