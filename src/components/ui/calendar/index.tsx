'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import './calendar.css'; // Import the CSS file with dark mode overrides

import {
  calendarVariants,
  calendarHeaderVariants,
  calendarNavButtonVariants,
  calendarMonthSelectVariants,
  calendarDayVariants,
  calendarDayNamesVariants,
  calendarDayNameVariants,
} from './calendar.styles';
import { CalendarProps, CalendarPage } from './calendar.types';
import { MonthSelectorPage } from './MonthSelectorPage';
import { YearSelectorPage } from './YearSelectorPage';

/**
 * Calendar component
 * 
 * A custom calendar component with styled appearance that follows the project's design system.
 * Now uses a page-based navigation system instead of dropdowns for month/year selection.
 *
 * Features:
 * - Month navigation with previous/next buttons
 * - Date selection with customizable callbacks
 * - Support for disabled dates
 * - Highlighting of today's date
 * - Responsive design with different size variants
 * - Date range selection support
 * - Page-based month and year selection (no dropdowns)
 *
 * @example
 * ```tsx
 * // Single date selection
 * <Calendar 
 *   selected={selectedDate}
 *   onSelect={setSelectedDate}
 *   variant="default"
 * />
 * 
 * // Date range selection
 * <Calendar 
 *   mode="range"
 *   rangeFrom={fromDate}
 *   rangeTo={toDate}
 *   onRangeChange={(from, to) => {
 *     setFromDate(from);
 *     setToDate(to);
 *   }}
 * />
 * ```
 */
const Calendar = React.forwardRef<HTMLDivElement, CalendarProps>(
  ({ 
    className,
    variant = "default",
    selected,
    onSelect,
    rangeFrom,
    rangeTo,
    onRangeChange,
    mode = "single",
    month: monthProp,
    minDate,
    maxDate,
    disabledDates = [],
    isDateDisabled,
    initialFocus,
    ...props 
  }, ref) => {
    // State for the currently displayed month
    const [month, setMonth] = React.useState(() => {
      return monthProp || (selected || rangeFrom || new Date());
    });
    
    // State for range selection
    const [rangeSelectionState, setRangeSelectionState] = React.useState<'start' | 'end'>(
      rangeFrom && !rangeTo ? 'end' : 'start'
    );
    
    // State for page navigation
    const [currentPage, setCurrentPage] = React.useState<CalendarPage>('dates');
    
    // State for year selector pagination
    const [yearDecadeStart, setYearDecadeStart] = React.useState(() => {
      return Math.floor(month.getFullYear() / 12) * 12;
    });

    // Update month when monthProp changes
    React.useEffect(() => {
      if (monthProp) {
        setMonth(monthProp);
      }
    }, [monthProp]);

    // Get the first day of the month
    const firstDayOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    
    // Get the last day of the month
    const lastDayOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    
    // Get the day of the week for the first day (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfWeek = firstDayOfMonth.getDay();
    
    // Calculate days from previous month to display
    const daysFromPrevMonth = firstDayOfWeek;
    
    // Calculate total days in the current month
    const daysInMonth = lastDayOfMonth.getDate();
    
    // Calculate how many days to show from the next month to complete the grid
    const daysFromNextMonth = 42 - daysFromPrevMonth - daysInMonth;

    // Function to navigate to the previous month
    const handlePrevMonth = () => {
      setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
    };

    // Function to navigate to the next month
    const handleNextMonth = () => {
      setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));
    };

    // Function to check if a date is disabled
    const isDisabled = (date: Date) => {
      // Check if date is in disabledDates array
      const isInDisabledDates = disabledDates.some(
        disabledDate => 
          disabledDate.getFullYear() === date.getFullYear() &&
          disabledDate.getMonth() === date.getMonth() &&
          disabledDate.getDate() === date.getDate()
      );

      // Check if date is before minDate
      const isBeforeMinDate = minDate ? date < minDate : false;

      // Check if date is after maxDate
      const isAfterMaxDate = maxDate ? date > maxDate : false;

      // Check if date is disabled by custom function
      const isDisabledByFunction = isDateDisabled ? isDateDisabled(date) : false;

      return isInDisabledDates || isBeforeMinDate || isAfterMaxDate || isDisabledByFunction;
    };

    // Function to check if a date is today
    const isToday = (date: Date) => {
      const today = new Date();
      return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      );
    };

    // Helper to compare dates (ignoring time)
    const isSameDay = (date1: Date | null | undefined, date2: Date | null | undefined): boolean => {
      if (!date1 || !date2) return false;
      return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
      );
    };
    
    // Function to check if a date is selected (for single date mode OR first click in range mode)
    const isSelected = (date: Date) => {
      if (mode === "single") {
        return isSameDay(date, selected);
      } else if (mode === "range") {
        // Highlight the first selected date when waiting for the second
        return isSameDay(date, rangeFrom) && !rangeTo;
      }
      return false;
    };
    
    // Function to check if a date is the range start (only when range is complete)
    const isRangeStart = (date: Date) => {
      return mode === "range" && rangeFrom && rangeTo && isSameDay(date, rangeFrom);
    };
    
    // Function to check if a date is the range end (only when range is complete)
    const isRangeEnd = (date: Date) => {
      return mode === "range" && rangeFrom && rangeTo && isSameDay(date, rangeTo);
    };
    
    // Function to check if a date is in the middle of the range (only when range is complete)
    const isInRange = (date: Date) => {
      if (mode !== "range" || !rangeFrom || !rangeTo) return false;
      
      // Ensure dates are compared without time
      const normalizedDate = new Date(date);
      normalizedDate.setHours(0, 0, 0, 0);
      
      const normalizedFrom = new Date(rangeFrom);
      normalizedFrom.setHours(0, 0, 0, 0);
      
      const normalizedTo = new Date(rangeTo);
      normalizedTo.setHours(0, 0, 0, 0);
      
      return normalizedDate > normalizedFrom && normalizedDate < normalizedTo;
    };

    // Function to format date for display
    const formatDate = (date: Date | null | undefined) => {
      if (!date) return '';
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Function to handle month selection
    const handleMonthSelect = (monthIndex: number) => {
      const newMonth = new Date(month.getFullYear(), monthIndex, 1);
      setMonth(newMonth);
      setCurrentPage('dates'); // Return to dates view after selection
    };
    
    // Function to handle year selection
    const handleYearSelect = (year: number) => {
      const newMonth = new Date(year, month.getMonth(), 1);
      setMonth(newMonth);
      setCurrentPage('dates'); // Return to dates view after selection
    };

    // Functions for year decade navigation
    const handlePrevYearDecade = () => {
      const newStart = Math.max(1975, yearDecadeStart - 12);
      setYearDecadeStart(newStart);
    };

    const handleNextYearDecade = () => {
      const currentYear = new Date().getFullYear();
      const newStart = Math.min(currentYear - 11, yearDecadeStart + 12);
      setYearDecadeStart(newStart);
    };

    // Function to handle date selection
    const handleDateSelect = (date: Date) => {
      if (isDisabled(date)) return;

      if (mode === "single") {
        if (onSelect) onSelect(date);
      } else if (mode === "range" && onRangeChange) {
        // Normalize the clicked date to remove time component for comparison
        const clickedDay = new Date(date);
        clickedDay.setHours(0, 0, 0, 0);

        if (rangeSelectionState === 'start') {
          // First click: Set the start date, clear the end date
          onRangeChange(clickedDay, null);
          setRangeSelectionState('end'); // Move to selecting the end date
        } else { // rangeSelectionState === 'end'
          // Second click: Set the end date
          if (rangeFrom) {
            const normalizedFrom = new Date(rangeFrom);
            normalizedFrom.setHours(0, 0, 0, 0);

            // Only set the end date if it's strictly after the start date
            if (clickedDay > normalizedFrom) {
              onRangeChange(rangeFrom, clickedDay);
              setRangeSelectionState('start'); // Reset to start selection for next range
            } else if (isSameDay(clickedDay, normalizedFrom)) {
              // If the same day is clicked again, reset the selection
              onRangeChange(null, null);
              setRangeSelectionState('start');
            }
            // If clickedDay < normalizedFrom, do nothing (as per requirement 3)
          } else {
            // Should not happen if logic is correct, but as a fallback, start a new range
            onRangeChange(clickedDay, null);
            setRangeSelectionState('end');
          }
        }
      }
    };

    // Generate days for the calendar
    const days = React.useMemo(() => {
      const result = [];
      
      // Add days from previous month
      const prevMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
      const daysInPrevMonth = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).getDate();
      
      for (let i = daysInPrevMonth - daysFromPrevMonth + 1; i <= daysInPrevMonth; i++) {
        const date = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), i);
        result.push({
          date,
          dayOfMonth: i,
          isOutsideMonth: true,
          isDisabled: isDisabled(date),
          isToday: isToday(date),
          isSelected: isSelected(date), // Will highlight 'from' date when 'to' is null
          isRangeStart: isRangeStart(date), // Only true when range is complete
          isRangeEnd: isRangeEnd(date),     // Only true when range is complete
          isInRange: isInRange(date),       // Only true when range is complete
        });
      }
      
      // Add days from current month
      for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(month.getFullYear(), month.getMonth(), i);
        result.push({
          date,
          dayOfMonth: i,
          isOutsideMonth: false,
          isDisabled: isDisabled(date),
          isToday: isToday(date),
          isSelected: isSelected(date), // Will highlight 'from' date when 'to' is null
          isRangeStart: isRangeStart(date), // Only true when range is complete
          isRangeEnd: isRangeEnd(date),     // Only true when range is complete
          isInRange: isInRange(date),       // Only true when range is complete
        });
      }
      
      // Add days from next month
      const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      
      for (let i = 1; i <= daysFromNextMonth; i++) {
        const date = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), i);
        result.push({
          date,
          dayOfMonth: i,
          isOutsideMonth: true,
          isDisabled: isDisabled(date),
          isToday: isToday(date),
          isSelected: isSelected(date), // Will highlight 'from' date when 'to' is null
          isRangeStart: isRangeStart(date), // Only true when range is complete
          isRangeEnd: isRangeEnd(date),     // Only true when range is complete
          isInRange: isInRange(date),       // Only true when range is complete
        });
      }
      
      return result;
    }, [month, selected, rangeFrom, rangeTo, disabledDates, minDate, maxDate, isDateDisabled, mode, rangeSelectionState]);

    // Day names for the calendar header
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Render different content areas based on currentPage state
    const renderContentArea = () => {
      switch (currentPage) {
        case 'months':
          return (
            <MonthSelectorPage
              currentMonth={month.getMonth()}
              currentYear={month.getFullYear()}
              variant={variant || 'default'}
              onMonthSelect={handleMonthSelect}
            />
          );
          
        case 'years':
          return (
            <YearSelectorPage
              currentYear={month.getFullYear()}
              variant={variant || 'default'}
              onYearSelect={handleYearSelect}
              minYear={1975}
              maxYear={new Date().getFullYear()}
              decadeStart={yearDecadeStart}
            />
          );
          
        default:
        case 'dates':
          return (
            <>
              {/* Day Names */}
              <div className={cn(calendarDayNamesVariants({ variant }), "calendar-day-names")}>
                {dayNames.map((day) => (
                  <div key={day} className={cn(calendarDayNameVariants({ variant }), "calendar-day-name")}>
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-0 calendar-grid">
                {days.map((day, index) => (
                  <button
                    key={`${day.date.toISOString()}-${index}`}
                    type="button"
                    onClick={() => handleDateSelect(day.date)}
                    disabled={day.isDisabled}
                    className={cn(
                      calendarDayVariants({
                        variant,
                        // Apply 'selected' style if it's the single selected date OR the 'from' date when 'to' is not yet selected
                        selected: day.isSelected, 
                        // Apply range styles only when both from and to are selected
                        rangeStart: day.isRangeStart,
                        rangeEnd: day.isRangeEnd,
                        rangeMiddle: day.isInRange,
                        today: day.isToday,
                        disabled: day.isDisabled,
                        outside: day.isOutsideMonth,
                      }),
                      "calendar-day",
                      // Add specific classes for easier CSS targeting if needed, but rely on variants primarily
                      day.isSelected && "calendar-day-selected", // Covers single mode and range 'from' selection phase
                      day.isRangeStart && "calendar-day-range-start",
                      day.isRangeEnd && "calendar-day-range-end",
                      day.isInRange && "calendar-day-range-middle",
                      day.isToday && "calendar-day-today",
                      day.isDisabled && "calendar-day-disabled",
                      day.isOutsideMonth && "calendar-day-outside"
                    )}
                    aria-label={day.date.toLocaleDateString()}
                    aria-selected={(day.isSelected || day.isRangeStart || day.isRangeEnd) ? "true" : undefined}
                    tabIndex={day.isSelected || day.isRangeStart || day.isRangeEnd || (initialFocus && index === 0) ? 0 : -1}
                  >
                    {day.dayOfMonth}
                  </button>
                ))}
              </div>
            </>
          );
      }
    };

    return (
      <div
        ref={ref}
        className={cn(calendarVariants({ variant }), className, "calendar")}
        {...props}
      >
        {/* Date Range Display */}
        {mode === "range" && (
          <div className="calendar-range-display px-3 pt-2 pb-4 text-sm text-gray-700 flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 font-medium">From</span>
              <span className="font-semibold">{formatDate(rangeFrom) || '—'}</span>
            </div>
            <div className="h-px w-4 bg-gray-300 mx-2"></div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 font-medium">To</span>
              <span className="font-semibold">{formatDate(rangeTo) || '—'}</span>
            </div>
          </div>
        )}
        
        {/* Static Calendar Header - Always visible */}
        <div className={cn(calendarHeaderVariants({ variant }), "calendar-header")}>
          <button
            type="button"
            onClick={currentPage === 'dates' ? handlePrevMonth : currentPage === 'years' ? handlePrevYearDecade : undefined}
            disabled={currentPage === 'months'}
            className={cn(
              calendarNavButtonVariants({ variant }), 
              "calendar-nav-button",
              currentPage === 'months' && "opacity-50 cursor-not-allowed"
            )}
            aria-label={currentPage === 'years' ? "Previous years" : "Previous month"}
            tabIndex={-1} // Prevent default focus
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage('months')}
              className={cn(
                calendarMonthSelectVariants({ variant }), 
                "calendar-month-select px-2 py-1 rounded cursor-pointer"
              )}
              aria-label="Select month"
            >
              {month.toLocaleDateString('en-US', { month: 'long' })}
            </button>
            
            <button
              type="button"
              onClick={() => setCurrentPage('years')}
              className={cn(
                calendarMonthSelectVariants({ variant }), 
                "calendar-year-select px-2 py-1 rounded cursor-pointer"
              )}
              aria-label="Select year"
            >
              {month.getFullYear()}
            </button>
          </div>
          
          <button
            type="button"
            onClick={currentPage === 'dates' ? handleNextMonth : currentPage === 'years' ? handleNextYearDecade : undefined}
            disabled={currentPage === 'months'}
            className={cn(
              calendarNavButtonVariants({ variant }), 
              "calendar-nav-button",
              currentPage === 'months' && "opacity-50 cursor-not-allowed"
            )}
            aria-label={currentPage === 'years' ? "Next years" : "Next month"}
            tabIndex={-1} // Prevent default focus
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        
        {/* Dynamic Content Area */}
        {renderContentArea()}
      </div>
    );
  }
);

Calendar.displayName = "Calendar";

export { Calendar };
export type { CalendarProps };