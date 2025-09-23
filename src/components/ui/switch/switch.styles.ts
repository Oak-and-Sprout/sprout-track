/**
 * Styles for the Switch component (light mode)
 * 
 * These styles use TailwindCSS classes and follow the project's design system.
 * When adapting to React Native, these styles will need to be converted to React Native StyleSheet
 * or a compatible styling solution like NativeWind.
 */
export const switchStyles = {
  // Base styles for the switch container
  base: "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2",
  
  // Styles for checked state
  checked: "bg-teal-600",
  
  // Styles for unchecked state
  unchecked: "bg-gray-200",
  
  // Green variant styles
  greenChecked: "bg-emerald-500",
  greenUnchecked: "bg-emerald-600",
  
  // Styles for disabled state
  disabled: "opacity-50 cursor-not-allowed",
  
  // Styles for the thumb (the moving part)
  thumb: "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
  
  // Styles for thumb in checked state
  thumbChecked: "translate-x-5",
  
  // Styles for thumb in unchecked state
  thumbUnchecked: "translate-x-0",
};
