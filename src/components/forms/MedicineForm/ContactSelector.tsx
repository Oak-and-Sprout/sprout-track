import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/src/lib/utils';
import { Check, X, Plus, Phone, Mail, Edit, User } from 'lucide-react';
import { Label } from '@/src/components/ui/label';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import ContactForm from '@/src/components/forms/ContactForm';
import { Contact } from '@/src/components/CalendarEvent/calendar-event.types';
import { useLocalization } from '@/src/context/localization';

interface ContactSelectorProps {
  contacts: Contact[];
  selectedContactIds: string[];
  onContactsChange: (contactIds: string[]) => void;
  onAddNewContact?: (contact: Contact) => void;
  onEditContact?: (contact: Contact) => void;
  onDeleteContact?: (contactId: string) => void;
}

/**
 * ContactSelector Component
 * 
 * A component for selecting contacts for medicines.
 * Allows searching, selecting, and managing contacts.
 */
const ContactSelector: React.FC<ContactSelectorProps> = ({
  contacts,
  selectedContactIds,
  onContactsChange,
  onAddNewContact,
  onEditContact,
  onDeleteContact,
}) => {

  const { t } = useLocalization();
  const [searchTerm, setSearchTerm] = useState('');
  const [showContactForm, setShowContactForm] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  
  // Fetch contacts from API - memoized to avoid dependency issues
  const fetchContacts = useCallback(async () => {
    try {
      // Fetch contacts from API
      const url = `/api/contact`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch contacts');
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        // If we have a callback to update contacts in the parent component
        if (onAddNewContact && Array.isArray(result.data)) {
          // Update the contacts list with any new contacts
          result.data.forEach((contact: Contact) => {
            if (!contacts.some(c => c.id === contact.id)) {
              onAddNewContact(contact);
            }
          });
        }
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  }, [onAddNewContact]); // Remove contacts dependency to prevent repeated calls
  
  // Fetch contacts on component mount only
  useEffect(() => {
    // Only fetch if we have the callback to update contacts and haven't fetched yet
    if (onAddNewContact && contacts.length === 0) {
      fetchContacts();
    }
  }, [onAddNewContact]); // Remove fetchContacts dependency to prevent repeated calls
  
  // Filter contacts based on search term
  const filteredContacts = contacts.filter(contact => 
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.role.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Get selected contacts
  const selectedContacts = contacts.filter(contact => 
    selectedContactIds.includes(contact.id)
  );
  
  // Toggle contact selection
  const toggleContact = (contactId: string) => {  

    if (selectedContactIds.includes(contactId)) {
      onContactsChange(selectedContactIds.filter(id => id !== contactId));
    } else {
      onContactsChange([...selectedContactIds, contactId]);
    }
  };
  
  // Remove contact from selection
  const removeContact = (contactId: string) => {
    onContactsChange(selectedContactIds.filter(id => id !== contactId));
  };
  
  // Group contacts by role
  const contactsByRole = filteredContacts.reduce<Record<string, Contact[]>>((acc, contact) => {
    if (!acc[contact.role]) {
      acc[contact.role] = [];
    }
    acc[contact.role].push(contact);
    return acc;
  }, {});
  
  // Handle saving a contact
  const handleSaveContact = async (contactData: any) => {
    setIsLoading(true);
    
    try {
      // Close only the contact form
      setShowContactForm(false);
      setSelectedContact(undefined);
      
      // Then update the parent component
      // If it's a new contact
      if (onAddNewContact) {
        // Always pass the contact data to the parent component
        onAddNewContact(contactData);
        
        // Auto-select the newly added contact if it has an ID
        if (contactData.id) {
          onContactsChange([...selectedContactIds, contactData.id]);
        }
      } 
      // If it's an existing contact
      else if (contactData.id && onEditContact) {
        onEditContact(contactData);
      }
      
      // Immediately refresh contacts list from the API
      await fetchContacts();
    } catch (error) {
      console.error('Error handling saved contact:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle deleting a contact
  const handleDeleteContact = async (contactId: string) => {
    if (onDeleteContact) {
      setIsLoading(true);
      
      try {
        // Close the form first to prevent UI issues
        setShowContactForm(false);
        setSelectedContact(undefined);
        
        // Update the parent component
        onDeleteContact(contactId);
        
        // Remove the contact from selection if it's selected
        if (selectedContactIds.includes(contactId)) {
          onContactsChange(selectedContactIds.filter(id => id !== contactId));
        }
        
        // Refresh contacts list from the API
        await fetchContacts();
      } catch (error) {
        console.error('Error handling contact deletion:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  return (
    <div className="space-y-2">
      {/* Search input */}
      <div className="relative">
        <Input
          type="text"
          placeholder="Search contacts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="contact-selector-clear-button absolute right-2 top-2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      
      {/* Contact list */}
      <div className="contact-selector-list max-h-40 overflow-y-auto rounded-md border border-gray-300 bg-white p-1">
        {Object.entries(contactsByRole).map(([role, roleContacts]) => (
          <div key={role} className="mb-2 last:mb-0">
            <div className="contact-selector-role-header px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
              {role}
            </div>
            {roleContacts.map(contact => (
              <div
                key={contact.id}
                className={cn(
                  "contact-selector-item flex items-center px-2 py-1 rounded-md hover:bg-gray-100",
                  selectedContactIds.includes(contact.id) && "contact-selector-item-selected bg-teal-50",
                  "cursor-pointer flex justify-between"
                )}
              >
                <div 
                  className="flex-1 flex items-start"
                  onClick={() => toggleContact(contact.id)}
                >
                  <div className="flex-shrink-0 w-4 mt-1">
                    {selectedContactIds.includes(contact.id) && (
                      <Check className="contact-selector-check-icon h-4 w-4 text-teal-600" />
                    )}
                  </div>
                  <div className="ml-2 text-sm text-gray-700 contact-selector-contact-info">
                    <div className="font-medium">{contact.name}</div>
                    <div className="contact-selector-contact-details text-xs text-gray-500 flex flex-wrap gap-2">
                      {contact.phone && (
                        <span className="flex items-center">
                          <Phone className="h-3 w-3 mr-1" />
                          {contact.phone}
                        </span>
                      )}
                      {contact.email && (
                        <span className="flex items-center">
                          <Mail className="h-3 w-3 mr-1" />
                          {contact.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {onEditContact && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedContact(contact);
                      setShowContactForm(true);
                    }}
                    className="contact-selector-edit-button p-1 text-gray-400 hover:text-gray-600"
                    aria-label={`Edit ${contact.name}`}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
        
        {filteredContacts.length === 0 && (
          <div className="contact-selector-empty-state p-2 text-sm text-gray-500 text-center">
            {searchTerm ? 'No contacts found' : 'No contacts available'}
          </div>
        )}
        
        {/* Contact Form */}
        {showContactForm && (
          <ContactForm
            isOpen={showContactForm}
            onClose={() => {
              setShowContactForm(false);
              setSelectedContact(undefined);
            }}
            contact={selectedContact}
            onSave={handleSaveContact}
            onDelete={handleDeleteContact}
            isLoading={isLoading}
          />
        )}
      </div>
      
      {/* Selected contacts */}
      {selectedContacts.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedContacts.map(contact => (
            <div key={contact.id} className="contact-selector-selected-tag flex items-center rounded-full bg-teal-100 px-2 py-1 text-xs text-teal-800">
              <User className="contact-selector-selected-tag-icon h-3 w-3 mr-1 text-teal-600" />
              <span>{contact.name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeContact(contact.id);
                }}
                className="contact-selector-remove-tag-button ml-1 h-3 w-3 text-teal-600 hover:text-teal-800"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Add new contact button */}
      {onAddNewContact && (
        <div className="mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSelectedContact(undefined);
              setShowContactForm(true);
            }}
            className="w-full"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {t('Add New Contact')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ContactSelector;
