import React, { useMemo, useState } from 'react';
import { cn } from '@/src/lib/utils';
import { CalendarDayViewProps, EventGroups } from './calendar-day-view.types';
import { calendarDayViewStyles as styles } from './calendar-day-view.styles';
import { CalendarEventItem } from '../CalendarEventItem';
import { Loader2, Calendar, Sun, Coffee, Moon, PlusCircle, CalendarClock, X } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { 
  FormPage, 
  FormPageContent, 
  FormPageHeader, 
  FormPageFooter 
} from '@/src/components/ui/form-page';
import CalendarEventForm from '@/src/components/forms/CalendarEventForm';
import { CalendarEventFormData } from '@/src/components/forms/CalendarEventForm/calendar-event-form.types';
import './calendar-day-view.css';

/**
 * CalendarDayView Component
 * 
 * Displays events for a selected day, grouped by time of day (morning, afternoon, evening).
 * Includes an "Add Event" button and handles loading and empty states.
 * Uses FormPage component for consistent layout with the rest of the app.
 * 
 * @param date - The selected date to display events for
 * @param events - Array of events for the selected date
 * @param onAddEvent - Optional handler for when the add event button is clicked
 * @param isLoading - Whether the component is in a loading state
 * @param className - Additional CSS classes
 * @param onClose - Optional handler for when the form page is closed
 */
export const CalendarDayView: React.FC<CalendarDayViewProps> = ({
  date,
  events,
  onAddEvent,
  isLoading = false,
  className,
  onClose,
  isOpen,
}) => {
  
  // State for event form
  const [showEventForm, setShowEventForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventFormData | undefined>(undefined);
  const [babies, setBabies] = useState<any[]>([]);
  const [caretakers, setCaretakers] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  
  // Fetch data for the event form
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const authToken = localStorage.getItem('authToken');
        const fetchOptions = authToken ? {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        } : {};

        // Fetch babies
        const babiesResponse = await fetch('/api/baby', fetchOptions);
        const babiesData = await babiesResponse.json();

        // Fetch caretakers
        const caretakersResponse = await fetch('/api/caretaker', fetchOptions);
        const caretakersData = await caretakersResponse.json();

        // Fetch contacts
        const contactsResponse = await fetch('/api/contact', fetchOptions);
        const contactsData = await contactsResponse.json();

        // Update state with fetched data
        setBabies(babiesData.success ? babiesData.data : []);
        setCaretakers(caretakersData.success ? caretakersData.data : []);
        setContacts(contactsData.success ? contactsData.data : []);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);
  
  // Format date for display
  const formattedDate = useMemo(() => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }, [date]);
  
  // Group events by time of day
  const groupedEvents = useMemo(() => {
    const groups: EventGroups = {
      morning: [],
      afternoon: [],
      evening: []
    };
    
    if (events && events.length > 0) {
      events.forEach(event => {
        // Make sure we have a valid date
        if (!event.startTime) {
          console.warn('Event missing startTime:', event);
          return;
        }
        
        // Use the user's local timezone to determine the hour
        const localDate = new Date(event.startTime);
        if (isNaN(localDate.getTime())) {
          console.warn('Invalid event date:', event.startTime);
          return;
        }
        
        const hour = localDate.getHours();
        
        if (hour < 12) {
          groups.morning.push(event);
        } else if (hour < 17) {
          groups.afternoon.push(event);
        } else {
          groups.evening.push(event);
        }
      });
      
      // Sort events within each group by start time
      const sortByTime = (a: any, b: any) => {
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      };
      
      groups.morning.sort(sortByTime);
      groups.afternoon.sort(sortByTime);
      groups.evening.sort(sortByTime);
    }
    
    return groups;
  }, [events]);
  
  // Handle direct event click
  const handleEventClick = (event: any) => {
    // Convert event to form data format
    const formData: CalendarEventFormData = {
      id: event.id,
      title: event.title,
      description: event.description || '',
      startTime: new Date(event.startTime),
      endTime: event.endTime ? new Date(event.endTime) : undefined,
      allDay: event.allDay,
      type: event.type,
      location: event.location || '',
      color: event.color || '',
      recurring: event.recurring,
      recurrencePattern: event.recurrencePattern,
      recurrenceEnd: event.recurrenceEnd ? new Date(event.recurrenceEnd) : undefined,
      customRecurrence: event.customRecurrence,
      reminderTime: event.reminderTime,
      babyIds: event.babies?.map((baby: any) => baby.id) || [],
      caretakerIds: event.caretakers?.map((caretaker: any) => caretaker.id) || [],
      contactIds: event.contacts?.map((contact: any) => contact.id) || [],
    };
    
    setSelectedEvent(formData);
    setShowEventForm(true);
  };
  
  // Handle add event button click
  const handleAddEvent = () => {
    setSelectedEvent(undefined);
    setShowEventForm(true);
  };
  
  // Handle close button click
  const handleClose = () => {
    // Call the onClose prop if provided
    if (onClose) {
      onClose();
    }
  };
  
  // Handle event form close
  const handleEventFormClose = () => {
    setShowEventForm(false);
  };
  
  // Handle event save
  const handleSaveEvent = async (eventData: CalendarEventFormData & { _deleted?: boolean }) => {
    try {
      // Check if this is a deletion (special flag set by CalendarEventForm)
      if (eventData._deleted) {
        // Close form if it's open
        setShowEventForm(false);
        
        // Notify parent component to refresh
        if (onAddEvent) {
          onAddEvent(date);
        }
        
        return; // Exit early - the actual deletion has already been handled by the form
      }
      
      const method = eventData.id ? 'PUT' : 'POST';
      const url = eventData.id ? `/api/calendar-event?id=${eventData.id}` : '/api/calendar-event';

      const authToken = localStorage.getItem('authToken');
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
        body: JSON.stringify({
          ...eventData,
          startTime: eventData.startTime.toISOString(),
          endTime: eventData.endTime?.toISOString(),
          recurrenceEnd: eventData.recurrenceEnd?.toISOString(),
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Close form
        setShowEventForm(false);
        
        // Notify parent component if onAddEvent is provided
        if (onAddEvent) {
          // Pass the date to trigger a refresh in the Calendar component
          onAddEvent(date);
        }
        
        // Refresh the events for the current day view
        // This will update the CalendarDayView with the latest events
      } else {
        console.error('Error saving event:', data.error);
      }
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };
  
  // Handle event delete
  const handleDeleteEvent = async (eventId: string) => {
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`/api/calendar-event?id=${eventId}`, {
        method: 'DELETE',
        headers: authToken ? {
          'Authorization': `Bearer ${authToken}`
        } : {}
      });
      const data = await response.json();
      if (data.success) {
        if (onAddEvent) {
          onAddEvent(date); // Trigger refresh
        }
      } else {
        console.error('Error deleting event:', data.error);
      }
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };
  
  // Render content based on loading and events state
  const renderContent = () => {
    // Loading state
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 text-teal-500 calendar-day-view-loader animate-spin" />
        </div>
      );
    }
    
    // Empty state
    if (events.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-6">
          <CalendarClock className="h-12 w-12 text-gray-400 calendar-day-view-empty-icon mb-2" />
          <p className="text-gray-500 calendar-day-view-empty-text text-sm">
            No events scheduled for this day
          </p>
        </div>
      );
    }
    
    // Events state - grouped by time of day
    return (
      <div className="calendar-day-view px-3">
        <div className="max-w-2xl mx-auto mt-2">
          {/* Morning events */}
          {groupedEvents.morning.length > 0 && (
            <div className={styles.eventGroup}>
              <div className={styles.eventGroupHeader}>
                <Sun className={styles.eventGroupIcon} />
                <h3 className={cn(
                  styles.eventGroupTitle,
                  'calendar-day-view-group-title'
                )}>
                  Morning
                </h3>
              </div>
              
              <div className={styles.eventsList}>
                {groupedEvents.morning.map(event => (
                  <CalendarEventItem
                    key={event.id}
                    event={event}
                    onClick={handleEventClick}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Afternoon events */}
          {groupedEvents.afternoon.length > 0 && (
            <div className={styles.eventGroup}>
              <div className={styles.eventGroupHeader}>
                <Coffee className={styles.eventGroupIcon} />
                <h3 className={cn(
                  styles.eventGroupTitle,
                  'calendar-day-view-group-title'
                )}>
                  Afternoon
                </h3>
              </div>
              
              <div className={styles.eventsList}>
                {groupedEvents.afternoon.map(event => (
                  <CalendarEventItem
                    key={event.id}
                    event={event}
                    onClick={handleEventClick}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Evening events */}
          {groupedEvents.evening.length > 0 && (
            <div className={styles.eventGroup}>
              <div className={styles.eventGroupHeader}>
                <Moon className={styles.eventGroupIcon} />
                <h3 className={cn(
                  styles.eventGroupTitle,
                  'calendar-day-view-group-title'
                )}>
                  Evening
                </h3>
              </div>
              
              <div className={styles.eventsList}>
                {groupedEvents.evening.map(event => (
                  <CalendarEventItem
                    key={event.id}
                    event={event}
                    onClick={handleEventClick}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // Use FormPage component to render the calendar day view
  return (
    <>
      <FormPage
        isOpen={isOpen}
        onClose={handleClose}
        title={formattedDate}
        className={cn(styles.container, className)}
      >
        <FormPageContent className="p-0">
          <div className="flex flex-col h-full">
            {renderContent()}
          </div>
        </FormPageContent>
        <FormPageFooter>
          <div className="flex justify-end space-x-2 w-full">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={false}
            >
              Close
            </Button>
            <Button onClick={handleAddEvent}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Event
            </Button>
          </div>
        </FormPageFooter>
      </FormPage>
      <CalendarEventForm
        isOpen={showEventForm}
        onClose={handleEventFormClose}
        event={selectedEvent}
        onSave={handleSaveEvent}
        initialDate={date}
        babies={babies}
        caretakers={caretakers}
        contacts={contacts}
      />
    </>
  );
};

export default CalendarDayView;
