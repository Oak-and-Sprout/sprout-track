/**
 * Styles for the Monthly Report Card component (light mode)
 * Dark mode overrides are in monthly-report-card.css
 */

export const reportCardStyles = {
  // Main container
  container: 'max-w-2xl mx-auto py-4 px-4',

  // Header
  header: 'flex items-center gap-4 mb-4',
  avatar: 'w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center text-xl font-medium text-emerald-700 flex-shrink-0',
  headerInfo: 'flex-1 min-w-0',
  headerName: 'font-medium text-xl text-gray-900 truncate',
  headerAge: 'text-sm text-gray-500 mt-0.5',
  pdfButton: 'px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-800 text-xs font-medium cursor-pointer hover:bg-emerald-100 transition-colors flex items-center gap-1.5 flex-shrink-0',

  // Month selector
  monthSelector: 'flex items-center gap-1.5 mb-6',
  monthButton: 'w-8 h-8 rounded-full flex items-center justify-center border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none',
  monthStrip: 'flex-1 overflow-hidden relative h-11 flex items-center',
  monthCard: 'flex flex-col items-center justify-center w-full',
  monthLabel: 'text-lg font-medium text-gray-900 leading-tight',
  monthSub: 'text-xs text-gray-500',

  // Section heading
  sectionHeading: 'text-base font-medium text-gray-900 mb-2.5',

  // Metric grid
  metricGrid4: 'grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6',
  metricGrid3: 'grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-6',
  metricCard: 'bg-gray-50 rounded-lg p-3',
  metricLabel: 'text-xs text-gray-500 m-0',
  metricValue: 'text-xl font-medium text-gray-900 mt-1 mb-0.5',
  metricSub: 'text-xs m-0',
  metricSubPositive: 'text-emerald-600',
  metricSubNeutral: 'text-gray-500',
  metricSubWarning: 'text-amber-600',
  metricSubDanger: 'text-red-500',

  // Card (bordered container for charts/tables)
  card: 'bg-white border border-gray-200 rounded-xl p-3 sm:p-4 mb-6',
  cardTitle: 'text-sm font-medium text-gray-500 mb-1 m-0',

  // Charts row (2-column layout for sleep section)
  chartsRow: 'grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6',

  // Feeding breakdown bar
  breakdownBar: 'flex h-4 rounded-full overflow-hidden mb-2',
  breakdownLegend: 'flex flex-wrap gap-4 text-xs text-gray-500',
  breakdownLegendItem: 'flex items-center gap-1',
  breakdownDot: 'w-2 h-2 rounded-sm',

  // Chart legend
  chartLegend: 'flex flex-wrap gap-2 text-xs text-gray-500 mt-1.5',
  chartLegendItem: 'flex items-center gap-1',

  // Doctor callout (amber banner)
  doctorCallout: 'bg-amber-50 rounded-lg px-3.5 py-2.5 mb-6 text-sm text-amber-800',
  doctorCalloutBold: 'font-medium',

  // Milestone row
  milestoneList: 'flex flex-col gap-2 mb-6',
  milestoneRow: 'flex items-center gap-2.5 px-3.5 py-2.5 bg-white border border-gray-200 rounded-lg',
  milestoneBadge: 'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0',
  milestoneInfo: 'flex-1 min-w-0',
  milestoneTitle: 'text-sm font-medium text-gray-900 m-0 truncate',
  milestoneSub: 'text-xs text-gray-500 mt-0.5 m-0',
  milestoneEmpty: 'text-sm text-gray-400 italic',

  // Health table
  healthTable: 'w-full text-sm',
  healthRow: 'border-b border-gray-100',
  healthRowLast: '',
  healthCellName: 'py-1.5 text-gray-500',
  healthCellValue: 'py-1.5 text-right text-gray-900',
  healthCellBadge: 'py-1.5 text-right w-16',
  complianceBadge: 'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
  complianceGreen: 'bg-emerald-50 text-emerald-800',
  complianceAmber: 'bg-amber-50 text-amber-800',
  complianceRed: 'bg-red-50 text-red-700',

  // Caretaker table
  caretakerTable: 'w-full text-sm',
  caretakerCellName: 'py-1.5 text-gray-500',
  caretakerCellLogs: 'py-1.5 text-right text-gray-900',
  caretakerCellPct: 'py-1.5 text-right w-12 text-gray-500 text-xs',

  // Footer
  footer: 'border-t border-gray-200 pt-4 mt-2 flex flex-col sm:flex-row justify-between items-center gap-2',
  footerBrand: 'text-xs text-gray-400 m-0',

  // Loading / Error / Empty
  loading: 'flex flex-col items-center justify-center py-12',
  loadingText: 'mt-2 text-gray-500 text-sm',
  error: 'flex flex-col items-center justify-center py-8',
  errorText: 'text-red-500 mb-2 text-sm',
  emptyState: 'text-center py-12 text-gray-400',
  emptyText: 'text-base font-medium',
  emptySub: 'text-sm mt-1',

  // No data placeholder per section
  noData: 'text-sm text-gray-400 italic mb-6',
};

// Milestone badge colors by category
export const milestoneBadgeColors: Record<string, { bg: string; text: string; letter: string }> = {
  MOTOR: { bg: '#EEEDFE', text: '#534AB7', letter: 'M' },
  LANGUAGE: { bg: '#E6F1FB', text: '#185FA5', letter: 'L' },
  SOCIAL: { bg: '#FBEAF0', text: '#993556', letter: 'S' },
  COGNITIVE: { bg: '#E1F5EE', text: '#0F6E56', letter: 'C' },
  CUSTOM: { bg: '#F3F4F6', text: '#6B7280', letter: '★' },
};

// Chart colors
export const chartColors = {
  bottle: '#85B7EB',
  breast: '#5DCAA5',
  solids: '#FAC775',
  excellent: '#1D9E75',
  good: '#5DCAA5',
  fair: '#FAC775',
  poor: '#F09595',
  nightSleep: '#534AB7',
  napSleep: '#AFA9EC',
  cdcLine: 'rgba(134,183,235,0.35)',
  babyLine: '#1D9E75',
};
