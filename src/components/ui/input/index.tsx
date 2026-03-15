import * as React from "react"
import { cn } from "@/src/lib/utils"
import { inputStyles } from "./input.styles"
import { InputProps } from "./input.types"
import { useTheme } from "@/src/context/theme"
import "./input.css"

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onChange, inputMode, ...props }, ref) => {
    const { theme } = useTheme();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (inputMode === 'decimal' && e.target.value.includes(',')) {
        if (e.target.value.includes('.')) {
          // Comma is a thousands separator (e.g., "1,200.38" → "1200.38")
          e.target.value = e.target.value.replace(/,/g, '');
        } else {
          // Comma is a decimal separator (e.g., "1,5" → "1.5")
          e.target.value = e.target.value.replace(',', '.');
        }
      }
      onChange?.(e);
    };

    return (
      <input
        type={type}
        inputMode={inputMode}
        className={cn(inputStyles.base, className, "input-dark")}
        ref={ref}
        onChange={handleChange}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
