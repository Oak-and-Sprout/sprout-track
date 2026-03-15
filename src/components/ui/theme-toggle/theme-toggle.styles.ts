import { cva } from "class-variance-authority";

/**
 * Theme toggle styles using class-variance-authority
 * Defines all visual variations of the theme toggle component
 *
 * This uses TailwindCSS classes for styling and follows the project's design system
 * Light mode styles are defined here, dark mode equivalents in theme-toggle.css
 */
export const themeToggleStyles = {
  // Main button - light mode styling
  button: "flex items-center px-3 py-2 text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors duration-200 rounded-lg w-full",
  
  // Light variant button - simplified styling
  buttonLight: "flex items-center text-white hover:text-teal-700 transition-colors duration-200",

  // Minimal variant button - gray-200 in both modes
  buttonMinimal: "flex items-center text-gray-200 hover:text-teal-700 transition-colors duration-200",
  
  // Theme icon styles are defined in CSS for better control of the circle indicator
};

/**
 * Theme toggle button variants using class-variance-authority
 */
export const themeToggleVariants = cva(
  "flex items-center justify-center cursor-pointer transition-all duration-300 ease-in-out",
  {
    variants: {
      theme: {
        light: "",
        dark: "",
        system: "",
      },
      variant: {
        default: "",
        light: "",
        minimal: "",
      },
    },
    defaultVariants: {
      theme: "light",
      variant: "default",
    },
  }
);
