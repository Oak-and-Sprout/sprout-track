import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

/**
 * Tab definition for FormPage tabs
 */
export interface FormPageTab {
  /**
   * Unique identifier for the tab
   */
  id: string;
  
  /**
   * Label text for the tab
   */
  label: string;
  
  /**
   * Optional Lucide icon for the tab
   */
  icon?: LucideIcon;
  
  /**
   * Optional image source for custom icon
   */
  imageSrc?: string;
  
  /**
   * Optional alt text for image icon
   */
  imageAlt?: string;
  
  /**
   * Optional notification count to display as a badge
   */
  notificationCount?: number;
  
  /**
   * Content to display when this tab is active
   */
  content: ReactNode;
}

/**
 * Props for the FormPage component
 */
export interface FormPageProps {
  /**
   * Whether the form page is open
   */
  isOpen: boolean;
  
  /**
   * Function to call when the form page should be closed
   */
  onClose: () => void;
  
  /**
   * Title of the form page
   */
  title: string;
  
  /**
   * Optional description below the title
   */
  description?: string;

  /**
   * Optional leading element rendered before the title in the header (e.g. back button)
   */
  leadingAction?: ReactNode;

  /**
   * Content of the form page (used when tabs are not provided)
   */
  children?: ReactNode;
  
  /**
   * Optional tabs configuration for tabbed form views
   */
  tabs?: FormPageTab[];
  
  /**
   * Active tab ID (controlled mode)
   */
  activeTab?: string;
  
  /**
   * Callback when tab changes (controlled mode)
   */
  onTabChange?: (tabId: string) => void;
  
  /**
   * Default active tab ID (uncontrolled mode)
   */
  defaultActiveTab?: string;
  
  /**
   * When true, children fill the entire content area without padding or max-width constraints.
   * The content area becomes a flex column so children can use flex-1 to fill space.
   * Footer still renders at the bottom as usual.
   */
  fullContent?: boolean;

  /**
   * Additional CSS classes to apply to the form page
   */
  className?: string;
}

/**
 * Props for the FormPageHeader component
 */
export interface FormPageHeaderProps {
  /**
   * Title of the form page
   */
  title: string;

  /**
   * Optional description below the title
   */
  description?: string;

  /**
   * Optional function to call when the form page should be closed
   * (Not used in the header anymore as we rely on footer buttons)
   */
  onClose?: () => void;

  /**
   * Optional leading element rendered before the title (e.g. back button)
   */
  leadingAction?: ReactNode;

  /**
   * Additional CSS classes for the header
   */
  className?: string;
}

/**
 * Props for the FormPageContent component
 */
export interface FormPageContentProps {
  /**
   * Content of the form page
   */
  children: ReactNode;
  
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Props for the FormPageFooter component
 */
export interface FormPageFooterProps {
  /**
   * Content of the footer
   */
  children: ReactNode;
  
  /**
   * Additional CSS classes
   */
  className?: string;
}
