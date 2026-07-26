# ContactForm Component

A comprehensive form component for creating and editing contacts in the Baby Tracker application. This component provides a user-friendly interface for managing contact details including name, role, phone number, and email address.

## Features

- Create and edit contacts
- Delete existing contacts
- Form validation with error messages
- Loading state handling
- Responsive design for mobile and desktop
- Dark mode support
- Accessible UI with proper semantic structure

## Usage

```tsx
import { useState } from 'react';
import { ContactForm } from '@/src/components/forms/ContactForm';
import { Contact } from '@/src/components/CalendarEvent/calendar-event.types';

function ContactsPage() {
  const [showContactForm, setShowContactForm] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | undefined>(undefined);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSaveContact = async (contactData) => {
    setIsLoading(true);
    try {
      // Save contact to database
      const response = await fetch('/api/contact', {
        method: contactData.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactData),
      });
      
      if (response.ok) {
        // Handle success
        setShowContactForm(false);
        // Refresh contacts
        fetchContacts();
      } else {
        // Handle error
        console.error('Failed to save contact');
      }
    } catch (error) {
      console.error('Error saving contact:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteContact = async (contactId) => {
    setIsLoading(true);
    try {
      // Delete contact from database
      const response = await fetch(`/api/contact?id=${contactId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Handle success
        setShowContactForm(false);
        // Refresh contacts
        fetchContacts();
      } else {
        // Handle error
        console.error('Failed to delete contact');
      }
    } catch (error) {
      console.error('Error deleting contact:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div>
      <button onClick={() => {
        setSelectedContact(undefined);
        setShowContactForm(true);
      }}>
        Add Contact
      </button>
      
      <ContactForm
        isOpen={showContactForm}
        onClose={() => setShowContactForm(false)}
        contact={selectedContact}
        onSave={handleSaveContact}
        onDelete={handleDeleteContact}
        isLoading={isLoading}
      />
      
      {/* Contact list */}
      <div>
        {contacts.map(contact => (
          <div 
            key={contact.id}
            onClick={() => {
              setSelectedContact(contact);
              setShowContactForm(true);
            }}
          >
            <h3>{contact.name}</h3>
            <p>{contact.role}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Component API

### ContactForm

Main component for creating and editing contacts.

#### Props

| Prop | Type | Description | Default |
|------|------|-------------|---------|
| `isOpen` | `boolean` | Whether the form is open | Required |
| `onClose` | `() => void` | Handler for when the form is closed | Required |
| `contact` | `Contact` | The contact to edit (undefined for new contacts) | `undefined` |
| `onSave` | `(contact: ContactFormData) => void` | Handler for when the form is submitted | Required |
| `onDelete` | `(contactId: string) => void` | Handler for when a contact is deleted | `undefined` |
| `isLoading` | `boolean` | Whether the form is in a loading state | `false` |
| `appearance` | `'default' \| 'storybook'` | Defaults to `'default'` (the classic `FormPage` slide-in). `'storybook'` renders the form inside a stacked `StorybookDrawer` for use in the account manager. Both appearances share the same `formData` state, validation, `handleSubmit`, and `handleDelete` — only the presentation differs. | `'default'` |

### ContactFormData

Interface representing the form data for a contact.

```typescript
interface ContactFormData {
  id?: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
}
```

## Form Sections

The form is organized into a single section:

1. **Contact Details**
   - Name (required)
   - Role (required)
   - Phone Number (optional)
   - Email Address (optional)

## Implementation Details

The component is built using:
- React with TypeScript for type safety
- React Hooks for state management
- Tailwind CSS for styling
- Lucide React for icons
- FormPage component for layout and structure

The component follows a modular structure:
- `index.tsx` - Main component implementation
- `contact-form.styles.ts` - Style definitions using Tailwind CSS
- `contact-form.types.ts` - TypeScript type definitions
- `README.md` - Documentation

## Accessibility

The component includes:
- Proper semantic HTML structure
- Form labels associated with inputs
- Required field indicators
- Error messages for invalid inputs
- ARIA labels for buttons
- Keyboard navigable interactive elements
- Focus management
- Color contrast that meets WCAG guidelines

## Cross-Platform Considerations

This component is designed with cross-platform compatibility in mind:

- Uses standard React patterns that can be adapted to React Native
- Avoids web-specific APIs
- Uses relative sizing that can be adapted to different screen sizes
- Implements touch-friendly button sizes
- Separates styling from component logic for easier platform adaptation

When converting to React Native, the form inputs would need to be replaced with React Native equivalents, and the modal would need to be implemented using React Native's Modal component.
