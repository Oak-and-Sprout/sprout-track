import * as React from "react"
import { cn } from "@/src/lib/utils"

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, ...props }, ref) => {
    const progress = value || 0;
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn("h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700", className)}
        {...props}
      >
        <div
          className="h-full w-full flex-1 bg-teal-600 transition-all"
          style={{ transform: `translateX(-${100 - progress}%)` }}
        />
      </div>
    )
  }
)
Progress.displayName = "Progress"

export { Progress } 