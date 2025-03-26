/**
 * Activity tile styles using TailwindCSS classes
 * Defines all visual variations of the activity tile component
 *
 * This follows the project's design system and is consistent with other UI components
 */
export const activityTileStyles = {
  base: "group transition-colors duration-200 cursor-pointer",
  container: "flex items-center justify-center px-6 py-3 overflow-hidden",
  
  // Button styles for each variant when used as a button
  button: {
    base: "h-24 relative cursor-pointer rounded-lg drop-shadow-lg overflow-hidden hover:transition-all duration-200",
    variants: {
      sleep: "",
      feed: "",
      diaper: "",
      note: "",
      bath: "",
      pump: "",
      default: ""
    }
  },
  
  iconContainer: {
    base: "flex-shrink-0 mt-1 items-center justify-center transition-transform duration-200 overflow-visible",
    variants: {
      sleep: "",
      feed: "",
      diaper: "",
      note: "",
      bath: "",
      pump: "",
      default: ""
    }
  },
  
  icon: {
    base: "h-16 w-16",
    variants: {
      sleep: "text-gray-700",
      feed: "text-blue-600",
      diaper: "text-teal-600",
      note: "text-yellow-600",
      bath: "text-orange-600",
      pump: "text-purple-600",
      default: "text-gray-600"
    },
    // Default icon paths for each variant
    defaultIcons: {
      sleep: "/crib-128.png",
      feed: "/bottle-128.png",
      diaper: "/diaper-128.png",
      note: "/note-128.png",
      bath: "/bath-128.png",
      pump: "/pump-128.png",
      default: ""
    }
  },
  
  content: {
    base: "min-w-0 flex-1",
    typeContainer: "flex items-center gap-2 text-xs",
    typeLabel: "inline-flex items-center rounded-md bg-gray-50 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-200 ring-1 ring-inset ring-gray-500/10 dark:ring-gray-600",
    description: "text-gray-900 dark:text-gray-200"
  }
} as const;
