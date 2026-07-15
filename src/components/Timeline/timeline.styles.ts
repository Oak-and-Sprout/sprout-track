import { cva } from "class-variance-authority";

/**
 * Styles for the Timeline component
 * 
 * These styles define the visual appearance of the timeline
 */

export const styles = {
  // Container styles
  // app header (80px + 1px border) + activity tile row (117px) + 1px rounding margin
  container: "flex flex-col h-[calc(100vh-199px)]",
  
  // Content styles
  content: "flex-1 overflow-y-auto bg-white",
  activityList: "divide-y divide-gray-100 min-h-full",
  
  // Activity item styles
  activityItem: "group hover:bg-gray-50/50 transition-colors duration-200 cursor-pointer",
  activityContent: "flex items-center px-6 py-3",
  activityIcon: "flex-shrink-0 p-2 rounded-xl mr-4",
  activityDetails: "min-w-0 flex-1",
  activityType: "inline-flex items-center rounded-md bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10",
  activityInfo: "text-gray-900",
  
  // Empty state styles
  emptyState: "h-full flex items-center justify-center",
  emptyStateContent: "text-center",
  emptyStateIcon: "w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-100 flex items-center justify-center",
  emptyStateIconInner: "h-8 w-8 text-indigo-600",
  emptyStateTitle: "text-lg font-medium text-gray-900 mb-1",
  emptyStateDescription: "text-sm text-gray-500",
  
  // Loading state styles
  loadingContainer: "h-full flex items-center justify-center",
  loadingContent: "text-center",
  loadingIcon: "w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center",
  loadingIconInner: "animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full",
  loadingText: "text-lg font-medium text-gray-900 mb-1",
};

// Export the styles
export default styles;
