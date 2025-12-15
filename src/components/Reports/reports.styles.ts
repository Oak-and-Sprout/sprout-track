/**
 * Styles for the Reports component
 *
 * These styles define the visual appearance of the reports page
 */

export const styles = {
  // Main container
  container: "flex flex-col min-h-full bg-white",

  // Header section with date range picker
  header: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border-b border-gray-200",
  headerTitle: "text-lg font-semibold text-gray-800",

  // Date range picker container
  dateRangeContainer: "flex flex-col sm:flex-row items-start sm:items-center gap-2",
  dateRangeLabel: "text-sm font-medium text-gray-600",
  dateRangeButton: "flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors",
  dateRangeIcon: "h-4 w-4 text-gray-500",

  // Tab container
  tabContainer: "px-4 pt-4",

  // Tab content area
  tabContent: "flex-1 overflow-y-auto p-4",

  // Loading state
  loadingContainer: "flex flex-col items-center justify-center py-12",
  loadingText: "mt-2 text-gray-600",

  // Error state
  errorContainer: "flex flex-col items-center justify-center py-8",
  errorText: "text-red-500 mb-2",

  // Empty state
  emptyContainer: "flex flex-col items-center justify-center py-12",
  emptyText: "text-gray-500 text-center",

  // Stats grid
  statsGrid: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4",

  // Stat card
  statCard: "p-4 rounded-lg bg-gray-50 border border-gray-100 shadow-sm",
  statCardIcon: "h-5 w-5 mb-2",
  statCardValue: "text-2xl font-bold text-gray-800",
  statCardLabel: "text-sm text-gray-600 mt-1",
  statCardSubLabel: "text-xs text-gray-500 mt-0.5",

  // Accordion section
  accordionSection: "mb-4",
  accordionTrigger: "flex items-center gap-2 w-full py-3 px-4 text-left font-medium text-gray-800 hover:bg-gray-50 rounded-lg transition-colors",
  accordionTriggerIcon: "h-5 w-5 text-gray-600",
  accordionContent: "pt-2 pb-4 px-4",

  // Section title within accordion
  sectionTitle: "text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2",
  sectionTitleIcon: "h-4 w-4",

  // Location list
  locationList: "space-y-2",
  locationItem: "flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 border border-gray-100",
  locationName: "text-sm font-medium text-gray-700",
  locationCount: "text-sm text-gray-500",

  // Medicine list
  medicineList: "space-y-2",
  medicineItem: "flex items-center justify-between py-2 px-3 rounded-lg bg-white border border-gray-100",
  medicineName: "text-sm font-medium text-gray-700",
  medicineDetails: "text-sm text-gray-500",

  // Placeholder tab content
  placeholderContainer: "flex flex-col items-center justify-center py-16",
  placeholderIcon: "h-16 w-16 text-gray-300 mb-4",
  placeholderTitle: "text-lg font-medium text-gray-600 mb-2",
  placeholderText: "text-sm text-gray-500 text-center max-w-md",

  // Calendar popover
  calendarPopover: "p-0 w-auto",

  // No baby selected state
  noBabyContainer: "flex flex-col items-center justify-center py-16",
  noBabyIcon: "h-16 w-16 text-gray-300 mb-4",
  noBabyText: "text-lg font-medium text-gray-600",
};

// Activity chart specific styles
export const activityChartStyles = {
  container: "w-full flex flex-col",
  scrollArea: "relative w-full overflow-auto pb-4 px-2",
  daysRow: "inline-flex flex-row gap-4 items-start",
  dayColumn: "flex-shrink-0 flex flex-col items-stretch",
  dayHeader: "mb-2 text-center sticky top-0 bg-white z-10 py-1",
  dayLabel: "text-xs font-medium text-gray-600",
  dayChartWrapper: "relative border-2 border-gray-300 rounded bg-gray-50",
  grid: "absolute inset-0 flex flex-col",
  gridRow: "flex-1 border-t border-gray-100",
  gridRowHour: "border-t-2 border-gray-200",
  gridRowHalfHour: "border-t border-gray-100",
  eventsLayer: "absolute inset-1",
  eventBlock: "absolute right-1 rounded-md shadow-sm cursor-pointer opacity-90 hover:opacity-100 transition-opacity duration-150 focus:outline-none",
  tooltip: "absolute z-30 -translate-y-1/2 translate-x-2 max-w-xs rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg",
  tooltipTitle: "text-xs font-semibold text-gray-800 mb-1",
  tooltipBody: "space-y-0.5 text-gray-700",
};

// Tab styles (extending form-page tab styles)
export const tabStyles = {
  // Tab container
  tabContainer: "flex flex-row border-b border-gray-200 overflow-x-auto scrollbar-hide -webkit-overflow-scrolling-touch",

  // Individual tab button
  tabButton: "flex items-center gap-2 py-3 px-4 mx-1 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-0 rounded-t-lg border-b-2 border-transparent whitespace-nowrap focus:border-b-teal-500",

  // Active tab button
  tabButtonActive: "text-teal-700 bg-teal-50 border-b-teal-500 hover:text-teal-800 hover:bg-teal-100",

  // Tab icon
  tabIcon: "h-4 w-4 flex-shrink-0",
};
