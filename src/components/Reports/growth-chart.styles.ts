/**
 * Styles for the GrowthChart component
 *
 * Light mode styles defined here, dark mode overrides in reports.css
 */

export const growthChartStyles = {
  // Main container
  container: "flex flex-col space-y-4",

  // Top controls row (measurement buttons on left, zoom controls on right)
  controlsRow: "flex items-center justify-between gap-4 flex-wrap",

  // Button group for measurement type selection
  buttonGroup: "flex flex-wrap gap-2 justify-start",
  button: "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors",
  buttonActive: "bg-teal-50 border-teal-500 text-teal-700 hover:bg-teal-100",

  // Zoom controls
  zoomControls: "flex items-center gap-2 justify-end",
  zoomButton: "p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  zoomLabel: "text-sm text-gray-500 min-w-[3rem] text-center",

  // Chart wrapper
  chartWrapper: "bg-white rounded-lg border border-gray-200 p-4 touch-none select-none",

  // Loading state
  loadingContainer: "flex flex-col items-center justify-center py-12",
  loadingText: "mt-2 text-gray-600",

  // Error state
  errorContainer: "flex flex-col items-center justify-center py-8",
  errorText: "text-red-500 mb-2",

  // Empty state
  emptyContainer: "flex flex-col items-center justify-center py-12",
  emptyText: "text-gray-500 text-center",

  // Tooltip styles
  tooltip: "bg-white border border-gray-200 rounded-lg shadow-lg p-3",
  tooltipLabel: "font-medium text-gray-800 mb-1",
  tooltipMeasurement: "text-xs font-semibold text-orange-600",
  tooltipPercentile: "text-teal-600 font-medium mb-2",
  tooltipPercentiles: "text-xs space-y-0.5",

  // Measurements list with percentiles
  measurementsList: "mt-4 bg-gray-50 rounded-lg border border-gray-100 p-4",
  measurementsTitle: "text-sm font-semibold text-gray-700 mb-3",
  measurementsGrid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3",
  measurementItem: "bg-white rounded-lg border border-gray-200 p-3 shadow-sm",
  measurementValue: "text-lg font-bold text-gray-800",
  measurementPercentile: "text-sm font-medium text-teal-600",
  measurementAge: "text-xs text-gray-500 mt-1",
  measurementDate: "text-xs text-gray-400",

  // Legend info
  legendInfo: "text-center pt-2",
  legendText: "text-sm font-medium text-gray-700",
  legendSubtext: "text-xs text-gray-500 mt-1 max-w-lg mx-auto",

  // No data message
  noDataMessage: "text-center py-4 text-gray-500 bg-gray-50 rounded-lg border border-gray-100",
};
