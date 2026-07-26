'use client';

import * as React from 'react';
import { cn } from '@/src/lib/utils';
import { Check } from 'lucide-react';
import { useTheme } from '@/src/context/theme';

import { checkboxVariants } from './checkbox.styles';
import { CheckboxProps } from './checkbox.types';
import './checkbox.css';

/**
 * Checkbox component
 * 
 * A custom checkbox component with a styled appearance that follows the project's design system.
 * It's designed to be cross-platform compatible with minimal changes required for React Native.
 *
 * Features:
 * - Multiple visual variants (default, primary, secondary, etc.)
 * - Multiple size options (default, sm, lg)
 * - Support for all standard input HTML attributes
 * - Accessible focus states with keyboard navigation support
 *
 * @example
 * ```tsx
 * <Checkbox 
 *   variant="primary" 
 *   size="lg" 
 *   checked={isChecked} 
 *   onCheckedChange={setIsChecked} 
 * />
 * ```
 */
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, variant, size, checked, onCheckedChange, id, ...props }, ref) => {
    const { theme } = useTheme();
    const generatedId = React.useId();
    const checkboxId = id ?? generatedId;
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    const setRefs = (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      }
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (onCheckedChange) {
        onCheckedChange(event.target.checked);
      }
    };

    // The visual box is a span (not a label) so call sites that wrap <Checkbox>
    // in their own <label> don't produce invalid nested labels; preventDefault
    // stops such a wrapping label from also forwarding the click (double toggle)
    const handleBoxClick = (event: React.MouseEvent<HTMLSpanElement>) => {
      event.preventDefault();
      inputRef.current?.click();
    };

    return (
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          id={checkboxId}
          className="peer sr-only checkbox-input"
          ref={setRefs}
          checked={checked}
          onChange={handleChange}
          {...props}
        />
        <span
          onClick={handleBoxClick}
          aria-hidden="true"
          className={cn(
            checkboxVariants({ variant, size }),
            checked ? "" : "bg-white",
            className,
            "checkbox",
            `checkbox-${variant || 'default'}`
          )}
          data-state={checked ? "checked" : "unchecked"}
        >
          {checked && <Check className="h-3.5 w-3.5 text-white checkbox-check" />}
        </span>
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export { Checkbox, checkboxVariants };
export type { CheckboxProps };
export default Checkbox;
