/**
 * Type definitions for the TimeEntry component
 */

/**
 * Props for the TimeEntry component
 */
export interface TimeEntryProps {
  /**
   * The currently selected time
   */
  value: Date | null;
  
  /**
   * Callback function when time changes
   */
  onChange: (date: Date) => void;
  
  /**
   * Optional class name for additional styling
   */
  className?: string;
  
  /**
   * Whether the component is disabled
   */
  disabled?: boolean;
  
  /**
   * Optional minimum time allowed
   */
  minTime?: Date;
  
  /**
   * Optional maximum time allowed
   */
  maxTime?: Date;
}

/**
 * TimeEntry state interface
 */
export interface TimeEntryState {
  /**
   * The current hours value (1-12 in 12h mode, 0-23 in 24h mode)
   */
  hours: number;
  
  /**
   * The current minutes value (0-59)
   */
  minutes: number;
  
  /**
   * Whether the time is AM or PM
   */
  isPM: boolean;
  
  /**
   * Which mode the clock is in (hours or minutes)
   */
  mode: 'hours' | 'minutes';
}
