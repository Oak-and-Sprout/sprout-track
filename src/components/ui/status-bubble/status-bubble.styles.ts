export const statusBubbleStyles = {
  base: "absolute top-[-5px] right-[-5px] px-3 py-1 rounded-2xl flex items-center gap-1.5 text-xs font-medium z-50 drop-shadow-md",
  icon: "h-3.5 w-3.5",
  statusStyles: {
    sleeping: {
      bgColor: "bg-gray-700 text-white",
    },
    awake: {
      bgColor: "bg-sky-100 text-sky-900",
      iconColor: "text-amber-500",
    },
    feed: {
      normal: "bg-green-500 text-white",
      warning: "bg-red-500 text-white",
    },
    feedActive: {
      bgColor: "bg-yellow-400 text-yellow-900",
    },
    diaper: {
      normal: "bg-green-500 text-white",
      warning: "bg-red-500 text-white",
    },
    pump: {
      normal: "bg-green-500 text-white",
      warning: "bg-red-500 text-white",
    },
    default: {
      bgColor: "bg-gray-500 text-white",
    }
  }
} as const;
