import { cva } from "class-variance-authority";

/**
 * Side navigation styles using class-variance-authority
 * Defines all visual variations of the side navigation component
 *
 * This uses TailwindCSS classes for styling and follows the project's design system
 */
export const sideNavStyles = {
  // Main container
  container: "fixed inset-y-0 left-0 z-50 flex flex-col bg-white transform transition-all duration-300 ease-in-out w-64",
  
  // Container for non-modal mode (wide screens)
  containerNonModal: "flex flex-col bg-white w-64 min-h-screen h-full transition-all duration-300 ease-in-out",
  
  // Container when open
  containerOpen: "translate-x-0",
  
  // Container when closed
  containerClosed: "-translate-x-full",
  
  // Overlay background
  overlay: "fixed inset-0 bg-black/30 z-40 transition-opacity duration-300",
  
  // Hide overlay for non-modal mode
  overlayHidden: "hidden",
  
  // Overlay when open
  overlayOpen: "opacity-100",
  
  // Overlay when closed
  overlayClosed: "opacity-0 pointer-events-none",
  
  // Header section
  header: "flex items-center justify-between px-4 border-gray-200",
  
  // Logo container
  logoContainer: "flex items-center space-x-3",
  
  // Logo image
  logo: "w-10 h-10 object-contain",
  
  // App name
  appName: "text-lg font-semibold text-teal-700",
  
  // Close button
  closeButton: "text-gray-500 hover:text-gray-700 transition-colors duration-200",
  
  // Navigation items container
  navItems: "flex-1 py-4 px-4 overflow-y-auto",
  
  // Navigation item
  navItem: "flex items-center w-full px-4 py-3 text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors duration-200 rounded-lg mb-2",
  
  // Active navigation item
  navItemActive: "bg-teal-50 text-teal-700 font-medium",
  
  // Navigation item icon
  navItemIcon: "mr-3 h-5 w-5",
  
  // Navigation item label
  navItemLabel: "text-sm",
  
  // Footer section
  footer: "border-t border-gray-200 p-4",
  
  // Settings button
  settingsButton: "flex items-center w-full px-4 py-3 text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors duration-200 rounded-lg mb-2",
  
  // Settings icon
  settingsIcon: "mr-3 h-5 w-5",
  
  // Settings label
  settingsLabel: "text-sm",
  
  // Language selector trigger
  languageTrigger: "text-xs text-gray-500 cursor-pointer hover:text-teal-600 transition-colors",
};

/**
 * Trigger button styles using class-variance-authority
 */
export const triggerButtonVariants = cva(
  "flex items-center justify-center cursor-pointer transition-all duration-300 ease-in-out",
  {
    variants: {
      isOpen: {
        true: "rotate-90",
        false: "rotate-0",
      },
    },
    defaultVariants: {
      isOpen: false,
    },
  }
);
