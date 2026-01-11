import * as React from "react"
import { cn } from "@/src/lib/utils"
import { useTheme } from "@/src/context/theme"
import { 
  inputButtonVariants, 
  inputButtonInputStyles, 
  inputButtonButtonStyles, 
  inputButtonContainerStyles,
  inputButtonErrorStyles 
} from "./input-button.styles"
import { InputButtonProps } from "./input-button.types"
import { useLocalization } from '@/src/context/localization';

import "./input-button.css"

/**
 * InputButton component that combines an input field with a button
 * 
 * This component merges the styling patterns from both the Input and Button components
 * and supports multiple layout configurations (left, right, below).
 * 
 * Features:
 * - Multiple layout options (button left, right, or below input)
 * - All button variants and sizes from the Button component
 * - All input functionality from the Input component
 * - Email validation support
 * - Error state handling
 * - Dark mode support
 * - Accessibility features
 * 
 * @example
 * ```tsx
 * <InputButton
 *   layout="right"
 *   buttonText="Subscribe"
 *   buttonVariant="success"
 *   type="email"
 *   placeholder="Enter your email"
 *   onButtonClick={handleSubmit}
 * />
 * ```
 */
const InputButton = React.forwardRef<HTMLInputElement, InputButtonProps>(
  ({ 
    className,
    layout = "right",
    size = "default",
    buttonText,
    buttonVariant = "default",
    buttonSize = "default",
    onButtonClick,
    inputClassName,
    buttonClassName,
    containerClassName,
    buttonDisabled = false,
    buttonLoading = false,
    error,
    ...props 
  }, ref) => {
    const { theme } = useTheme();
    const { t } = useLocalization();
    
    // Generate dark mode classes
    const inputDarkClass = "input-button-input-dark"
    const buttonDarkClass = buttonVariant === 'outline' ? 'input-button-button-dark-outline' : 
                           buttonVariant === 'ghost' ? 'input-button-button-dark-ghost' : 
                           buttonVariant === 'link' ? 'input-button-button-dark-link' : 
                           buttonVariant === 'secondary' ? 'input-button-button-dark-secondary' : ''
    const errorDarkClass = "input-button-error-dark"
    
    // Generate input styles based on layout
    const getInputStyles = () => {
      const baseStyles = [inputButtonInputStyles.base]
      
      if (layout === "left") {
        baseStyles.push(inputButtonInputStyles.left)
      } else if (layout === "right") {
        baseStyles.push(inputButtonInputStyles.right)
      } else {
        baseStyles.push(inputButtonInputStyles.below)
      }
      
      if (error) {
        baseStyles.push(inputButtonInputStyles.error)
      }
      
      return cn(...baseStyles)
    }
    
    // Generate button styles based on layout and variant
    const getButtonStyles = () => {
      const baseStyles = [inputButtonButtonStyles.base]
      
      // Add variant styles
      if (buttonVariant && buttonVariant in inputButtonButtonStyles.variants) {
        baseStyles.push(inputButtonButtonStyles.variants[buttonVariant as keyof typeof inputButtonButtonStyles.variants])
      }
      
      // Add size styles
      if (buttonSize && buttonSize in inputButtonButtonStyles.sizes) {
        baseStyles.push(inputButtonButtonStyles.sizes[buttonSize as keyof typeof inputButtonButtonStyles.sizes])
      }
      
      // Add layout-specific styles
      if (layout === "left") {
        baseStyles.push(inputButtonButtonStyles.left)
      } else if (layout === "right") {
        baseStyles.push(inputButtonButtonStyles.right)
      } else {
        baseStyles.push(inputButtonButtonStyles.below)
      }
      
      return cn(...baseStyles)
    }
    
    // Container wrapper
    const containerClass = cn(
      inputButtonVariants({ layout, size }),
      containerClassName,
      `input-button-${layout}`
    )
    
    // Input element
    const inputElement = (
      <input
        ref={ref}
        className={cn(
          getInputStyles(),
          inputDarkClass,
          inputClassName
        )}
        {...props}
      />
    )
    
    // Button element
    const buttonElement = (
      <button
        type="button"
        disabled={buttonDisabled || buttonLoading}
        onClick={onButtonClick}
        className={cn(
          getButtonStyles(),
          buttonDarkClass,
          buttonClassName
        )}
      >
        {buttonLoading ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {t('Loading...')}
          </span>
        ) : (
          buttonText
        )}
      </button>
    )
    
    return (
      <div className="flex flex-col">
        <div className={containerClass}>
          {layout === "left" && buttonElement}
          {inputElement}
          {layout === "right" && buttonElement}
          {layout === "below" && buttonElement}
        </div>
        {error && (
          <div className={cn(inputButtonErrorStyles, errorDarkClass)}>
            {error}
          </div>
        )}
      </div>
    )
  }
)

InputButton.displayName = "InputButton"

export { InputButton }
export type { InputButtonProps }
