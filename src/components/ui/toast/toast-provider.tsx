"use client"

import * as React from "react"
import { Toast } from "./index"
import { ToastItem, ToastVariant } from "./toast.types"
import "./toast.css"

/**
 * Toast context for managing toast notifications globally
 */
interface ToastContextType {
  showToast: (props: {
    variant?: "info" | "success" | "warning" | "error"
    message: string
    title?: string
    duration?: number | null
    dismissible?: boolean
    action?: {
      label: string
      onClick: () => void
    }
  }) => void
  dismissToast: (id: string) => void
  dismissAll: () => void
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

/**
 * ToastProvider component that manages toast state and provides context
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  const showToast = React.useCallback(
    ({
      variant = "info",
      message,
      title,
      duration = 5000,
      dismissible = true,
      action,
    }: {
      variant?: ToastVariant
      message: string
      title?: string
      duration?: number | null
      dismissible?: boolean
      action?: {
        label: string
        onClick: () => void
      }
    }) => {
      const id = `toast-${Date.now()}-${Math.random()}`
      const newToast: ToastItem = {
        id,
        variant,
        message,
        title,
        duration,
        dismissible,
        action,
        createdAt: Date.now(),
      }

      setToasts((prev) => [...prev, newToast])
    },
    []
  )

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const dismissAll = React.useCallback(() => {
    setToasts([])
  }, [])

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, dismissAll }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

/**
 * Hook to access toast context
 */
export function useToast() {
  const context = React.useContext(ToastContext)
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

/**
 * ToastContainer component that renders all active toasts
 */
function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          variant={toast.variant}
          message={toast.message}
          title={toast.title}
          duration={toast.duration}
          dismissible={toast.dismissible}
          action={toast.action}
          onDismiss={() => onDismiss(toast.id)}
        />
      ))}
    </div>
  )
}

