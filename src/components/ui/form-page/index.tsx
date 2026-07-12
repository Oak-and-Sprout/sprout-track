import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { formPageStyles, tabStyles } from './form-page.styles';
import { useTheme } from '@/src/context/theme';
import { useLocalization } from '@/src/context/localization';
import './form-page.css';
import { 
  FormPageProps, 
  FormPageHeaderProps, 
  FormPageContentProps, 
  FormPageFooterProps,
  FormPageTab
} from './form-page.types';

// Stack of currently open form page panels; only the topmost traps focus
const openPanelStack: HTMLElement[] = [];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * FormPageHeader component
 * 
 * The header section of the form page with title, description, and close button
 */
export function FormPageHeader({
  title,
  description,
  onClose,
  leadingAction,
  titleId,
  className
}: FormPageHeaderProps) {
  const { theme } = useTheme();
  const { t } = useLocalization();
  return (
    <div className={cn(formPageStyles.header, className, "form-page-header")}>
      {leadingAction}
      <div className={formPageStyles.titleContainer}>
        <h2 id={titleId} className={cn(formPageStyles.title, "form-page-title")}>{title}</h2>
        {description && (
          <p className={cn(formPageStyles.description, "form-page-description")}>{description}</p>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={t('Close')}
          className={cn(
            formPageStyles.closeButton,
            "form-page-close-button absolute right-2 top-[calc(50%+env(safe-area-inset-top)/2)] -translate-y-1/2"
          )}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/**
 * FormPageContent component
 * 
 * The main content area of the form page
 */
export function FormPageContent({ 
  children, 
  className 
}: FormPageContentProps) {
  const { theme } = useTheme();
  return (
    <div className={cn(formPageStyles.content, className, "form-page-content")}>
      <div className={formPageStyles.formContent}>
        {children}
      </div>
    </div>
  );
}

/**
 * FormPageFooter component
 * 
 * The footer section of the form page, typically containing action buttons
 */
export function FormPageFooter({ 
  children, 
  className 
}: FormPageFooterProps) {
  const { theme } = useTheme();
  return (
    <div className={cn(formPageStyles.footer, className, "form-page-footer")}>
      {children}
    </div>
  );
}

/**
 * FormPageTabs component
 * 
 * Tab navigation component for form pages
 */
export function FormPageTabs({
  tabs,
  activeTab,
  onTabChange,
  className
}: {
  tabs: FormPageTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}) {
  const { theme } = useTheme();
  
  return (
    <div className={cn(tabStyles.tabContainer, className, "form-page-tab-container")}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const IconComponent = tab.icon;
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              tabStyles.tabButton,
              "form-page-tab-button relative", // Added relative for badge positioning
              isActive && tabStyles.tabButtonActive,
              isActive && "form-page-tab-button-active"
            )}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
          >
            {/* Icon */}
            {IconComponent && (
              <IconComponent className={cn(tabStyles.tabIcon, "form-page-tab-icon")} />
            )}
            {tab.imageSrc && (
              <img
                src={tab.imageSrc}
                alt={tab.imageAlt || tab.label}
                className={cn(tabStyles.tabImage, "form-page-tab-image")}
              />
            )}
            
            {/* Label */}
            <span>{tab.label}</span>
            
            {/* Notification Badge */}
            {tab.notificationCount && tab.notificationCount > 0 && (
              <span 
                className={cn(tabStyles.notificationBadge, "form-page-tab-notification-badge")}
                aria-label={`${tab.notificationCount} notifications`}
              >
                {tab.notificationCount > 99 ? '99+' : tab.notificationCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * FormPage component
 * 
 * A full-screen form page that slides in from the right side of the screen.
 * It contains a header, scrollable content area, and a footer for action buttons.
 * 
 * Can be used with or without tabs. When tabs are provided, it will render
 * a tabbed interface. Otherwise, it renders the children directly.
 * 
 * On mobile, the form content is centered, while on larger screens (>600px),
 * the form content is left-aligned.
 */
export function FormPage({
  isOpen,
  onClose,
  title,
  description,
  leadingAction,
  children,
  tabs,
  activeTab,
  onTabChange,
  defaultActiveTab,
  fullContent,
  className,
}: FormPageProps) {
  const { theme } = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // State to track if we're in a browser environment
  const [mounted, setMounted] = useState(false);
  
  // Internal state for uncontrolled tab mode
  const [internalActiveTab, setInternalActiveTab] = useState<string>(() => {
    if (tabs && tabs.length > 0) {
      return defaultActiveTab || tabs[0].id;
    }
    return '';
  });
  
  // Determine if we're in controlled or uncontrolled mode
  const isControlled = activeTab !== undefined && onTabChange !== undefined;
  const currentActiveTab = isControlled ? activeTab : internalActiveTab;
  
  // Handle tab change
  const handleTabChange = (tabId: string) => {
    if (isControlled && onTabChange) {
      onTabChange(tabId);
    } else {
      setInternalActiveTab(tabId);
    }
  };

  // Set mounted state to true after component mounts
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Close the form page when pressing Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    // Prevent scrolling when form page is open
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Focus management: move focus into the panel on open, trap Tab within the
  // topmost open panel, and restore focus on close
  useEffect(() => {
    if (!isOpen || !mounted) return;
    const panel = panelRef.current;
    if (!panel) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    openPanelStack.push(panel);
    panel.focus({ preventScroll: true });

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || e.defaultPrevented) return;
      if (openPanelStack[openPanelStack.length - 1] !== panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const inPanel = panel.contains(active);
      // Focus inside portaled content (Radix popover/select/date picker) belongs
      // to the form interaction — leave Tab handling to the portal
      if (!inPanel && active !== document.body) return;
      if (e.shiftKey) {
        if (active === first || !inPanel) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !inPanel) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => {
      document.removeEventListener('keydown', handleTabKey);
      const index = openPanelStack.indexOf(panel);
      if (index !== -1) openPanelStack.splice(index, 1);
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [isOpen, mounted]);

  // Find the active tab content
  const activeTabContent = tabs?.find(tab => tab.id === currentActiveTab)?.content;

  // Content to be rendered
  const content = (
    <>
      {/* Overlay */}
      <div 
        className={cn(
          formPageStyles.overlay,
          isOpen ? formPageStyles.overlayOpen : formPageStyles.overlayClosed,
          "form-page-overlay"
        )}
        onClick={onClose}
        aria-hidden="true"
        style={{ isolation: 'isolate' }} // Create a new stacking context
      />

      {/* Form Page Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          formPageStyles.container,
          isOpen ? formPageStyles.containerOpen : formPageStyles.containerClosed,
          className,
          "form-page-container"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ isolation: 'isolate' }} // Create a new stacking context
      >
        <FormPageHeader
          title={title}
          description={description}
          onClose={onClose}
          leadingAction={leadingAction}
          titleId={titleId}
        />
        
        {/* Tab navigation (if tabs are provided) */}
        {tabs && tabs.length > 0 && (
          <div className="px-4 pt-2">
            <FormPageTabs
              tabs={tabs}
              activeTab={currentActiveTab}
              onTabChange={handleTabChange}
            />
          </div>
        )}
        
        {/* Content area */}
        {fullContent && !tabs ? (
          // Full content mode: no padding, no max-width, flex column for children to fill
          <div className={cn("flex-1 flex flex-col overflow-hidden pb-[60px]", "form-page-content")}>
            {children}
          </div>
        ) : (
          <div className={cn(formPageStyles.content, "form-page-content")}>
            {tabs && tabs.length > 0 ? (
              // Render active tab content with proper padding
              <div
                role="tabpanel"
                id={`tabpanel-${currentActiveTab}`}
                aria-labelledby={`tab-${currentActiveTab}`}
                className="p-2 pb-20"
              >
                {activeTabContent}
              </div>
            ) : (
              // Render children directly when no tabs
              <div className={formPageStyles.formContent}>
                {children}
              </div>
            )}
          </div>
        )}

        {/* Always render children when tabs are provided (for footer) */}
        {tabs && tabs.length > 0 && children}
      </div>
    </>
  );

  // Use createPortal to render at the root level when in browser environment
  return mounted && typeof document !== 'undefined'
    ? createPortal(content, document.body)
    : null;
}

export default FormPage;
