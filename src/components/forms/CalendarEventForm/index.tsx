import React, { useState, useEffect } from 'react';
import { cn } from '@/src/lib/utils';
import { CalendarEventFormProps, CalendarEventFormData, CalendarEventFormErrors } from './calendar-event-form.types';
import { Baby, Caretaker, Contact } from '@/src/components/CalendarEvent/calendar-event.types';
import { calendarEventFormStyles as styles } from './calendar-event-form.styles';
import { CalendarEventType, RecurrencePattern } from '@prisma/client';
import { format } from 'date-fns'; // Import date-fns for formatting
// import RecurrenceSelector from './RecurrenceSelector'; // Commented out - functionality not fully implemented yet
import ContactSelector from './ContactSelector';
import { MapPin, AlertCircle, Bell, Loader2, Trash2 } from 'lucide-react';
import { FormPage, FormPageContent, FormPageFooter } from '@/src/components/ui/form-page';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { DateTimePicker } from '@/src/components/ui/date-time-picker';
import { Button } from '@/src/components/ui/button';
import { Checkbox } from '@/src/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/src/components/ui/dropdown-menu';
import './calendar-event-form.css';
import { useFamily } from '@/src/context/family';

/**
 * CalendarEventForm Component
 * 
 * A form for creating and editing calendar events.
 * Includes fields for event details, recurrence, and associated entities.
 */
const CalendarEventForm: React.FC<CalendarEventFormProps> = ({
  isOpen,
  onClose,
  event,
  onSave,
  initialDate,
  babies,
  caretakers,
  contacts,
  isLoading = false,
  familyId,
}) => {
  const { family } = useFamily();
  
  // Helper function to get initial form data
  const getInitialFormData = (
    eventData: CalendarEventFormData | undefined, 
    initialDate: Date | undefined, 
    babies: Baby[]
  ): CalendarEventFormData => {
    if (eventData) {
      return { ...eventData };
    }
    
    // Default values for new event
    const date = initialDate || new Date();
    
    // Set default start time to nearest half hour
    const startTime = new Date(date);
    startTime.setMinutes(Math.ceil(startTime.getMinutes() / 30) * 30);
    startTime.setSeconds(0);
    startTime.setMilliseconds(0);
    
    // Set default end time to 1 hour after start time
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);
    
    // If there's only one active baby, select it by default
    const activeBabies = babies.filter(baby => baby.inactive !== true);
    const defaultBabyIds = activeBabies.length === 1 ? [activeBabies[0].id] : [];
    
    return {
      title: '',
      startTime,
      endTime,
      allDay: false,
      type: CalendarEventType.APPOINTMENT,
      recurring: false,
      babyIds: defaultBabyIds,
      caretakerIds: [],
      contactIds: [],
    };
  };
  
  // Initialize form data
  const [formData, setFormData] = useState<CalendarEventFormData>(() => {
    return getInitialFormData(event, initialDate, babies);
  });
  
  // State for DateTimePicker components
  const [selectedStartDateTime, setSelectedStartDateTime] = useState<Date>(() => {
    return formData.startTime || new Date();
  });
  
  const [selectedEndDateTime, setSelectedEndDateTime] = useState<Date>(() => {
    return formData.endTime || new Date(new Date().getTime() + 60 * 60 * 1000); // Default to 1 hour later
  });
  
  // Update form data when event or initialDate changes
  useEffect(() => {
    // If event is provided, use it (editing an existing event)
    if (event) {
      setFormData({ ...event });
      if (event.startTime) {
        setSelectedStartDateTime(event.startTime);
      }
      if (event.endTime) {
        setSelectedEndDateTime(event.endTime);
      }
    } 
    // If no event but initialDate is provided, create a completely new event with that date
    else if (initialDate) {
      // Create a completely new form data object for a new event
      const newFormData = getInitialFormData(undefined, initialDate, babies);
      setFormData(newFormData);
      
      if (newFormData.startTime) {
        setSelectedStartDateTime(newFormData.startTime);
      }
      if (newFormData.endTime) {
        setSelectedEndDateTime(newFormData.endTime);
      }
    }
    // If no event and no initialDate, reset to default form with current date
    else if (!event && !initialDate) {
      const newFormData = getInitialFormData(undefined, new Date(), babies);
      setFormData(newFormData);
      
      if (newFormData.startTime) {
        setSelectedStartDateTime(newFormData.startTime);
      }
      if (newFormData.endTime) {
        setSelectedEndDateTime(newFormData.endTime);
      }
    }
  }, [event, initialDate, babies]);
  
  // Ensure baby is selected when editing an existing event
  useEffect(() => {
    // If we're editing an event and there's only one active baby but none selected
    if (event && formData.babyIds.length === 0) {
      const activeBabies = babies.filter(baby => baby.inactive !== true);
      if (activeBabies.length === 1) {
        setFormData(prev => ({
          ...prev,
          babyIds: [activeBabies[0].id]
        }));
      }
    }
  }, [event, babies, formData.babyIds]);
  
  // Form validation errors
  const [errors, setErrors] = useState<CalendarEventFormErrors>({});
  
  // Handle form field changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for the field
    if (errors[name as keyof CalendarEventFormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };
  
  // Handle checkbox changes
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  }; // <-- Added missing closing brace

  // Handle start date/time change with DateTimePicker
  const handleStartDateTimeChange = (date: Date) => {
    setSelectedStartDateTime(date);
    setFormData(prev => ({ ...prev, startTime: date }));
    
    // Clear error for the field
    if (errors.startTime) {
      setErrors(prev => ({ ...prev, startTime: undefined }));
    }
    
    // If end time is before the new start time, update end time
    if (formData.endTime && formData.endTime < date) {
      // Set end time to 1 hour after start time
      const newEndTime = new Date(date);
      newEndTime.setHours(newEndTime.getHours() + 1);
      
      setSelectedEndDateTime(newEndTime);
      setFormData(prev => ({ ...prev, endTime: newEndTime }));
    }
  };
  
  // Handle end date/time change with DateTimePicker
  const handleEndDateTimeChange = (date: Date) => {
    setSelectedEndDateTime(date);
    setFormData(prev => ({ ...prev, endTime: date }));
    
    // Clear error for the field
    if (errors.endTime) {
      setErrors(prev => ({ ...prev, endTime: undefined }));
    }
  };
  
  // Handle color change
  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, color: e.target.value }));
  };
  
  // Recurrence handlers - commented out as functionality is not fully implemented yet
  /*
  // Handle recurring change
  const handleRecurringChange = (recurring: boolean) => {
    setFormData(prev => ({ 
      ...prev, 
      recurring,
      // If turning on recurring, set default pattern
      ...(recurring && !prev.recurrencePattern ? { recurrencePattern: RecurrencePattern.WEEKLY } : {})
    }));
  };
  
  // Handle recurrence pattern change
  const handleRecurrencePatternChange = (pattern: RecurrencePattern) => {
    setFormData(prev => ({ ...prev, recurrencePattern: pattern }));
    
    // Clear error for the field
    if (errors.recurrencePattern) {
      setErrors(prev => ({ ...prev, recurrencePattern: undefined }));
    }
  };
  
  // Handle recurrence end change
  const handleRecurrenceEndChange = (date: Date | undefined) => {
    setFormData(prev => ({ ...prev, recurrenceEnd: date }));
    
    // Clear error for the field
    if (errors.recurrenceEnd) {
      setErrors(prev => ({ ...prev, recurrenceEnd: undefined }));
    }
  };
  */
  
  // Reminder handler - commented out as functionality is not fully implemented yet
  /*
  // Handle reminder time change
  const handleReminderTimeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ 
      ...prev, 
      reminderTime: value ? parseInt(value, 10) : undefined 
    }));
  };
  */
  
  // Handle baby selection change
  const handleBabyChange = (babyId: string) => {
    setFormData(prev => {
      const newBabyIds = prev.babyIds.includes(babyId)
        ? prev.babyIds.filter(id => id !== babyId)
        : [...prev.babyIds, babyId];
      
      return { ...prev, babyIds: newBabyIds };
    });
  };
  
  // Handle caretaker selection change
  const handleCaretakerChange = (caretakerId: string) => {
    setFormData(prev => {
      const newCaretakerIds = prev.caretakerIds.includes(caretakerId)
        ? prev.caretakerIds.filter(id => id !== caretakerId)
        : [...prev.caretakerIds, caretakerId];
      
      return { ...prev, caretakerIds: newCaretakerIds };
    });
  };
  
  // Handle contact selection change
  const handleContactsChange = (contactIds: string[]) => {
    setFormData(prev => ({ ...prev, contactIds }));
  };
  
  // Local state for contacts to ensure updates are reflected
  const [localContacts, setLocalContacts] = useState<Contact[]>(contacts);
  
  // Update local contacts when props change
  useEffect(() => {
    setLocalContacts(contacts);
  }, [contacts]);
  
  // Handle adding a new contact
  const handleAddContact = (newContact: Contact) => {
    console.log('Add new contact:', newContact);
    
    // Add the new contact to our local contacts list
    setLocalContacts(prev => {
      // Check if the contact already exists
      if (!prev.some(c => c.id === newContact.id)) {
        return [...prev, newContact];
      }
      return prev;
    });
    
    // Select the new contact
    setFormData(prev => ({
      ...prev,
      contactIds: [...prev.contactIds, newContact.id]
    }));
  };
  
  // Handle editing a contact
  const handleEditContact = (updatedContact: Contact) => {
    console.log('Edit contact:', updatedContact);
    
    // Update the contact in our local contacts list
    setLocalContacts(prev => 
      prev.map(c => c.id === updatedContact.id ? updatedContact : c)
    );
  };
  
  // Handle deleting a contact
  const handleDeleteContact = (contactId: string) => {
    console.log('Delete contact:', contactId);
    
    // Remove the contact from our local contacts list
    setLocalContacts(prev => prev.filter(c => c.id !== contactId));
    
    // Remove the contact from the selected contacts if it's selected
    if (formData.contactIds.includes(contactId)) {
      setFormData(prev => ({
        ...prev,
        contactIds: prev.contactIds.filter(id => id !== contactId)
      }));
    }
  };
  
  // Format Date object into "yyyy-MM-dd'T'HH:mm" for datetime-local input
  const formatDateTimeForInput = (date?: Date): string => {
    if (!date) return '';
    try {
      // Use date-fns for reliable formatting
      return format(date, "yyyy-MM-dd'T'HH:mm");
    } catch (error) {
      console.error("Error formatting date for input:", error);
      // Fallback or handle error appropriately
      // Attempt manual format as fallback
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
  };
  
  // Validate form before submission
  const validateForm = (): boolean => {
    const newErrors: CalendarEventFormErrors = {};
    
    // Required fields
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required';
    }
    
    if (!formData.type) {
      newErrors.type = 'Event type is required';
    }
    
    // Validate end time is after start time
    if (formData.startTime && formData.endTime && formData.endTime < formData.startTime) {
      newErrors.endTime = 'End time must be after start time';
    }
    
    // Recurrence validation - commented out as functionality is not fully implemented yet
    /*
    // Validate recurrence pattern if recurring
    if (formData.recurring && !formData.recurrencePattern) {
      newErrors.recurrencePattern = 'Recurrence pattern is required for recurring events';
    }
    
    // Validate recurrence end date is in the future
    if (formData.recurring && formData.recurrenceEnd) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (formData.recurrenceEnd < today) {
        newErrors.recurrenceEnd = 'Recurrence end date must be in the future';
      }
    }
    */
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      // Include familyId in the form data when submitting
      onSave({
        ...formData,
        familyId: familyId || family?.id || undefined,
      });
    }
  };
  
  // Handle form close
  const handleClose = () => {
    onClose();
  };
  
  return (
    <FormPage
      isOpen={isOpen}
      onClose={onClose}
      title={event ? 'Edit Event' : 'Add Event'}
      description="Schedule and manage calendar events"
      className="calendar-event-form-container"
    >
  <form onSubmit={handleSubmit} className="flex flex-col h-full">
    <FormPageContent className="flex-1">
          <div className="space-y-6 pb-20">
            {/* Event details section */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Event Details</h3>
              
              {/* Title */}
              <div className={styles.fieldGroup}>
                <label 
                  htmlFor="title" 
                  className="form-label"
                >
                  Title
                  <span className={styles.fieldRequired}>*</span>
                </label>
                <Input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full"
                  placeholder="Enter event title"
                />
                {errors.title && (
                  <div className={styles.fieldError}>
                    <AlertCircle className="h-3 w-3 inline mr-1" />
                    {errors.title}
                  </div>
                )}
              </div>
              
              {/* Event type */}
              <div className={styles.fieldGroup}>
                <label 
                  htmlFor="type" 
                  className="form-label"
                >
                  Event Type
                  <span className={styles.fieldRequired}>*</span>
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                    >
                      {formData.type.charAt(0) + formData.type.slice(1).toLowerCase().replace('_', ' ')}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    {Object.values(CalendarEventType).map(type => (
                      <DropdownMenuItem 
                        key={type} 
                        onClick={() => {
                          setFormData(prev => ({ ...prev, type }));
                          if (errors.type) {
                            setErrors(prev => ({ ...prev, type: undefined }));
                          }
                        }}
                      >
                        {type.charAt(0) + type.slice(1).toLowerCase().replace('_', ' ')}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {errors.type && (
                  <div className={styles.fieldError}>
                    <AlertCircle className="h-3 w-3 inline mr-1" />
                    {errors.type}
                  </div>
                )}
              </div>
              
              {/* All day checkbox */}
              <div className="flex items-center space-x-2 py-2">
                <Checkbox
                  id="allDay"
                  name="allDay"
                  checked={formData.allDay}
                  onCheckedChange={(checked) => 
                    handleCheckboxChange({
                      target: { name: 'allDay', checked: checked === true }
                    } as React.ChangeEvent<HTMLInputElement>)
                  }
                />
                <label htmlFor="allDay" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  All day event
                </label>
              </div>
              
              {/* Date and time - each on its own row */}
              <div className="space-y-4">
                {/* Start Date/Time - Full width */}
                <div className={styles.fieldGroup}>
                  <label 
                    htmlFor="startTime" 
                    className="form-label"
                  >
                    Start Time
                    <span className={styles.fieldRequired}>*</span>
                  </label>
                  <div className="grid w-full">
                    <DateTimePicker
                      className="flex-none"
                      value={selectedStartDateTime}
                      onChange={handleStartDateTimeChange}
                      disabled={formData.allDay} // Disable if allDay is checked
                      placeholder="Select start time..."
                    />
                  </div>
                  {errors.startTime && (
                    <div className={styles.fieldError}>
                      <AlertCircle className="h-3 w-3 inline mr-1" />
                      {errors.startTime}
                    </div>
                  )}
                </div>
                
                {/* End Date/Time - Full width */}
                <div className={styles.fieldGroup}>
                  <label 
                    htmlFor="endTime" 
                    className="form-label"
                  >
                    End Time
                  </label>
                  <div className="grid w-full">
                    <DateTimePicker
                      className="flex-none"
                      value={selectedEndDateTime}
                      onChange={handleEndDateTimeChange}
                      disabled={formData.allDay} // Disable if allDay is checked
                      placeholder="Select end time..."
                    />
                  </div>
                  {errors.endTime && (
                    <div className={styles.fieldError}>
                      <AlertCircle className="h-3 w-3 inline mr-1" />
                      {errors.endTime}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Location */}
              <div className={styles.fieldGroup}>
                <label 
                  htmlFor="location" 
                  className="form-label"
                >
                  Location
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    id="location"
                    name="location"
                    value={formData.location || ''}
                    onChange={handleChange}
                    className="w-full pl-8"
                    placeholder="Enter location (optional)"
                  />
                  <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                </div>
              </div>
              
              {/* Description */}
              <div className={styles.fieldGroup}>
                <label 
                  htmlFor="description" 
                  className="form-label"
                >
                  Description
                </label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description || ''}
                  onChange={handleChange}
                  className="w-full min-h-[100px]"
                  placeholder="Enter event description (optional)"
                />
              </div>
              
              {/* Color */}
              <div className={styles.fieldGroup}>
                <label 
                  htmlFor="color" 
                  className="form-label"
                >
                  Color
                </label>
                <div className="flex items-center space-x-2">
                  <div 
                    className="h-6 w-6 rounded-full border border-gray-300 dark:border-gray-700"
                    style={{ backgroundColor: formData.color || '#14b8a6' }}
                  />
                  <div className="w-8 h-8 overflow-hidden rounded-md border border-gray-300 dark:border-gray-700">
                    <input
                      type="color"
                      id="color"
                      name="color"
                      value={formData.color || '#14b8a6'}
                      onChange={handleColorChange}
                      className="w-10 h-10 cursor-pointer opacity-0 transform -translate-x-1 -translate-y-1"
                    />
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                    Custom color for this event
                  </span>
                </div>
              </div>
            </div>
            
            {/* Recurrence section - commented out as functionality is not fully implemented yet */}
            {/* 
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Recurrence</h3>
              
              <RecurrenceSelector
                recurring={formData.recurring}
                recurrencePattern={formData.recurrencePattern}
                recurrenceEnd={formData.recurrenceEnd}
                onRecurringChange={handleRecurringChange}
                onRecurrencePatternChange={handleRecurrencePatternChange}
                onRecurrenceEndChange={handleRecurrenceEndChange}
                error={{
                  recurrencePattern: errors.recurrencePattern,
                  recurrenceEnd: errors.recurrenceEnd,
                }}
              />
            </div>
            */}
            
            {/* Reminder section - commented out as functionality is not fully implemented yet */}
            {/*
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Reminder</h3>
              
              <div className="space-y-2">
                <label 
                  htmlFor="reminderTime" 
                  className="form-label flex items-center"
                >
                  <Bell className="h-4 w-4 mr-1.5 text-gray-500 dark:text-gray-400" />
                  Remind me
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                    >
                      {formData.reminderTime === undefined ? 'No reminder' :
                       formData.reminderTime === 0 ? 'At time of event' :
                       formData.reminderTime === 5 ? '5 minutes before' :
                       formData.reminderTime === 10 ? '10 minutes before' :
                       formData.reminderTime === 15 ? '15 minutes before' :
                       formData.reminderTime === 30 ? '30 minutes before' :
                       formData.reminderTime === 60 ? '1 hour before' :
                       formData.reminderTime === 120 ? '2 hours before' :
                       formData.reminderTime === 1440 ? '1 day before' : 'Custom'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuItem onClick={() => handleReminderTimeChange({ target: { value: '' } } as React.ChangeEvent<HTMLSelectElement>)}>
                      No reminder
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleReminderTimeChange({ target: { value: '0' } } as React.ChangeEvent<HTMLSelectElement>)}>
                      At time of event
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleReminderTimeChange({ target: { value: '5' } } as React.ChangeEvent<HTMLSelectElement>)}>
                      5 minutes before
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleReminderTimeChange({ target: { value: '10' } } as React.ChangeEvent<HTMLSelectElement>)}>
                      10 minutes before
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleReminderTimeChange({ target: { value: '15' } } as React.ChangeEvent<HTMLSelectElement>)}>
                      15 minutes before
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleReminderTimeChange({ target: { value: '30' } } as React.ChangeEvent<HTMLSelectElement>)}>
                      30 minutes before
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleReminderTimeChange({ target: { value: '60' } } as React.ChangeEvent<HTMLSelectElement>)}>
                      1 hour before
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleReminderTimeChange({ target: { value: '120' } } as React.ChangeEvent<HTMLSelectElement>)}>
                      2 hours before
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleReminderTimeChange({ target: { value: '1440' } } as React.ChangeEvent<HTMLSelectElement>)}>
                      1 day before
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            */}
            
            {/* People section */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>People</h3>
              
              {/* Babies - Only show if there's more than one active baby */}
              {babies.filter(baby => baby.inactive !== true).length > 1 ? (
                <div className={styles.fieldGroup}>
                  <label className="form-label">
                    Babies
                  </label>
                  <div className="space-y-2">
                    {babies.map(baby => (
                      <div key={baby.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`baby-${baby.id}`}
                          checked={formData.babyIds.includes(baby.id)}
                          onCheckedChange={() => handleBabyChange(baby.id)}
                        />
                        <label 
                          htmlFor={`baby-${baby.id}`} 
                          className={`text-sm font-medium ${
                            baby.inactive === true
                              ? "text-gray-400 dark:text-gray-500 italic" 
                              : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {baby.firstName} {baby.lastName}
                          {baby.inactive === true && " (inactive)"}
                        </label>
                      </div>
                    ))}
                    
                    {babies.length === 0 && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        No babies available
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // If there's only one active baby, it's automatically selected and the selector is hidden
                <div className="hidden">
                  {/* Hidden input to ensure the baby is selected */}
                  <input 
                    type="hidden" 
                    name="babyIds" 
                    value={babies.filter(baby => baby.inactive !== true)[0]?.id || ''} 
                  />
                  {/* Ensure the baby is selected in the form data */}
                  {(() => {
                    const activeBaby = babies.filter(baby => baby.inactive !== true)[0];
                    if (activeBaby && !formData.babyIds.includes(activeBaby.id)) {
                      // Use setTimeout to avoid state update during render
                      setTimeout(() => {
                        setFormData(prev => ({
                          ...prev,
                          babyIds: [activeBaby.id]
                        }));
                      }, 0);
                    }
                    return null;
                  })()}
                </div>
              )}
              
              {/* Caretakers */}
              <div className={styles.fieldGroup}>
                <label className="form-label">
                  Caretakers
                </label>
                <div className="space-y-2">
                  {caretakers.map(caretaker => (
                    <div key={caretaker.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`caretaker-${caretaker.id}`}
                        checked={formData.caretakerIds.includes(caretaker.id)}
                        onCheckedChange={() => handleCaretakerChange(caretaker.id)}
                      />
                      <label htmlFor={`caretaker-${caretaker.id}`} className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {caretaker.name} {caretaker.type ? `(${caretaker.type})` : ''}
                      </label>
                    </div>
                  ))}
                  
                  {caretakers.length === 0 && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      No caretakers available
                    </div>
                  )}
                </div>
              </div>
              
              {/* Contacts */}
              <div className={styles.fieldGroup}>
                <label className="form-label">
                  Contacts
                </label>
                <ContactSelector
                  contacts={localContacts}
                  selectedContactIds={formData.contactIds}
                  onContactsChange={handleContactsChange}
                  onAddNewContact={handleAddContact}
                  onEditContact={handleEditContact}
                  onDeleteContact={handleDeleteContact}
                />
              </div>
            </div>
            
          </div>
        </FormPageContent>
        
        <FormPageFooter>
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            
            {event && (
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  if (!event.id) return;
                  
      try {
        // Delete the event
        const response = await fetch(`/api/calendar-event?id=${event.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ familyId }), // Include familyId in the request body
        });
        
        const data = await response.json();
        
        if (data.success) {
          // Close the form
          onClose();
          
          // Call onSave with a special flag to indicate deletion
          // This will trigger a refresh in the parent components
          onSave({
            ...event,
            _deleted: true, // Special flag to indicate deletion
            familyId, // Include familyId in the event data
          });
        } else {
          console.error('Error deleting event:', data.error);
        }
      } catch (error) {
        console.error('Error deleting event:', error);
      }
                }}
                disabled={isLoading}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Delete
              </Button>
            )}
            
            <Button 
              type="submit" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Event'
              )}
            </Button>
          </div>
        </FormPageFooter>
      </form>
    </FormPage>
  );
};

export default CalendarEventForm;
