import React, { useState, useEffect } from 'react';
import { ContactFormProps, ContactFormData, ContactFormErrors } from './contact-form.types';
import { contactFormStyles as styles } from './contact-form.styles';
import { AlertCircle, Loader2, Trash2, Mail, Phone, User, Briefcase } from 'lucide-react';
import { FormPage, FormPageContent, FormPageFooter } from '@/src/components/ui/form-page';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { useToast } from '@/src/components/ui/toast';
import { handleExpirationError } from '@/src/lib/expiration-error-handler';

/**
 * ContactForm Component
 * 
 * A form for creating and editing contacts.
 * Includes fields for contact details and role.
 */
const ContactForm: React.FC<ContactFormProps> = ({
  isOpen,
  onClose,
  contact,
  onSave,
  onDelete,
  isLoading: externalIsLoading = false,
}) => {
  const { showToast } = useToast();
  // Local loading state
  const [isLoading, setIsLoading] = useState(externalIsLoading);
  
  // Update local loading state when external loading state changes
  useEffect(() => {
    setIsLoading(externalIsLoading);
  }, [externalIsLoading]);
  
  // Initialize form data
  const [formData, setFormData] = useState<ContactFormData>(() => {
    if (contact) {
      // Convert from Contact type to ContactFormData type
      return {
        id: contact.id,
        name: contact.name,
        role: contact.role,
        phone: contact.phone || undefined, // Convert null to undefined
        email: contact.email || undefined, // Convert null to undefined
      };
    }
    
    // Default values for new contact
    return {
      name: '',
      role: '',
      phone: undefined,
      email: undefined,
    };
  });
  
  // Update form data when contact changes or when form opens/closes
  useEffect(() => {
    if (contact && isOpen && !isLoading) {
      // Convert from Contact type to ContactFormData type
      setFormData({
        id: contact.id,
        name: contact.name,
        role: contact.role,
        phone: contact.phone || undefined, // Convert null to undefined
        email: contact.email || undefined, // Convert null to undefined
      });
    } else if (!isOpen && !isLoading) {
      // Reset form data for new contact
      setFormData({
        name: '',
        role: '',
        phone: undefined,
        email: undefined,
      });
    }
    // Also reset errors when form data changes
    if (!isLoading) {
      setErrors({});
    }
  }, [contact?.id, isOpen, isLoading]); // Use contact.id instead of full contact object to prevent unnecessary resets
  
  // Form validation errors
  const [errors, setErrors] = useState<ContactFormErrors>({});
  
  // Handle form field changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for the field
    if (errors[name as keyof ContactFormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };
  
  // Validate form before submission
  const validateForm = (): boolean => {
    const newErrors: ContactFormErrors = {};
    
    // Required fields
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.role.trim()) {
      newErrors.role = 'Role is required';
    }
    
    // Email validation
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    // Phone validation (simple check for now)
    if (formData.phone && !/^[0-9+\-() ]{7,}$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Get auth token from localStorage
      const authToken = localStorage.getItem('authToken');
      
      if (!authToken) {
        console.error('Authentication token not found');
        return;
      }
      
      // Determine if this is a create or update operation
      const isUpdate = !!formData.id;
      
      // Prepare request URL and method
      const url = isUpdate 
        ? `/api/contact?id=${formData.id}`
        : '/api/contact';
      
      const method = isUpdate ? 'PUT' : 'POST';
      
      // Prepare request payload
      const payload = {
        name: formData.name,
        role: formData.role,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
      };
      
      // Send request to API
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        // Check if this is an account expiration error
        if (response.status === 403) {
          const { isExpirationError, errorData } = await handleExpirationError(response, showToast, 'managing contacts');
          if (isExpirationError) {
            // Don't close the form, let user see the error
            return;
          }
          // If it's a 403 but not an expiration error, use the errorData we got
          if (errorData) {
            showToast({
              variant: 'error',
              title: 'Error',
              message: errorData.error || 'Failed to save contact',
              duration: 5000,
            });
            throw new Error(errorData.error || 'Failed to save contact');
          }
        }
        
        // For other errors, parse and show toast
        const errorData = await response.json();
        showToast({
          variant: 'error',
          title: 'Error',
          message: errorData.error || 'Failed to save contact',
          duration: 5000,
        });
        throw new Error(errorData.error || 'Failed to save contact');
      }

      const result = await response.json();
      
      if (result.success) {
        // Call the onSave callback with the saved contact
        onSave(result.data);
        
        // Reset form data to defaults
        setFormData({
          name: '',
          role: '',
          phone: undefined,
          email: undefined,
        });
        
        // Close the form
        onClose();
      } else {
        showToast({
          variant: 'error',
          title: 'Error',
          message: result.error || 'Failed to save contact',
          duration: 5000,
        });
        throw new Error(result.error || 'Failed to save contact');
      }
    } catch (error) {
      console.error('Error saving contact:', error);
      // Error toast already shown above for API errors
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle contact deletion
  const handleDelete = async () => {
    if (!contact?.id || !onDelete) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Get auth token from localStorage
      const authToken = localStorage.getItem('authToken');
      
      if (!authToken) {
        console.error('Authentication token not found');
        return;
      }
      
      // Send delete request to API
      const response = await fetch(`/api/contact?id=${contact.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      
      if (!response.ok) {
        // Check if this is an account expiration error
        if (response.status === 403) {
          const { isExpirationError, errorData } = await handleExpirationError(response, showToast, 'managing contacts');
          if (isExpirationError) {
            // Don't close the form, let user see the error
            return;
          }
          // If it's a 403 but not an expiration error, use the errorData we got
          if (errorData) {
            showToast({
              variant: 'error',
              title: 'Error',
              message: errorData.error || 'Failed to delete contact',
              duration: 5000,
            });
            throw new Error(errorData.error || 'Failed to delete contact');
          }
        }
        
        // For other errors, parse and show toast
        const errorData = await response.json();
        showToast({
          variant: 'error',
          title: 'Error',
          message: errorData.error || 'Failed to delete contact',
          duration: 5000,
        });
        throw new Error(errorData.error || 'Failed to delete contact');
      }
      
      // Handle 204 No Content response (successful deletion)
      if (response.status === 204) {
        // Call the onDelete callback
        onDelete(contact.id);
        
        // Reset form data to defaults
        setFormData({
          name: '',
          role: '',
          phone: undefined,
          email: undefined,
        });
        
        // Close the form
        onClose();
      } else {
        // Handle other success responses with JSON body
        const result = await response.json();
        
        if (result.success) {
          // Call the onDelete callback
          onDelete(contact.id);
          
          // Reset form data to defaults
          setFormData({
            name: '',
            role: '',
            phone: undefined,
            email: undefined,
          });
          
          // Close the form
          onClose();
        } else {
          showToast({
            variant: 'error',
            title: 'Error',
            message: result.error || 'Failed to delete contact',
            duration: 5000,
          });
          throw new Error(result.error || 'Failed to delete contact');
        }
      }
    } catch (error) {
      console.error('Error deleting contact:', error);
      // Error toast already shown above for API errors
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <FormPage
      isOpen={isOpen}
      onClose={onClose}
      title={contact ? 'Edit Contact' : 'Add Contact'}
      description={contact ? 'Update contact details' : 'Add a new contact to your list'}
      className="contact-form-container"
    >
      <div className="h-full flex flex-col">
        <FormPageContent className="overflow-y-auto">
          <div className="space-y-6">
            {/* Contact details section */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Contact Details</h3>
              
              {/* Name */}
              <div className={styles.fieldGroup}>
                <label 
                  htmlFor="name" 
                  className="form-label"
                >
                  Name
                  <span className={styles.fieldRequired}>*</span>
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full pl-9"
                    placeholder="Enter contact name"
                  />
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                </div>
                {errors.name && (
                  <div className={styles.fieldError}>
                    <AlertCircle className="h-3 w-3 inline mr-1" />
                    {errors.name}
                  </div>
                )}
              </div>
              
              {/* Role */}
              <div className={styles.fieldGroup}>
                <label 
                  htmlFor="role" 
                  className="form-label"
                >
                  Role
                  <span className={styles.fieldRequired}>*</span>
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full pl-9"
                    placeholder="Enter contact role (e.g., Doctor, Family)"
                  />
                  <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                </div>
                {errors.role && (
                  <div className={styles.fieldError}>
                    <AlertCircle className="h-3 w-3 inline mr-1" />
                    {errors.role}
                  </div>
                )}
              </div>
              
              {/* Phone */}
              <div className={styles.fieldGroup}>
                <label 
                  htmlFor="phone" 
                  className="form-label"
                >
                  Phone Number
                </label>
                <div className="relative">
                  <Input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone || ''}
                    onChange={handleChange}
                    className="w-full pl-9"
                    placeholder="Enter phone number (optional)"
                  />
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                </div>
                {errors.phone && (
                  <div className={styles.fieldError}>
                    <AlertCircle className="h-3 w-3 inline mr-1" />
                    {errors.phone}
                  </div>
                )}
              </div>
              
              {/* Email */}
              <div className={styles.fieldGroup}>
                <label 
                  htmlFor="email" 
                  className="form-label"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email || ''}
                    onChange={handleChange}
                    className="w-full pl-9"
                    placeholder="Enter email address (optional)"
                  />
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                </div>
                {errors.email && (
                  <div className={styles.fieldError}>
                    <AlertCircle className="h-3 w-3 inline mr-1" />
                    {errors.email}
                  </div>
                )}
              </div>
            </div>
          </div>
        </FormPageContent>
        
        <FormPageFooter>
          <div className="flex justify-between w-full">
            {/* Delete button (only shown when editing) */}
            {contact && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isLoading}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Delete
              </Button>
            )}
            
            {/* Right-aligned buttons */}
            <div className="flex space-x-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              
              <Button 
                type="button"
                onClick={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Contact'
                )}
              </Button>
            </div>
          </div>
        </FormPageFooter>
      </div>
    </FormPage>
  );
};

export default ContactForm;
