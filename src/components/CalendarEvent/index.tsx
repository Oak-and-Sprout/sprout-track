import React from 'react';
import { cn } from '@/src/lib/utils';
import { CalendarEventProps } from './calendar-event.types';
import { calendarEventStyles as styles } from './calendar-event.styles';
import { useLocalization } from '@/src/context/localization';

import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Repeat, 
  Bell
} from 'lucide-react';
import './calendar-event.css';

/**
 * CalendarEvent Component
 * 
 * Displays a calendar event with details such as title, time, location, and associated people.
 * This component is used for detailed event display, typically in a modal or detail view.
 */
const CalendarEvent: React.FC<CalendarEventProps> = ({
  event,
  onClick,
  className,
}) => {
  const { t } = useLocalization();
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  // Format time for display
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };
  
  // Format date and time for display
  const formatDateTime = (dateString: string) => {
    if (event.allDay) {
      return formatDate(dateString);
    }
    return `${formatDate(dateString)} at ${formatTime(dateString)}`;
  };
  
  // Get recurrence pattern text
  const getRecurrenceText = () => {
    if (!event.recurring || !event.recurrencePattern) {
      return null;
    }
    
    let text = '';
    switch (event.recurrencePattern) {
      case 'DAILY':
        text = 'Daily';
        break;
      case 'WEEKLY':
        text = 'Weekly';
        break;
      case 'BIWEEKLY':
        text = 'Every 2 weeks';
        break;
      case 'MONTHLY':
        text = 'Monthly';
        break;
      case 'YEARLY':
        text = 'Yearly';
        break;
      case 'CUSTOM':
        text = event.customRecurrence || 'Custom';
        break;
      default:
        text = 'Recurring';
    }
    
    if (event.recurrenceEnd) {
      text += ` until ${formatDate(event.recurrenceEnd)}`;
    }
    
    return text;
  };
  
  // Get reminder text
  const getReminderText = () => {
    if (event.reminderTime === null) {
      return null;
    }
    
    if (event.reminderTime === 0) {
      return 'At time of event';
    }
    
    if (event.reminderTime < 60) {
      return `${event.reminderTime} minutes before`;
    }
    
    if (event.reminderTime === 60) {
      return '1 hour before';
    }
    
    if (event.reminderTime < 1440) {
      return `${event.reminderTime / 60} hours before`;
    }
    
    if (event.reminderTime === 1440) {
      return '1 day before';
    }
    
    return `${event.reminderTime / 1440} days before`;
  };
  
  // Handle click
  const handleClick = () => {
    if (onClick) {
      onClick(event);
    }
  };
  
  return (
    <div 
      className={cn(
        styles.container,
        'calendar-event',
        className
      )}
      onClick={handleClick}
      style={{ 
        borderLeftColor: event.color || '#14b8a6',
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      <div className={styles.header}>
        <h3 className={styles.title}>{event.title}</h3>
        <div className={styles.type}>{event.type.replace('_', ' ')}</div>
      </div>
      
      <div className={styles.content}>
        {/* Date and time */}
        <div className={styles.detail}>
          <Calendar className={styles.icon} />
          <div>
            <div>{formatDateTime(event.startTime)}</div>
            {event.endTime && !event.allDay && (
              <div className={styles.endTime}>
                to {formatTime(event.endTime)}
              </div>
            )}
          </div>
        </div>
        
        {/* Location */}
        {event.location && (
          <div className={styles.detail}>
            <MapPin className={styles.icon} />
            <div>{event.location}</div>
          </div>
        )}
        
        {/* Recurrence */}
        {event.recurring && (
          <div className={styles.detail}>
            <Repeat className={styles.icon} />
            <div>{getRecurrenceText()}</div>
          </div>
        )}
        
        {/* Reminder */}
        {event.reminderTime !== null && (
          <div className={styles.detail}>
            <Bell className={styles.icon} />
            <div>{getReminderText()}</div>
          </div>
        )}
        
        {/* People */}
        {(event.babies.length > 0 || event.caretakers.length > 0 || event.contacts.length > 0) && (
          <div className={styles.detail}>
            <Users className={styles.icon} />
            <div className={styles.people}>
              {/* Babies */}
              {event.babies.length > 0 && (
                <div className={styles.peopleGroup}>
                  <span className={styles.peopleLabel}>{t('Babies:')}</span>
                  <span className={styles.peopleList}>
                    {event.babies.map(baby => `${baby.firstName} ${baby.lastName}`).join(', ')}
                  </span>
                </div>
              )}
              
              {/* Caretakers */}
              {event.caretakers.length > 0 && (
                <div className={styles.peopleGroup}>
                  <span className={styles.peopleLabel}>{t('Caretakers:')}</span>
                  <span className={styles.peopleList}>
                    {event.caretakers.map(caretaker => caretaker.name).join(', ')}
                  </span>
                </div>
              )}
              
              {/* Contacts */}
              {event.contacts.length > 0 && (
                <div className={styles.peopleGroup}>
                  <span className={styles.peopleLabel}>{t('Contacts:')}</span>
                  <span className={styles.peopleList}>
                    {event.contacts.map(contact => contact.name).join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Description */}
        {event.description && (
          <div className={styles.description}>
            {event.description}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarEvent;
