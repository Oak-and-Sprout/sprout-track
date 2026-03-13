/**
 * Styles for the GuardianUpdate component
 *
 * These styles use Tailwind CSS classes and are designed to be compatible
 * with the project's design system and dark mode support.
 */

export const guardianUpdateStyles = {
  // Container
  container: "space-y-4",

  // Section header (matches BackupRestore pattern)
  header: {
    container: "flex items-center space-x-2",
    icon: "h-5 w-5 text-teal-600",
    title: "text-lg font-semibold guardian-update-title",
  },

  // Content area (now uses Card component, styles moved to CardContent)
  content: "space-y-3",

  // Row layout
  row: "flex items-center justify-between",

  // Button row
  buttonRow: "flex items-center space-x-2",

  // Icon in buttons
  icon: "h-4 w-4 mr-2",

  // Version grid
  versionGrid: "grid grid-cols-2 gap-2 items-center text-sm",
  versionLabel: "text-sm text-gray-900 dark:text-gray-400",

  // Help text
  helpText: "text-xs text-gray-900 dark:text-gray-400 guardian-update-help-text",

  // Status messages (no background, matches DialogDescription style)
  banner: {
    row: "flex items-center space-x-2",
    text: "text-sm text-muted-foreground",
    subtext: "text-xs text-muted-foreground",
  },

  // Confirmation dialog
  dialog: {
    warningBox: "flex items-start space-x-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg mx-6 mb-2",
    warningText: "text-sm text-orange-700 dark:text-orange-400",
  },
} as const;
