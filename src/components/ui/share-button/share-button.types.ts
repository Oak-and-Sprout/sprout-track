import { type VariantProps } from "class-variance-authority"
import * as React from "react"
import { shareButtonVariants } from "./share-button.styles"

/**
 * Props for the ShareButton component
 *
 * @extends React.ButtonHTMLAttributes<HTMLButtonElement> - Includes all standard button HTML attributes
 * @extends VariantProps<typeof shareButtonVariants> - Includes variant and size props from shareButtonVariants
 */
export interface ShareButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof shareButtonVariants> {
  /**
   * The family slug to generate the share URL
   */
  familySlug: string;
  
  /**
   * Optional family name for the share content
   */
  familyName?: string;
  
  /**
   * Optional app config to avoid API calls (for performance)
   * If not provided, will fetch from API
   */
  appConfig?: {
    rootDomain: string;
    enableHttps: boolean;
  };
  
  /**
   * Optional URL suffix to append to the path
   * 
   * @default "" - Direct family URLs (no suffix)
   * @example 
   * - "" - Direct family URLs (default)
   * - "/dashboard" - Custom suffix
   */
  urlSuffix?: string;
  
  /**
   * Whether to show the text label next to the icon
   *
   * @default true
   */
  showText?: boolean;
  
  /**
   * When true, the button will render its children as a slot
   * Useful for custom button implementations
   *
   * @default false
   */
  asChild?: boolean;
} 