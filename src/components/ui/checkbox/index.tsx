'use client';

import * as React from 'react';
import { cn } from '@/src/lib/utils';
import { Check } from 'lucide-react';
import { useTheme } from '@/src/context/theme';

import { checkboxVariants } from './checkbox.styles';
import { CheckboxProps } from './checkbox.types';
import './checkbox.css';
import { Label } from '../label';

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
  ({ className, variant, size, checked, onCheckedChange, ...props }, ref) => {
    useTheme();

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (onCheckedChange) {
        onCheckedChange(event.target.checked);
      }
    };

    return (
      <div className="relative inline-flex items-center">
        <input
          id={props.id}
          type="checkbox"
          className="sr-only"
          ref={ref}
          checked={checked}
          onChange={handleChange}
          {...props}
        />
        <Label htmlFor={props.id}
          className={cn(
            checkboxVariants({ variant, size }),
            checked ? "" : "bg-white",
            className,
            "checkbox",
            `checkbox-${variant || 'default'}`
          )}
          data-state={checked ? "checked" : "unchecked"}
          onClick={() => onCheckedChange?.(!checked)}
        >
          {checked && <Check className="h-3.5 w-3.5 text-white checkbox-check" />}
        </Label>
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export { Checkbox, };

export default Checkbox;

export { checkboxVariants } from './checkbox.styles';
export { type CheckboxProps } from './checkbox.types';