"use client"

import * as React from "react"
import { cn } from "@/src/lib/utils"
import { useTheme } from "@/src/context/theme"

import { toastVariants, toastIconVariants, toastCloseButtonVariants } from "./toast.styles"
import { ToastProps, ToastVariant } from "./toast.types"
import "./toast.css"

/**
 * Default icons for each toast variant
 */
const defaultIcons: Record<ToastVariant, React.ReactNode> = {
  info: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  success: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  warning: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  ),
  error: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
}

/**
 * Close icon for dismissible toasts
 */
const CloseIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
)

/**
 * Toast component for displaying temporary notifications
 *
 * This component follows the project's design system and is designed to be
 * cross-platform compatible with minimal changes required for React Native.
 *
 * Features:
 * - Multiple variants (info, success, warning, error)
 * - Auto-dismiss with configurable duration
 * - Manual dismissal support
 * - Dark mode support
 * - Accessible with proper ARIA attributes
 * - Responsive design
 *
 * @example
 * ```tsx
 * <Toast
 *   variant="success"
 *   message="Changes saved successfully!"
 *   duration={3000}
 *   onDismiss={() => console.log("Dismissed")}
 * />
 * ```
 */
const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  (
    {
      className,
      variant = "info",
      message,
      title,
      duration = 5000,
      dismissible = true,
      onDismiss,
      icon,
      action,
      ...props
    },
    ref
  ) => {
    const { theme } = useTheme()
    const [isVisible, setIsVisible] = React.useState(true)
    const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)

    // Add dark mode specific class based on variant
    const darkModeClass =
      variant === "info"
        ? "toast-dark-info"
        : variant === "success"
        ? "toast-dark-success"
        : variant === "warning"
        ? "toast-dark-warning"
        : variant === "error"
        ? "toast-dark-error"
        : ""

    // Handle auto-dismiss
    React.useEffect(() => {
      if (duration && duration > 0 && isVisible) {
        timeoutRef.current = setTimeout(() => {
          handleDismiss()
        }, duration)
      }

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
      }
    }, [duration, isVisible])

    const handleDismiss = React.useCallback(() => {
      setIsVisible(false)
      // Small delay to allow exit animation
      setTimeout(() => {
        onDismiss?.()
      }, 300)
    }, [onDismiss])

    const displayIcon = icon !== undefined ? icon : defaultIcons[variant || "info"]

    if (!isVisible) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          toastVariants({ variant }),
          darkModeClass,
          isVisible ? "toast-enter animate-in slide-in-from-top-5 fade-in-0" : "toast-exit",
          className
        )}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        {...props}
      >
        {/* Icon */}
        <div className={cn(toastIconVariants({ variant }))}>{displayIcon}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {title && (
            <div className="text-sm font-semibold mb-1">{title}</div>
          )}
          <div className="text-sm">{message}</div>
          {action && (
            <button
              onClick={action.onClick}
              className="mt-2 text-sm font-medium underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-offset-2 rounded"
            >
              {action.label}
            </button>
          )}
        </div>

        {/* Close button */}
        {dismissible && (
          <button
            onClick={handleDismiss}
            className={cn(toastCloseButtonVariants({ variant }))}
            aria-label="Dismiss toast"
          >
            <CloseIcon />
          </button>
        )}
      </div>
    )
  }
)
Toast.displayName = "Toast"

export { Toast, toastVariants, toastIconVariants, toastCloseButtonVariants }
export { ToastProvider, useToast } from "./toast-provider"
export type { ToastProps, ToastVariant }

