import { type VariantProps } from "class-variance-authority"
import * as React from "react"
import { toastVariants } from "./toast.styles"

/**
 * Toast variant types
 */
export type ToastVariant = "info" | "success" | "warning" | "error"

/**
 * Props for the Toast component
 *
 * @extends React.HTMLAttributes<HTMLDivElement> - Includes all standard div HTML attributes
 * @extends VariantProps<typeof toastVariants> - Includes variant prop from toastVariants
 */
export interface ToastProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof toastVariants> {
  /**
   * The main message to display in the toast
   */
  message: string

  /**
   * Optional title/heading for the toast
   */
  title?: string

  /**
   * Duration in milliseconds before the toast automatically dismisses
   * Set to 0 or null to prevent auto-dismiss
   *
   * @default 5000
   */
  duration?: number | null

  /**
   * Whether the toast can be dismissed by the user
   *
   * @default true
   */
  dismissible?: boolean

  /**
   * Callback function called when the toast is dismissed
   */
  onDismiss?: () => void

  /**
   * Optional icon to display. If not provided, a default icon will be used based on variant
   */
  icon?: React.ReactNode

  /**
   * Optional action button to display in the toast
   */
  action?: {
    label: string
    onClick: () => void
  }
}

/**
 * Toast context type for managing toast state
 */
export interface ToastContextType {
  /**
   * Show a toast notification
   */
  showToast: (props: Omit<ToastProps, "variant"> & { variant?: ToastVariant }) => void

  /**
   * Dismiss a specific toast by ID
   */
  dismissToast: (id: string) => void

  /**
   * Dismiss all toasts
   */
  dismissAll: () => void
}

/**
 * Internal toast item with unique ID
 */
export interface ToastItem extends ToastProps {
  id: string
  variant: ToastVariant
  createdAt: number
}

