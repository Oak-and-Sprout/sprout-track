import { Contact } from '@/src/components/CalendarEvent/calendar-event.types';

/**
 * Type definitions for the ContactForm component
 */

export interface ContactFormProps {
  /**
   * Whether the form is open
   */
  isOpen: boolean;
  
  /**
   * Handler for when the form is closed
   */
  onClose: () => void;
  
  /**
   * The contact to edit (undefined for new contacts)
   */
  contact?: Contact;
  
  /**
   * Handler for when the form is submitted
   */
  onSave: (contact: ContactFormData) => void;
  
  /**
   * Handler for when a contact is deleted
   */
  onDelete?: (contactId: string) => void;
  
  /**
   * Whether the form is in a loading state
   */
  isLoading?: boolean;

  /**
   * 'storybook' renders the stacked storybook drawer (account manager); default is the classic FormPage.
   */
  appearance?: 'default' | 'storybook';
}

/**
 * Form data for contacts
 */
export interface ContactFormData {
  id?: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
}

/**
 * Form errors
 */
export interface ContactFormErrors {
  name?: string;
  role?: string;
  phone?: string;
  email?: string;
}
