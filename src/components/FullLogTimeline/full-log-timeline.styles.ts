import { cva } from "class-variance-authority";

/**
 * Styles for the FullLogTimeline component
 * 
 * These styles define the visual appearance of the full log timeline
 */

export const styles = {
  // Search styles
  search: {
    bar: "border-t border-gray-200 bg-gray-100 p-3",
    container: "bg-white px-2 py-1",
    input: "border-0 bg-transparent focus:ring-0 focus:border-0 h-8 px-0 py-1",
  },
  // Container styles
  container: "flex flex-col h-[calc(100vh-80px)]",
  
  // Header styles - now inline in the component
  // header: "py-2 bg-gradient-to-r from-teal-600 to-teal-700 border-0",
  // headerContent: "flex flex-col gap-4",
  // headerRow: "flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4",
  
  // Filter styles - now inline in the component
  // filterContainer: "flex justify-center sm:justify-start",
  // filterGroup: "flex gap-1",
  // filterButton: "h-8 w-8",
  // filterButtonActive: "border-2 border-blue-500 bg-white",
  // filterButtonInactive: "bg-gray-100 hover:bg-gray-200",
  
  // Quick filter styles - now inline in the component
  // quickFilterContainer: "flex justify-center sm:justify-end",
  // quickFilterGroup: "flex gap-2",
  // quickFilterButton: "bg-gray-100 hover:bg-gray-200 text-teal-700",
  
  // Date range styles - now inline in the component
  // dateRangeContainer: "flex justify-center items-center",
  // dateRangeWrapper: "flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2",
  // dateInput: "h-8 px-2 rounded-md border border-gray-200 text-sm bg-gray-100 hover:bg-gray-200 text-teal-700",
  
  // Content styles
  content: "flex-1 overflow-y-auto bg-white",
  activityList: "divide-y divide-gray-100 h-full",
  
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
  
  // Pagination styles
  paginationContainer: "flex justify-between items-center px-6 py-4 border-t border-gray-100 bg-gray-50",
  paginationSelect: "h-8 px-2 rounded-md border border-gray-200 text-sm",
  paginationControls: "flex items-center gap-2",
  paginationText: "px-4 py-2 text-sm",
  
  // Calendar styles - now inline in the component
  // calendarContainer: "w-full",
};

// Export the styles
export default styles;
