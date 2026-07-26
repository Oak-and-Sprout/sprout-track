import { cn } from "@/src/lib/utils";

/**
 * Styles for the BabySelector component
 * 
 * These styles define the visual appearance of the baby selector
 * and its various states
 */

/**
 * Container styles for the baby selector
 * 
 * @param gender - The gender of the selected baby
 * @returns A string of TailwindCSS classes
 */
export const babySelectorContainer = (gender: 'MALE' | 'FEMALE' | null | undefined) => {
  return cn(
    "h-auto py-1 px-2 text-white transition-colors duration-200 flex items-center space-x-2 rounded-full",
    gender === 'MALE' ? 'bg-blue-500' : gender === 'FEMALE' ? 'bg-rose-300' : ''
  );
};

/**
 * Content container styles for the baby selector
 * 
 * @returns A string of TailwindCSS classes
 */
export const babySelectorContent = () => {
  return cn(
    "flex flex-col items-start cursor-pointer text-left"
  );
};

/**
 * Name container styles for the baby selector
 * 
 * @returns A string of TailwindCSS classes
 */
export const babySelectorNameContainer = () => {
  return cn(
    "flex items-center ml-2 space-x-1"
  );
};

/**
 * Name text styles for the baby selector
 * 
 * @returns A string of TailwindCSS classes
 */
export const babySelectorName = () => {
  return cn(
    "text-sm font-medium"
  );
};

/**
 * Age text styles for the baby selector
 * 
 * @returns A string of TailwindCSS classes
 */
export const babySelectorAge = () => {
  return cn(
    "text-xs opacity-80 ml-2"
  );
};

/**
 * Dropdown button styles for the baby selector
 * 
 * @returns A string of TailwindCSS classes
 */
export const babySelectorDropdownButton = () => {
  return cn(
    "h-8 w-8 rounded-full flex items-center justify-center",
    "bg-white/10 hover:bg-white/20 transition-colors duration-200",
    "ml-1 p-1"
  );
};

/**
 * Dropdown item styles for the baby selector
 * 
 * @param gender - The gender of the baby
 * @returns A string of TailwindCSS classes
 */
export const babySelectorDropdownItem = (gender: 'MALE' | 'FEMALE' | null | undefined) => {
  return cn(
    gender === 'MALE' ? 'bg-blue-500/10 hover:bg-blue-500/20' : 
    gender === 'FEMALE' ? 'bg-pink-500/10 hover:bg-pink-500/20' : ''
  );
};
