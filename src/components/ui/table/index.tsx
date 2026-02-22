import * as React from "react";
import { cn } from "@/src/lib/utils";
import { tableStyles } from "./table.styles";
import { useTheme } from "@/src/context/theme";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from "lucide-react";
import { useLocalization } from '@/src/context/localization';

import "./table.css";
import {
  TableProps,
  TableHeaderProps,
  TableBodyProps,
  TableFooterProps,
  TableRowProps,
  TableHeadProps,
  TableCellProps,
  TableCaptionProps,
  TableSearchProps,
  TablePaginationProps,
  TablePageSizeProps,
  TableTabsProps,
} from "./table.types";

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, ...props }, ref) => {
    const { theme } = useTheme();
    return (
      <div className="relative w-full overflow-auto">
        <table
          ref={ref}
          className={cn(tableStyles.table, className, "table-dark")}
          {...props}
        />
      </div>
    );
  }
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ className, ...props }, ref) => {
    const { theme } = useTheme();
    return (
      <thead
        ref={ref}
        className={cn(tableStyles.header, className, "table-header-dark")}
        {...props}
      />
    );
  }
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ className, ...props }, ref) => {
    const { theme } = useTheme();
    return (
      <tbody
        ref={ref}
        className={cn(tableStyles.body, className, "table-body-dark")}
        {...props}
      />
    );
  }
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, TableFooterProps>(
  ({ className, ...props }, ref) => {
    const { theme } = useTheme();
    return (
      <tfoot
        ref={ref}
        className={cn(tableStyles.footer, className, "table-footer-dark")}
        {...props}
      />
    );
  }
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, ...props }, ref) => {
    const { theme } = useTheme();
    return (
      <tr
        ref={ref}
        className={cn(tableStyles.row, className)}
        {...props}
      />
    );
  }
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, ...props }, ref) => {
    const { theme } = useTheme();
    return (
      <th
        ref={ref}
        className={cn(tableStyles.head, className, "table-head-dark")}
        {...props}
      />
    );
  }
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, ...props }, ref) => {
    const { theme } = useTheme();
    return (
      <td
        ref={ref}
        className={cn(tableStyles.cell, className, "table-cell-dark")}
        {...props}
      />
    );
  }
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, TableCaptionProps>(
  ({ className, ...props }, ref) => {
    const { theme } = useTheme();
    return (
      <caption
        ref={ref}
        className={cn(tableStyles.caption, className, "table-caption-dark")}
        {...props}
      />
    );
  }
);
TableCaption.displayName = "TableCaption";

const TableSearch = React.forwardRef<HTMLInputElement, TableSearchProps>(
  ({ value, onSearchChange, placeholder = "Search...", className, disabled, ...props }, ref) => {
    const { theme } = useTheme();
    return (
      <div className={cn(tableStyles.searchContainer, className)}>
        <div className={cn("relative", tableStyles.searchInput)}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            ref={ref}
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onSearchChange(e.target.value)}
            disabled={disabled}
            className={cn("pl-10 table-search-dark")}
            {...props}
          />
        </div>
      </div>
    );
  }
);
TableSearch.displayName = "TableSearch";

const TableTabs = React.forwardRef<HTMLDivElement, TableTabsProps>(
  ({ tabs, activeTab, onTabChange, className, disabled, ...props }, ref) => {
    const { theme } = useTheme();
    
    return (
      <div
        ref={ref}
        className={cn(tableStyles.tabsContainer, className)}
        {...props}
      >
        <div className={cn(tableStyles.tabsList, "table-tabs-list-dark")}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => !disabled && !tab.disabled && onTabChange(tab.id)}
              disabled={disabled || tab.disabled}
              data-state={activeTab === tab.id ? "active" : "inactive"}
              className={cn(
                tableStyles.tabsTrigger,
                "table-tabs-trigger-dark"
              )}
            >
              {tab.label}
              {typeof tab.count === 'number' && (
                <span className={cn(
                  activeTab === tab.id ? tableStyles.tabBadgeActive : tableStyles.tabBadge,
                  activeTab === tab.id ? "table-tab-badge-active-dark" : "table-tab-badge-dark"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }
);
TableTabs.displayName = "TableTabs";

const TablePagination = React.forwardRef<HTMLDivElement, TablePaginationProps>(
  ({ currentPage, totalPages, totalItems, pageSize, onPageChange, className, disabled, ...props }, ref) => {
    const { theme } = useTheme();
    const { t } = useLocalization();
    
    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);
    
    const generatePageNumbers = () => {
      const pages = [];
      const maxVisiblePages = 5;
      
      if (totalPages <= maxVisiblePages) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        for (let i = startPage; i <= endPage; i++) {
          pages.push(i);
        }
      }
      
      return pages;
    };
    
    const pageNumbers = generatePageNumbers();
    
    return (
      <div
        ref={ref}
        className={cn(tableStyles.paginationContainer, className)}
        {...props}
      >
        <div className={cn(tableStyles.paginationInfo, "table-pagination-info-dark")}>
          {t('Showing')} {startItem} to {endItem} of {totalItems} entries
        </div>
        
        <div className={tableStyles.paginationControls}>
          <button
            onClick={() => onPageChange(1)}
            disabled={disabled || currentPage === 1}
            className="h-9 w-9 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded"
            style={{
              color: disabled || currentPage === 1 ? '#9ca3af' : 'currentColor'
            }}
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
          
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={disabled || currentPage === 1}
            className="h-9 w-9 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded"
            style={{
              color: disabled || currentPage === 1 ? '#9ca3af' : 'currentColor'
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          
          {pageNumbers.map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              disabled={disabled}
              data-current={page === currentPage}
              className={cn(
                "h-9 w-9 flex items-center justify-center rounded text-sm font-medium border table-page-btn",
                page === currentPage 
                  ? "bg-teal-600 text-white hover:bg-teal-700 border-teal-600" 
                  : "bg-white text-gray-900 border-gray-300 hover:bg-gray-50 shadow-sm",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {page}
            </button>
          ))}
          
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={disabled || currentPage === totalPages}
            className="h-9 w-9 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded"
            style={{
              color: disabled || currentPage === totalPages ? '#9ca3af' : 'currentColor'
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={disabled || currentPage === totalPages}
            className="h-9 w-9 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded"
            style={{
              color: disabled || currentPage === totalPages ? '#9ca3af' : 'currentColor'
            }}
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }
);
TablePagination.displayName = "TablePagination";

const TablePageSize = React.forwardRef<HTMLDivElement, TablePageSizeProps>(
  ({ pageSize, pageSizeOptions = [5, 10, 20, 50, 100], onPageSizeChange, className, disabled, ...props }, ref) => {
    const { theme } = useTheme();
    const { t } = useLocalization();
    
    return (
      <div
        ref={ref}
        className={cn(tableStyles.pageSizeContainer, className)}
        {...props}
      >
        <span className={cn(tableStyles.pageSizeLabel, "table-pagesize-label-dark")}>
          {t('Show')}
        </span>
        <Select
          value={pageSize.toString()}
          onValueChange={(value) => onPageSizeChange(parseInt(value))}
          disabled={disabled}
        >
          <SelectTrigger className={cn(tableStyles.pageSizeSelect, "table-pagesize-select-dark")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((size) => (
              <SelectItem key={size} value={size.toString()}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className={cn(tableStyles.pageSizeLabel, "table-pagesize-label-dark")}>
          entries
        </span>
      </div>
    );
  }
);
TablePageSize.displayName = "TablePageSize";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableSearch,
  TableTabs,
  TablePagination,
  TablePageSize,
}; 