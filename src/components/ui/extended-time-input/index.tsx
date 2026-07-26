import * as React from "react";
import { cn } from "@/src/lib/utils";
import { timeInputStyles } from "../time-input/time-input.styles";
import { TimeInputProps } from "../time-input/time-input.types";
import { useTheme } from "@/src/context/theme";
import { AlertCircle, Check } from "lucide-react";
import "../time-input/time-input.css";

/**
 * ExtendedTimeInput component for entering time values in DD:HH:MM format
 * Provides validation and formatting for extended time inputs
 */
const ExtendedTimeInput = React.forwardRef<HTMLInputElement, TimeInputProps>(
  ({ className, value, onChange, onBlur, errorMessage, showValidation = true, ...props }, ref) => {
    const { theme } = useTheme();
    const [isValid, setIsValid] = React.useState(true);
    const [internalValue, setInternalValue] = React.useState<string>(value as string || "");
    
    // Regular expression for DD:HH:MM format (00:00:00 to 99:23:59)
    const timeRegex = /^([0-9]{1,2}):([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
    
    // Validate the time format
    const validateTimeFormat = (timeString: string): boolean => {
      if (!timeString) return true; // Empty is considered valid (for optional fields)
      return timeRegex.test(timeString);
    };
    
    // Format the input as the user types
    const formatTimeInput = (input: string): string => {
      // Remove any non-digit characters
      const digitsOnly = input.replace(/\D/g, "");
      
      // Format as DD:HH:MM
      if (digitsOnly.length <= 2) {
        return digitsOnly;
      } else if (digitsOnly.length <= 4) {
        return `${digitsOnly.substring(0, 2)}:${digitsOnly.substring(2)}`;
      } else if (digitsOnly.length <= 6) {
        return `${digitsOnly.substring(0, 2)}:${digitsOnly.substring(2, 4)}:${digitsOnly.substring(4)}`;
      } else {
        return `${digitsOnly.substring(0, 2)}:${digitsOnly.substring(2, 4)}:${digitsOnly.substring(4, 6)}`;
      }
    };
    
    // Handle input change
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      
      // Format the input value
      const formattedValue = formatTimeInput(rawValue);
      setInternalValue(formattedValue);
      
      // Create a synthetic event with the formatted value
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          name: e.target.name, // Ensure the name is preserved
          value: formattedValue
        }
      };
      
      // Call the original onChange handler if provided
      if (onChange) {
        onChange(syntheticEvent as React.ChangeEvent<HTMLInputElement>);
      }
      
      // Log the event for debugging
      console.log('ExtendedTimeInput onChange:', {
        name: e.target.name,
        value: formattedValue
      });
    };
    
    // Validate on blur
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const isTimeValid = validateTimeFormat(internalValue);
      setIsValid(isTimeValid);
      
      // If the value is valid but empty, set it to a default value
      if (isTimeValid && internalValue === "") {
        // Don't set a default value, just leave it empty
      } else if (!isTimeValid) {
        // If invalid, clear the value
        setInternalValue("");
        
        // Create a synthetic event with the empty value
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: ""
          }
        };
        
        // Call the original onChange handler if provided
        if (onChange) {
          onChange(syntheticEvent as React.ChangeEvent<HTMLInputElement>);
        }
      }
      
      // Call the original onBlur handler if provided
      if (onBlur) {
        onBlur(e);
      }
    };
    
    // Determine the validation state classes
    const getValidationClasses = () => {
      if (!showValidation) return "";
      
      if (internalValue && !isValid) {
        return timeInputStyles.error + " time-input-error";
      }
      
      if (internalValue && isValid) {
        return timeInputStyles.valid + " time-input-valid";
      }
      
      return "";
    };
    
    // Update internal value when external value changes
    React.useEffect(() => {
      if (value !== undefined && value !== null) {
        setInternalValue(value as string);
      }
    }, [value]);
    
    return (
      <div className={timeInputStyles.container}>
        <div className="relative">
          <input
            type="text"
            className={cn(
              timeInputStyles.base,
              getValidationClasses(),
              className,
              "time-input-dark"
            )}
            name={props.name} // Explicitly set the name attribute
            value={internalValue}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="DD:HH:MM (e.g., 01:06:00)"
            maxLength={8}
            ref={ref}
            {...props}
          />
          
          {/* Validation icons */}
          {showValidation && internalValue && (
            <>
              {isValid ? (
                <Check className="absolute right-3 top-3 h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-red-500" />
              )}
            </>
          )}
        </div>
        
        {/* Error message */}
        {showValidation && !isValid && errorMessage && (
          <div className={timeInputStyles.errorMessage}>
            <AlertCircle className="h-3 w-3 inline mr-1" aria-hidden="true" />
            {errorMessage}
          </div>
        )}
      </div>
    );
  }
);

ExtendedTimeInput.displayName = "ExtendedTimeInput";

export { ExtendedTimeInput };
