import { cva } from "class-variance-authority";

export const navCountBubbleVariants = cva(
  "inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium drop-shadow-md min-w-[1.25rem]",
  {
    variants: {
      variant: {
        default: "bg-teal-600 text-white",
        accent: "bg-amber-500 text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);
