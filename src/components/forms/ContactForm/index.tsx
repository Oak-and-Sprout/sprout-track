import React, { useState, useEffect, useId } from 'react';
import { ContactFormProps, ContactFormData, ContactFormErrors } from './contact-form.types';
import { contactFormStyles as styles } from './contact-form.styles';
import { AlertCircle, Loader2, Trash2, Mail, Phone, User, Briefcase } from 'lucide-react';
import { FormPage, FormPageContent, FormPageFooter } from '@/src/components/ui/form-page';
import { StorybookDrawer } from '@/src/components/ui/storybook-drawer';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { useToast } from '@/src/components/ui/toast';
import { handleExpirationError } from '@/src/lib/expiration-error-handler';
import { useLocalization } from '@/src/context/localization';

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
  appearance = 'default',
}) => {
  const { showToast } = useToast();
  const { t } = useLocalization();
  const formId = useId();

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
      newErrors.name = t('Name is required');
    }
    
    if (!formData.role.trim()) {
      newErrors.role = t('Role is required');
    }
    
    // Email validation
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('Please enter a valid email address');
    }
    
    // Phone validation (simple check for now)
    if (formData.phone && !/^[0-9+\-() ]{7,}$/.test(formData.phone)) {
      newErrors.phone = t('Please enter a valid phone number');
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
              title: t('Error'),
              message: errorData.error || t('Failed to save contact'),
              duration: 5000,
            });
            throw new Error(errorData.error || t('Failed to save contact'));
          }
        }
        
        // For other errors, parse and show toast
        const errorData = await response.json();
        showToast({
          variant: 'error',
          title: t('Error'),
          message: errorData.error || t('Failed to save contact'),
          duration: 5000,
        });
        throw new Error(errorData.error || t('Failed to save contact'));
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
          title: t('Error'),
          message: result.error || t('Failed to save contact'),
          duration: 5000,
        });
        throw new Error(result.error || t('Failed to save contact'));
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
              title: t('Error'),
              message: errorData.error || t('Failed to delete contact'),
              duration: 5000,
            });
            throw new Error(errorData.error || t('Failed to delete contact'));
          }
        }
        
        // For other errors, parse and show toast
        const errorData = await response.json();
        showToast({
          variant: 'error',
          title: t('Error'),
          message: errorData.error || t('Failed to delete contact'),
          duration: 5000,
        });
        throw new Error(errorData.error || t('Failed to delete contact'));
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
            title: t('Error'),
            message: result.error || t('Failed to delete contact'),
            duration: 5000,
          });
          throw new Error(result.error || t('Failed to delete contact'));
        }
      }
    } catch (error) {
      console.error('Error deleting contact:', error);
      // Error toast already shown above for API errors
    } finally {
      setIsLoading(false);
    }
  };
  
  if (appearance === 'storybook') {
    return (
      <StorybookDrawer
        open={isOpen}
        onClose={onClose}
        onBack={onClose}
        title={contact ? t('Edit contact') : t('Add a contact')}
        subtitle={t('The numbers everyone should be able to find.')}
        footer={
          <>
            {contact && onDelete && (
              <button type="button" className="sb-btn sb-danger sb-sm" style={{ marginRight: 'auto' }}
                onClick={handleDelete} disabled={isLoading}>
                {t('Delete')}
              </button>
            )}
            <button type="button" className="sb-btn sb-ghost" onClick={onClose}>{t('Cancel')}</button>
            <button type="button" className="sb-btn" onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? t('Saving…') : t('Save contact')}
            </button>
          </>
        }
      >
        <div className="sb-f-grid">
          <div className="sb-f2">
            <div>
              <label className="sb-fl" htmlFor="sbCoName">{t('Name')}</label>
              <input id="sbCoName" className="sb-fi" placeholder={t('Dr. Alvarez')}
                name="name"
                value={formData.name}
                onChange={handleChange} />
              {errors.name && <p className="sb-form-error">{errors.name}</p>}
            </div>
            <div>
              <label className="sb-fl" htmlFor="sbCoRole">{t('Role')}</label>
              <input id="sbCoRole" className="sb-fi" placeholder={t('Pediatrician, grandma, sitter…')}
                name="role"
                value={formData.role}
                onChange={handleChange} />
              {errors.role && <p className="sb-form-error">{errors.role}</p>}
            </div>
          </div>
          <div className="sb-f2">
            <div>
              <label className="sb-fl" htmlFor="sbCoPhone">
                {t('Phone')} <span className="sb-fl-opt">({t('optional')})</span>
              </label>
              <input id="sbCoPhone" className="sb-fi" type="tel" placeholder="(816) 555-0134"
                name="phone"
                value={formData.phone || ''}
                onChange={handleChange} />
              {errors.phone && <p className="sb-form-error">{errors.phone}</p>}
            </div>
            <div>
              <label className="sb-fl" htmlFor="sbCoEmail">
                {t('Email')} <span className="sb-fl-opt">({t('optional')})</span>
              </label>
              <input id="sbCoEmail" className="sb-fi" type="email" placeholder={t('name@example.com')}
                name="email"
                value={formData.email || ''}
                onChange={handleChange} />
              {errors.email && <p className="sb-form-error">{errors.email}</p>}
            </div>
          </div>
        </div>
      </StorybookDrawer>
    );
  }

  return (
    <FormPage
      isOpen={isOpen}
      onClose={onClose}
      title={contact ? t('Edit Contact') : t('Add Contact')}
      description={contact ? t('Update contact details') : t('Add a new contact to your list')}
      className="contact-form-container"
    >
      <div className="h-full flex flex-col">
        <FormPageContent className="overflow-y-auto">
          <div className="space-y-6">
            {/* Contact details section */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>{t('Contact Details')}</h3>
              
              {/* Name */}
              <div className={styles.fieldGroup}>
                <label 
                  htmlFor={`${formId}-name`}
                  className="form-label"
                >
                  {t('Name')}
                  <span className={styles.fieldRequired}>*</span>
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    id={`${formId}-name`}
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full pl-9"
                    placeholder={t("Enter contact name")}
                    aria-invalid={errors.name ? true : undefined}
                    aria-describedby={errors.name ? `${formId}-name-error` : undefined}
                  />
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" aria-hidden="true" />
                </div>
                {errors.name && (
                  <div id={`${formId}-name-error`} role="alert" className={styles.fieldError}>
                    <AlertCircle className="h-3 w-3 inline mr-1" aria-hidden="true" />
                    {errors.name}
                  </div>
                )}
              </div>
              
              {/* Role */}
              <div className={styles.fieldGroup}>
                <label 
                  htmlFor={`${formId}-role`}
                  className="form-label"
                >
                  {t('Role')}
                  <span className={styles.fieldRequired}>*</span>
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    id={`${formId}-role`}
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full pl-9"
                    placeholder={t("Enter contact role (e.g., Doctor, Family)")}
                    aria-invalid={errors.role ? true : undefined}
                    aria-describedby={errors.role ? `${formId}-role-error` : undefined}
                  />
                  <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" aria-hidden="true" />
                </div>
                {errors.role && (
                  <div id={`${formId}-role-error`} role="alert" className={styles.fieldError}>
                    <AlertCircle className="h-3 w-3 inline mr-1" aria-hidden="true" />
                    {errors.role}
                  </div>
                )}
              </div>
              
              {/* Phone */}
              <div className={styles.fieldGroup}>
                <label 
                  htmlFor={`${formId}-phone`}
                  className="form-label"
                >
                  {t('Phone Number')}
                </label>
                <div className="relative">
                  <Input
                    type="tel"
                    id={`${formId}-phone`}
                    name="phone"
                    value={formData.phone || ''}
                    onChange={handleChange}
                    className="w-full pl-9"
                    placeholder={t("Enter phone number (optional)")}
                    aria-invalid={errors.phone ? true : undefined}
                    aria-describedby={errors.phone ? `${formId}-phone-error` : undefined}
                  />
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" aria-hidden="true" />
                </div>
                {errors.phone && (
                  <div id={`${formId}-phone-error`} role="alert" className={styles.fieldError}>
                    <AlertCircle className="h-3 w-3 inline mr-1" aria-hidden="true" />
                    {errors.phone}
                  </div>
                )}
              </div>
              
              {/* Email */}
              <div className={styles.fieldGroup}>
                <label 
                  htmlFor={`${formId}-email`}
                  className="form-label"
                >
                  {t('Email Address')}
                </label>
                <div className="relative">
                  <Input
                    type="email"
                    id={`${formId}-email`}
                    name="email"
                    value={formData.email || ''}
                    onChange={handleChange}
                    className="w-full pl-9"
                    placeholder={t("Enter email address (optional)")}
                    aria-invalid={errors.email ? true : undefined}
                    aria-describedby={errors.email ? `${formId}-email-error` : undefined}
                  />
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" aria-hidden="true" />
                </div>
                {errors.email && (
                  <div id={`${formId}-email-error`} role="alert" className={styles.fieldError}>
                    <AlertCircle className="h-3 w-3 inline mr-1" aria-hidden="true" />
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
                <Trash2 className="h-4 w-4 mr-1.5" aria-hidden="true" />
                {t('Delete')}
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
                {t('Cancel')}
              </Button>
              
              <Button 
                type="button"
                onClick={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" aria-hidden="true" />
                    {t('Saving...')}
                  </>
                ) : (
                  t('Save Contact')
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
