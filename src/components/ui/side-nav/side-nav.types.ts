import { ReactNode } from "react";

/**
 * Props for the SideNav component
 */
export interface SideNavProps {
  /**
   * Whether the side navigation is open
   */
  isOpen: boolean;

  /**
   * Function to call when the side navigation should be closed
   */
  onClose: () => void;

  /**
   * The current active path
   */
  currentPath: string;

  /**
   * Function to call when a navigation item is selected
   */
  onNavigate: (path: string) => void;

  /**
   * Function to call when the settings button is clicked
   */
  onSettingsClick: () => void;

  /**
   * Function to call when the logout button is clicked
   */
  onLogout: () => void;

  /**
   * Whether the current user is an admin
   */
  isAdmin: boolean;

  /**
   * Additional CSS classes to apply to the side navigation
   */
  className?: string;

  /**
   * Whether to render the side nav in non-modal mode (for wide screens)
   */
  nonModal?: boolean;

  /**
   * The family slug for sharing purposes
   */
  familySlug?: string;

  /**
   * The family name to display
   */
  familyName?: string;
}

/**
 * Props for the SideNavTrigger component
 */
export interface SideNavTriggerProps {
  /**
   * Function to call when the trigger is clicked
   */
  onClick: () => void;
  
  /**
   * Whether the side navigation is open
   */
  isOpen: boolean;
  
  /**
   * Additional CSS classes to apply to the trigger
   */
  className?: string;
  
  /**
   * Children elements
   */
  children: ReactNode;
}

/**
 * Props for the SideNavItem component
 */
export interface SideNavItemProps {
  /**
   * The path this item navigates to
   */
  path: string;
  
  /**
   * The label to display for this item
   */
  label: string;
  
  /**
   * Optional icon to display next to the label
   */
  icon?: ReactNode;
  
  /**
   * Whether this item is currently active
   */
  isActive: boolean;
  
  /**
   * Function to call when this item is clicked
   */
  onClick: (path: string) => void;
  
  /**
   * Additional CSS classes to apply to the item
   */
  className?: string;
}