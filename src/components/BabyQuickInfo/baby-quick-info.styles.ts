import { cn } from "@/src/lib/utils";

/**
 * Styles for the BabyQuickInfo component
 * 
 * These styles define the visual appearance of the baby quick info form
 */

/**
 * Event type colors for light mode
 * These colors match the Calendar component
 */
export const eventTypeColors = {
  APPOINTMENT: '#3b82f6', // blue-500
  CARETAKER_SCHEDULE: '#22c55e', // green-500
  REMINDER: '#eab308', // yellow-500
  CUSTOM: '#a855f7', // purple-500
  DEFAULT: '#6b7280', // gray-500
};

export const styles = {
  // Container styles
  container: "flex flex-col",
  
  // Tab navigation
  tabContainer: "flex flex-row border-b border-gray-200 mb-4 md:justify-start overflow-x-auto",
  tabButton: "py-2 px-4 text-sm font-medium text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors duration-200 focus:outline-none",
  tabButtonActive: "bg-teal-50 text-teal-700 font-medium border-b-2 border-teal-500",
  
  // Tab content
  tabContent: "py-4",
  
  // Loading and error states
  loadingContainer: "flex flex-col items-center justify-center py-12",
  errorContainer: "flex flex-col items-center justify-center py-8",
  
  // Footer
  footerContainer: "flex justify-center",
  
  // Section styling
  sectionContainer: "mb-6 last:mb-0",
  sectionTitle: "text-lg font-semibold text-gray-800 mb-3",
  
  // Notifications tab
  notificationsContainer: "space-y-6",
  
  // Activity items
  activityItem: "flex items-start p-2 rounded-lg bg-gray-50 border border-gray-100 shadow-sm mb-1 last:mb-0",
  activityIconContainer: "flex-shrink-0 p-1.5 mr-2 rounded-full bg-teal-100 text-teal-600",
  activityContent: "flex-1",
  activityTitle: "text-sm font-medium text-gray-800",
  activityTime: "text-xs text-gray-500 mt-1",
  relativeTime: "font-bold underline text-teal-600",
  emptyMessage: "text-sm text-gray-500 italic p-3",
  
  // Contacts tab
  contactsContainer: "space-y-2",
  contactItem: "flex items-start p-3 rounded-lg bg-gray-50 border border-gray-100 shadow-sm mb-2 last:mb-0",
  contactInfo: "flex-1",
  contactName: "text-sm font-medium text-gray-800",
  contactRole: "text-xs text-gray-500",
  contactDetails: "flex flex-wrap gap-2 mt-1",
  contactDetail: "flex items-center text-xs text-gray-600",
  contactIcon: "h-3 w-3 mr-1 text-gray-400",
  
  // Allergens tab
  allergensContainer: "space-y-4",
  allergenItem: "rounded-lg bg-gray-50 border border-gray-100 shadow-sm px-3 py-2",
  allergenName: "font-medium text-sm text-gray-800",
  allergenBadge: "inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700",
  allergenTypeBadge: "inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700",
  allergenSourceTag: "inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600",
  allergenReaction: "text-xs text-gray-600",
  allergenNotes: "text-xs text-gray-600 italic",
  allergenMeta: "text-xs text-gray-500",
  allergenForm: "space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3",
  allergenFormTitle: "text-sm font-semibold text-gray-800",
  allergenFormError: "text-xs text-red-500",

  // Stats tab
  statsContainer: "space-y-4",
  statsGrid: "grid grid-cols-2 gap-4 md:grid-cols-3",
  statCard: "p-3 rounded-lg bg-gray-50 border border-gray-100 shadow-sm",
  statTitle: "text-xs text-gray-500 mb-1",
  statValue: "text-sm font-medium text-gray-800",
  
  // Calendar events
  eventsContainer: "space-y-2 mt-4",
  eventItem: "p-3 rounded-lg bg-gray-50 border border-gray-100 shadow-sm border-l-4",
  eventAppointment: "border-l-blue-500",
  eventCaretakerSchedule: "border-l-green-500",
  eventReminder: "border-l-yellow-500",
  eventCustom: "border-l-purple-500",
  eventDefault: "border-l-gray-500",
  eventTitle: "text-sm font-medium text-gray-800",
  eventTime: "text-xs text-gray-500 mt-1",
  eventLocation: "text-xs text-gray-600 mt-1 flex items-center",
  eventLocationIcon: "h-3 w-3 mr-1 text-gray-400"
};
