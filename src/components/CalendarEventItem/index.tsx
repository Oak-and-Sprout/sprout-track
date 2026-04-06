import React from 'react';
import { cn } from '@/src/lib/utils';
import { CalendarEventItemProps } from './calendar-event-item.types';
import { calendarEventItemStyles as styles } from './calendar-event-item.styles';
import { CalendarEventType } from '@prisma/client';
import { MapPin, Clock, RepeatIcon, Users } from 'lucide-react';
import { useTimezone } from '@/app/context/timezone';
import { formatTimeDisplay, formatDateShort } from '@/src/utils/dateFormat';
import './calendar-event-item.css';

/**
 * CalendarEventItem Component
 * 
 * A compact, list-friendly component for displaying calendar events.
 * Optimized for use in lists and summary views.
 * 
 * @param event - The calendar event data to display
 * @param onClick - Optional click handler for the event
 * @param className - Additional CSS classes
 */
export const CalendarEventItem: React.FC<CalendarEventItemProps> = ({
  event,
  onClick,
  className,
}) => {
  const { dateFormat, timeFormat } = useTimezone();

  // Format time for display
  const formatEventTime = (startTimeStr: string, allDay: boolean, endTimeStr?: string | null) => {
    const startTime = new Date(startTimeStr);
    const endTime = endTimeStr ? new Date(endTimeStr) : undefined;
    if (allDay) return 'All day';

    const startFormatted = formatTimeDisplay(startTime, timeFormat);

    if (!endTime) return startFormatted;

    const endFormatted = formatTimeDisplay(endTime, timeFormat);
    return `${startFormatted} - ${endFormatted}`;
  };

  // Format date for display
  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if the event is today or tomorrow
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }

    // Otherwise, return the formatted date
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
    return `${weekday}, ${formatDateShort(date, dateFormat)}`;
  };
  
  // Get color indicator class based on event type
  const getColorIndicatorClass = () => {
    const baseClass = styles.colorIndicator.base;
    
    switch (event.type) {
      case CalendarEventType.APPOINTMENT:
        return cn(baseClass, styles.colorIndicator.appointment);
      case CalendarEventType.CARETAKER_SCHEDULE:
        return cn(baseClass, styles.colorIndicator.caretakerSchedule);
      case CalendarEventType.REMINDER:
        return cn(baseClass, styles.colorIndicator.reminder);
      case CalendarEventType.CUSTOM:
        return cn(baseClass, styles.colorIndicator.custom);
      default:
        return cn(baseClass, styles.colorIndicator.custom);
    }
  };
  
  // Handle click event
  const handleClick = () => {
    if (onClick) {
      onClick(event);
    }
  };
  
  // Count total participants (babies + caretakers + contacts)
  const totalParticipants = event.babies.length + event.caretakers.length + event.contacts.length;
  
  return (
    <div 
      className={cn(
        styles.container,
        'calendar-event-item-container',
        className
      )}
      onClick={handleClick}
    >
      {/* Color indicator based on event type */}
      <div className={getColorIndicatorClass()} />
      
      {/* Event content */}
      <div className={cn(
        styles.content,
        'calendar-event-item'
      )}>
        {/* Title */}
        <h3 className={cn(
          styles.title,
          'calendar-event-item-title'
        )}>
          {event.title}
        </h3>
        
        {/* Details: time, location, recurring */}
        <div className={cn(
          styles.details,
          'calendar-event-item-details'
        )}>
          {/* Time */}
          <Clock className={cn(styles.icon.base, styles.icon.time)} />
          <span>
            {formatEventDate(event.startTime)}, {formatEventTime(event.startTime, event.allDay, event.endTime)}
          </span>
          
          {/* Location if available */}
          {event.location && (
            <span className={styles.location}>
              <MapPin className={cn(styles.icon.base, styles.icon.location)} />
              {event.location}
            </span>
          )}
          
          {/* Recurring indicator */}
          {event.recurring && (
            <RepeatIcon className={cn(
              styles.icon.base, 
              styles.icon.recurring, 
              "recurring-icon-small",
              "ml-2"
            )} />
          )}
        </div>
      </div>
      
      {/* Participant count badge */}
      {totalParticipants > 0 && (
        <div className={styles.badgesContainer}>
          <div className={cn(styles.badge.base, styles.badge.baby, 'calendar-event-item-badge')}>
            <Users className="h-3 w-3" />
          </div>
          <span className={styles.badgeCount}>{totalParticipants}</span>
        </div>
      )}
    </div>
  );
};

export default CalendarEventItem;
