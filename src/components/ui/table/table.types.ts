import * as React from "react";

/**
 * Props for the main Table component
 */
export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Props for the TableHeader component
 */
export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Props for the TableBody component
 */
export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Props for the TableFooter component
 */
export interface TableFooterProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Props for the TableRow component
 */
export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Props for the TableHead component (th)
 */
export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Visual variant for the header cell
   */
  variant?: 'default' | 'bold';
}

/**
 * Props for the TableCell component (td)
 */
export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Props for the TableCaption component
 */
export interface TableCaptionProps extends React.HTMLAttributes<HTMLTableCaptionElement> {
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Props for the TableSearch component
 */
export interface TableSearchProps {
  /**
   * Current search value
   */
  value: string;
  
  /**
   * Callback when search value changes
   */
  onSearchChange: (value: string) => void;
  
  /**
   * Placeholder text for the search input
   */
  placeholder?: string;
  
  /**
   * Additional CSS classes
   */
  className?: string;
  
  /**
   * Whether the search is disabled
   */
  disabled?: boolean;
}

/**
 * Props for the TablePagination component
 */
export interface TablePaginationProps {
  /**
   * Current page number (1-based)
   */
  currentPage: number;
  
  /**
   * Total number of pages
   */
  totalPages: number;
  
  /**
   * Total number of items
   */
  totalItems: number;
  
  /**
   * Number of items per page
   */
  pageSize: number;
  
  /**
   * Callback when page changes
   */
  onPageChange: (page: number) => void;
  
  /**
   * Additional CSS classes
   */
  className?: string;
  
  /**
   * Whether pagination is disabled
   */
  disabled?: boolean;
}

/**
 * Props for the TablePageSize component
 */
export interface TablePageSizeProps {
  /**
   * Current page size
   */
  pageSize: number;
  
  /**
   * Available page size options
   */
  pageSizeOptions?: number[];
  
  /**
   * Callback when page size changes
   */
  onPageSizeChange: (pageSize: number) => void;
  
  /**
   * Additional CSS classes
   */
  className?: string;
  
  /**
   * Whether page size selector is disabled
   */
  disabled?: boolean;
}

/**
 * Tab definition for TableTabs component
 */
export interface TableTab {
  /**
   * Unique identifier for the tab
   */
  id: string;
  
  /**
   * Display label for the tab
   */
  label: string;
  
  /**
   * Optional badge count to display
   */
  count?: number;
  
  /**
   * Whether the tab is disabled
   */
  disabled?: boolean;
}

/**
 * Props for the TableTabs component
 */
export interface TableTabsProps {
  /**
   * Array of tab definitions
   */
  tabs: TableTab[];
  
  /**
   * Currently active tab ID
   */
  activeTab: string;
  
  /**
   * Callback when tab changes
   */
  onTabChange: (tabId: string) => void;
  
  /**
   * Additional CSS classes
   */
  className?: string;
  
  /**
   * Whether tabs are disabled
   */
  disabled?: boolean;
}

/**
 * Configuration for enhanced table features
 */
export interface TableEnhancedConfig {
  /**
   * Enable search functionality
   */
  search?: boolean;
  
  /**
   * Enable pagination
   */
  pagination?: boolean;
  
  /**
   * Enable page size selector
   */
  pageSize?: boolean;
  
  /**
   * Enable tabs
   */
  tabs?: boolean;
  
  /**
   * Default page size
   */
  defaultPageSize?: number;
  
  /**
   * Available page size options
   */
  pageSizeOptions?: number[];
  
  /**
   * Search placeholder text
   */
  searchPlaceholder?: string;
  
  /**
   * Tab configuration
   */
  tabConfig?: {
    tabs: TableTab[];
    defaultTab?: string;
  };
} 