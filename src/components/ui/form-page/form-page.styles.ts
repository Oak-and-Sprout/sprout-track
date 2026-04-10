import { cva } from "class-variance-authority";

/**
 * Form page styles using class-variance-authority
 * Defines all visual variations of the form page component
 *
 * This uses TailwindCSS classes for styling and follows the project's design system
 */
export const formPageStyles = {
  // Main container
  container: "fixed inset-y-0 right-0 z-[99] flex flex-col bg-white/95 backdrop-blur-sm transform transition-transform duration-300 ease-in-out w-full sm:max-w-lg md:max-w-xl border-l border-slate-200 overflow-hidden",
  
  // Container when open
  containerOpen: "translate-x-0",
  
  // Container when closed
  containerClosed: "translate-x-full",
  
  // Overlay background
  overlay: "fixed inset-0 bg-black/30 z-[98] transition-opacity duration-300",
  
  // Overlay when open
  overlayOpen: "opacity-100",
  
  // Overlay when closed
  overlayClosed: "opacity-0 pointer-events-none",
  
  // Header section
  header: "flex items-center p-4 pt-[calc(1rem+env(safe-area-inset-top))] border-b border-gray-200",
  
  // Title container
  titleContainer: "flex flex-col",
  
  // Title
  title: "text-lg font-semibold text-slate-800",
  
  // Description
  description: "text-sm text-gray-500 mt-1",
  
  // Close button
  closeButton: "text-gray-500 hover:text-gray-700 transition-colors duration-200 p-2 rounded-full hover:bg-slate-100/80",
  
  // Content container (scrollable area)
  content: "flex-1 overflow-y-auto p-4 pb-20", // Added bottom padding to ensure content doesn't get hidden behind fixed footer
  
  // Form content alignment for mobile and desktop
  formContent: "flex flex-col space-y-6 mx-auto max-w-md sm:mx-0",
  
  // Footer section
  footer: "border-t border-gray-200 p-4 flex justify-end gap-2 bg-white/95 backdrop-blur-sm absolute bottom-0 left-0 right-0 z-10",
};

/**
 * Trigger button styles using class-variance-authority
 */
export const formPageTriggerVariants = cva(
  "flex items-center justify-center cursor-pointer transition-all duration-300 ease-in-out",
  {
    variants: {
      isOpen: {
        true: "-rotate-90",
        false: "rotate-0",
      },
    },
    defaultVariants: {
      isOpen: false,
    },
  }
);

/**
 * Tab navigation styles
 */
export const tabStyles = {
  // Tab container
  tabContainer: "flex flex-row border-b border-gray-200 mb-6 overflow-x-auto scrollbar-hide -webkit-overflow-scrolling-touch",
  
  // Individual tab button
  tabButton: "flex items-center gap-2 py-3 px-4 mx-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-0 rounded-t-lg border-b-2 border-transparent whitespace-nowrap focus:border-b-teal-500",
  
  // Active tab button
  tabButtonActive: "text-teal-700 bg-teal-50 border-b-teal-500 hover:text-teal-800 hover:bg-teal-100",
  
  // Tab icon
  tabIcon: "h-4 w-4 flex-shrink-0",
  
  // Tab image icon
  tabImage: "h-4 w-4 flex-shrink-0 object-contain",
  
  // Tab content container
  tabContent: "flex-1",
  
  // Notification badge
  notificationBadge: "absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center min-w-[1.25rem]",
};
