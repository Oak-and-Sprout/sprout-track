import React, { useEffect, useState, Suspense } from 'react';
import ChangelogModal from '@/src/components/modals/changelog';
import FeedbackPage from '@/src/components/forms/FeedbackForm/FeedbackPage';
import dynamic from 'next/dynamic';
import { X, Settings, LogOut, MessageSquare, CreditCard, Clock, Loader2, PlusSquare, History, Calendar, BarChart3, Baby, ChevronLeft, ChevronRight } from 'lucide-react';
import NavCountBubble from '@/src/components/ui/nav-count-bubble';
import { Badge } from '@/src/components/ui/badge';
import { LanguageSelector } from './language-selector';

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
import { Button } from '@/src/components/ui/button';
import ThemeToggle from '@/src/components/ui/theme-toggle';
import { ShareButton } from '@/src/components/ui/share-button';
import { Label } from '@/src/components/ui/label';
import Image from 'next/image';
import { useTheme } from '@/src/context/theme';
import { useDeployment } from '@/app/context/deployment';
import { useLocalization } from '@/src/context/localization';
import { useTimezone } from '@/app/context/timezone';
import { formatDateLong } from '@/src/utils/dateFormat';
import { cn } from '@/src/lib/utils';
import { sideNavStyles, triggerButtonVariants } from './side-nav.styles';
import { SideNavProps, SideNavTriggerProps, SideNavItemProps } from './side-nav.types';
import { ReactNode } from 'react';
import './side-nav.css';
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
  betaParticipant: boolean;
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
const FooterButton: React.FC<FooterButtonProps & { isCollapsed?: boolean }> = ({
  icon,
  label,
  onClick,
  ariaLabel,
  isCollapsed = true,
}) => {
  return (
    <button
      className={cn(
        sideNavStyles.settingsButton,
        "side-nav-settings-button",
        isCollapsed && "justify-center px-2 py-3"
      )}
      onClick={onClick}
      aria-label={ariaLabel || label}
      title={label}
    >
      <span className={cn(sideNavStyles.settingsIcon, isCollapsed && "mr-0")}>{icon}</span>
      {!isCollapsed && <span className={sideNavStyles.settingsLabel}>{label}</span>}
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
export const SideNavItem: React.FC<SideNavItemProps & { isCollapsed?: boolean }> = ({
  path,
  label,
  icon,
  isActive,
  onClick,
  className,
  badge,
  isCollapsed = false,
}) => {
  return (
    <button
      className={cn(
        sideNavStyles.navItem,
        isActive && sideNavStyles.navItemActive,
        className,
        isActive && "active",
        isCollapsed && "justify-center px-2 py-3"
      )}
      onClick={() => onClick(path)}
      title={label}
      aria-label={label}
    >
      {icon && <span className={cn(sideNavStyles.navItemIcon, isCollapsed && "mr-0")}>{icon}</span>}
      {!isCollapsed && <span className={sideNavStyles.navItemLabel}>{label}</span>}
      {!isCollapsed && badge && <span className="ml-auto">{badge}</span>}
    </button>
  );
};

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
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { theme } = useTheme();
  const { isSaasMode } = useDeployment();
  const { t } = useLocalization();
  const { dateFormat } = useTimezone();
  const [isSystemDarkMode, setIsSystemDarkMode] = useState<boolean>(false);
  const [showChangelog, setShowChangelog] = useState<boolean>(false);
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [isAccountAuth, setIsAccountAuth] = useState<boolean>(false);
  const [unreadFeedbackCount, setUnreadFeedbackCount] = useState<number>(0);
  const [hasNewUpdates, setHasNewUpdates] = useState<boolean>(false);

  // Check if user has seen the current version's changelog
  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) return;

    const checkForUpdates = async () => {
      try {
        const response = await fetch('/api/changelog/seen', {
          headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (!response.ok) return;
        const data = await response.json();
        if (data.success && data.data) {
          setHasNewUpdates(data.data.hasNewUpdates);
        }
      } catch {
        // Non-critical
      }
    };

    checkForUpdates();
  }, []);

  // Fetch unread feedback count (admin replies the user hasn't read)
  useEffect(() => {
    if (!isSaasMode) return;
    const authToken = localStorage.getItem('authToken');
    if (!authToken) return;

    const fetchUnreadCount = async () => {
      try {
        const response = await fetch('/api/feedback', {
          headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (!response.ok) return;
        const data = await response.json();
        if (data.success && data.data) {
          let count = 0;
          for (const thread of data.data) {
            if (thread.replies) {
              count += thread.replies.filter(
                (r: { viewed: boolean; submitterName: string | null }) =>
                  !r.viewed && r.submitterName === 'Admin'
              ).length;
            }
          }
          setUnreadFeedbackCount(count);
        }
      } catch {
        // Non-critical
      }
    };

    fetchUnreadCount();
  }, [isSaasMode, showFeedback]);

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

    globalThis.addEventListener('keydown', handleKeyDown);

    // Prevent scrolling when side nav is open in modal mode
    if (isOpen && !nonModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, nonModal]);

  // Helper function to render the dialog content
  const dialogContent = () => (
    <>
      {/* Header - matching the structure of the green bar in the main layout */}
      <header className="w-full bg-white sticky top-0 z-40 side-nav-header pt-[env(safe-area-inset-top)]">
        <div className="mx-auto">
          <div className={cn("flex justify-between items-center min-h-20", sideNavStyles.header, isCollapsed && "px-2 justify-center")}>
            <div className={cn("flex items-center gap-3", isCollapsed ? "justify-center flex-col gap-2" : "flex-1")}>
              {/* Logo positioned to center between app name and family name */}
              <div className="flex items-center justify-center">
                <Image
                  src="/sprout-128.png"
                  alt="Sprout Logo"
                  width={36}
                  height={36}
                  className={sideNavStyles.logo}
                  priority
                />
              </div>

              {/* App name and family name container */}
              {!isCollapsed && (
                <div className="flex flex-col justify-center flex-1">
                  <h1>
                    {isSaasMode ? (
                      <button
                        onClick={() => {
                          globalThis.location.href = '/';
                        }}
                        className="text-left cursor-pointer hover:opacity-80 transition-opacity"
                        aria-label="Go to home page"
                      >
                        <span className={cn(sideNavStyles.appName, "side-nav-app-name")}>{t('Sprout Track')}</span>
                      </button>
                    ) : (
                      <span className={cn(sideNavStyles.appName, "side-nav-app-name")}>{t('Sprout Track')}</span>
                    )}
                  </h1>

                  {/* Family name with share button */}
                  {familyName && (
                    <div className="flex items-center gap-2 mt-1">
                      <Label className="text-sm text-gray-600 truncate max-w-[120px]">
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
              )}
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

              {/* Collapse toggle button - only on desktop non-modal screens */}
              {nonModal && (
                <>
                  <br />
                  <button
                    onClick={onToggleCollapse}
                    className={cn(
                      "p-1 rounded-lg hover:bg-teal-50 hover:text-teal-700 text-gray-500 transition-colors duration-200",
                      isCollapsed ? "mt-2" : "ml-2"
                    )}
                    aria-label={isCollapsed ? t("Expand sidebar") : t("Collapse sidebar")}
                    title={isCollapsed ? t("Expand sidebar") : t("Collapse sidebar")}
                  >
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Items */}
      <nav className={cn(sideNavStyles.navItems, isCollapsed && "px-2")}>
        <SideNavItem
          path="/log-entry"
          label={t('Log Entry')}
          icon={<PlusSquare size={20} />}
          isActive={currentPath === '/log-entry'}
          onClick={onNavigate}
          className="side-nav-item"
          isCollapsed={isCollapsed}
        />
        <SideNavItem
          path="/full-log"
          label={t('Full Log')}
          icon={<History size={20} />}
          isActive={currentPath === '/full-log'}
          onClick={onNavigate}
          className="side-nav-item"
          isCollapsed={isCollapsed}
        />
        <SideNavItem
          path="/calendar"
          label={t('Calendar')}
          icon={<Calendar size={20} />}
          isActive={currentPath === '/calendar'}
          onClick={onNavigate}
          className="side-nav-item"
          isCollapsed={isCollapsed}
        />
        <SideNavItem
          path="/reports"
          label={t('Reports')}
          icon={<BarChart3 size={20} />}
          isActive={currentPath === '/reports'}
          onClick={onNavigate}
          className="side-nav-item"
          isCollapsed={isCollapsed}
        />
        <SideNavItem
          path="/nursery-mode"
          label={t('Nursery Mode')}
          icon={<Baby size={20} />}
          isActive={currentPath === '/nursery-mode'}
          onClick={onNavigate}
          className="side-nav-item"
          isCollapsed={isCollapsed}
        />
      </nav>

      {/* Version display at bottom of nav items */}
      {!isCollapsed && (
        <div className="w-full text-center mb-4">
          <div className="flex items-center justify-center gap-2">
            {hasNewUpdates ? (
              <Badge
                variant="default"
                className="new-updates-badge cursor-pointer text-[10px] px-1.5 py-0"
                onClick={() => setShowChangelog(true)}
              >
                {t('New Updates')}: v{packageInfo.version}
              </Badge>
            ) : (
              <span
                className="text-xs text-gray-500 cursor-pointer hover:text-teal-600 transition-colors"
                onClick={() => setShowChangelog(true)}
                aria-label="View changelog"
              >
                v{packageInfo.version}
              </span>
            )}
            <span className="text-xs text-gray-400">•</span>
            <LanguageSelector />
          </div>

          {/* Feedback link - only shown in SaaS mode */}
          {isSaasMode && (
            <div className="mt-2">
              <button
                className="flex items-center justify-center w-full text-xs text-gray-500 hover:text-emerald-600 transition-colors cursor-pointer"
                onClick={() => setShowFeedback(true)}
                aria-label={t('Send Feedback')}
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                {t('Send Feedback')}
                {unreadFeedbackCount > 0 && (
                  <NavCountBubble
                    count={unreadFeedbackCount}
                    variant="accent"
                    className="ml-1.5 scale-90"
                  />
                )}
              </button>
            </div>
          )}

          {/* Trial information and payment button - only shown in SaaS mode for accounts in trial */}
          {isSaasMode && isAccountAuth && accountStatus && (
            <>
              {/* Show trial info if user is in trial and not a beta participant */}
              {accountStatus.trialEnds &&
                !accountStatus.subscriptionActive &&
                !accountStatus.betaParticipant &&
                accountStatus.accountStatus === 'trial' && (
                  <div className="mt-4 px-4">
                    <div className={cn("bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2", "side-nav-trial-container")}>
                      <div className={cn("flex items-center justify-center text-amber-700", "side-nav-trial-header")}>
                        <Clock className="h-4 w-4 mr-1" />
                        <span className="text-xs font-medium">{t('Trial Version')}</span>
                      </div>
                      <div className="text-center">
                        <p className={cn("text-xs text-amber-600", "side-nav-trial-text")}>
                          {t('Ending')}: {formatDateLong(new Date(accountStatus.trialEnds), dateFormat)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white"
                        onClick={() => setShowPaymentModal(true)}
                      >
                        <CreditCard className="h-3 w-3 mr-1" />
                        {t('Buy Now')}
                      </Button>
                    </div>
                  </div>
                )}
            </>
          )}
        </div>
      )}

      {/* Changelog Modal */}
      <ChangelogModal
        open={showChangelog}
        onClose={() => {
          setShowChangelog(false);
          if (hasNewUpdates) {
            const authToken = localStorage.getItem('authToken');
            if (authToken) {
              fetch('/api/changelog/seen', {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ version: packageInfo.version }),
              }).then(() => setHasNewUpdates(false)).catch(() => { });
            }
          }
        }}
        version={packageInfo.version}
      />

      {/* Feedback Page - always mounted in SaaS mode so slide transition works */}
      {isSaasMode && (
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
            const refreshAccountStatus = async () => {
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
            refreshAccountStatus();
          }}
        />
      )}

      {/* Footer with Theme Toggle, Settings and Logout */}
      <div className={cn(sideNavStyles.footer, "side-nav-footer", isCollapsed && "px-2")}>
        {/* Theme Toggle Component */}
        <ThemeToggle className="mb-2" isCollapsed={isCollapsed} />

        {/* Settings Button */}
        <FooterButton
          icon={<Settings />}
          label={t('Settings')}
          onClick={onSettingsClick}
          isCollapsed={isCollapsed}
        />

        {/* Logout Button */}
        <FooterButton
          icon={<LogOut />}
          label={t('Logout')}
          onClick={onLogout}
          isCollapsed={isCollapsed}
        />
      </div>
    </>
  );

  // Main return statement
  return (
    <>
      {nonModal ? (
        <aside
          className={cn(
            sideNavStyles.containerNonModal,
            isCollapsed ? "w-16" : "w-64",
            className,
            "side-nav" // Add this class for direct CSS targeting
          )}
          aria-label={t("Navigation sidebar")}
        >
          {dialogContent()}
        </aside>
      ) : (
        <>
          {/* Overlay - only shown in modal mode */}
          <div
            className={cn(
              sideNavStyles.overlay,
              isOpen ? sideNavStyles.overlayOpen : sideNavStyles.overlayClosed
            )}
            onClick={onClose}
            aria-hidden="true"
          />
          <dialog
            className={cn(
              sideNavStyles.container,
              isOpen ? sideNavStyles.containerOpen : sideNavStyles.containerClosed,
              "w-64",
              className,
              "side-nav"
            )}
            aria-modal="true"
            aria-label={t("Navigation sidebar")}
          >
            {dialogContent()}
            <button
              type="button"
              onClick={onClose}
              className={cn(sideNavStyles.closeButton, "side-nav-close-button")}
              aria-label="Close navigation"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </dialog>
        </>
      )}
    </>
  );
};

export default SideNav;
