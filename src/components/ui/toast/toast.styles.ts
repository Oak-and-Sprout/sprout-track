import { cva } from "class-variance-authority"

/**
 * Toast variant styles using class-variance-authority
 * Defines all visual variations of the toast component
 *
 * This uses TailwindCSS classes for styling and follows the project's design system
 * When adapting to React Native, these styles will need to be converted to React Native StyleSheet
 * or a compatible styling solution like NativeWind
 *
 * @see https://cva.style/docs for more information on class-variance-authority
 */
export const toastVariants = cva(
  "relative flex items-start gap-3 rounded-lg border p-4 shadow-lg transition-all duration-300 ease-in-out",
  {
    variants: {
      variant: {
        info: "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/95 dark:border-blue-800 dark:text-blue-100",
        success:
          "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-900/95 dark:border-emerald-800 dark:text-emerald-100",
        warning:
          "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/95 dark:border-amber-800 dark:text-amber-100",
        error:
          "bg-red-50 border-red-200 text-red-900 dark:bg-red-900/95 dark:border-red-800 dark:text-red-100",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
)

/**
 * Toast icon container styles
 */
export const toastIconVariants = cva("flex-shrink-0", {
  variants: {
    variant: {
      info: "text-blue-600 dark:text-blue-400",
      success: "text-emerald-600 dark:text-emerald-400",
      warning: "text-amber-600 dark:text-amber-400",
      error: "text-red-600 dark:text-red-400",
    },
  },
  defaultVariants: {
    variant: "info",
  },
})

/**
 * Toast close button styles
 */
export const toastCloseButtonVariants = cva(
  "absolute top-2 right-2 rounded-md p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2",
  {
    variants: {
      variant: {
        info: "text-blue-600 focus:ring-blue-500 dark:text-blue-400",
        success: "text-emerald-600 focus:ring-emerald-500 dark:text-emerald-400",
        warning: "text-amber-600 focus:ring-amber-500 dark:text-amber-400",
        error: "text-red-600 focus:ring-red-500 dark:text-red-400",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
)

