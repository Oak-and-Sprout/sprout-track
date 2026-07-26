import { cva } from "class-variance-authority"

/**
 * Checkbox variant styles using class-variance-authority
 * Defines all visual variations of the checkbox component
 *
 * This uses TailwindCSS classes for styling and follows the project's design system
 * When adapting to React Native, these styles will need to be converted to React Native StyleSheet
 * or a compatible styling solution like NativeWind
 *
 * @see https://cva.style/docs for more information on class-variance-authority
 */
export const checkboxVariants = cva(
  "h-5 w-5 rounded border flex items-center justify-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-gray-300 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500",
        primary: "border-teal-300 data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500",
        secondary: "border-slate-300 data-[state=checked]:bg-slate-500 data-[state=checked]:border-slate-500",
        success: "border-emerald-300 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500",
        warning: "border-amber-300 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500",
        danger: "border-red-300 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500",
        info: "border-blue-300 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500",
      },
      size: {
        default: "h-5 w-5",
        sm: "h-4 w-4",
        lg: "h-6 w-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
