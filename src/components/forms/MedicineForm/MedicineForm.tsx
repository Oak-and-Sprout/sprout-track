'use client';

import React, { useState, useEffect } from 'react';
import { medicineFormStyles as styles } from './medicine-form.styles';
import { MedicineFormData } from './medicine-form.types';
import { PillBottle, Loader2, AlertCircle, Clock, FileText } from 'lucide-react';
import { FormPage, FormPageContent, FormPageFooter } from '@/src/components/ui/form-page';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Button } from '@/src/components/ui/button';
import { Switch } from '@/src/components/ui/switch';
import { Label } from '@/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { Contact } from '@/src/components/CalendarEvent/calendar-event.types';
import ContactSelector from './ContactSelector';
import { useLocalization } from '@/src/context/localization';

interface MedicineFormProps {
  isOpen: boolean;
  onClose: () => void;
  medicine?: any;
  units: {unitAbbr: string, unitName: string}[];
  contacts: {id: string, name: string, role: string}[];
  onSave: (formData: MedicineFormData) => Promise<void>;
}

/**
 * MedicineForm Component
 * 
 * A form for creating and editing medicines.
 * Includes fields for medicine details and contact associations.
 */
const MedicineForm: React.FC<MedicineFormProps> = ({
  isOpen,
  onClose,
  medicine,
  units,
  contacts,
  onSave,
}) => {

  const { t } = useLocalization();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Convert contacts to Contact type
  const convertedContacts: Contact[] = contacts.map(c => ({
    id: c.id,
    name: c.name,
    role: c.role,
    phone: null,
    email: null,
    address: null,
    notes: null
  }));
  
  // State for contacts
  const [localContacts, setLocalContacts] = useState<Contact[]>(convertedContacts);
  
  // State for dose minimum time selector
  const [doseTimeValue, setDoseTimeValue] = useState<string>('');
  const [doseTimeUnit, setDoseTimeUnit] = useState<'hours' | 'days'>('hours');
  
  // Helper function to parse doseMinTime from DD:HH:MM format
  const parseDoseMinTime = (doseMinTime: string) => {  

    if (!doseMinTime) {
      setDoseTimeValue('');
      setDoseTimeUnit('hours');
      return;
    }
    
    const timeRegex = /^([0-9]{1,2}):([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
    if (timeRegex.test(doseMinTime)) {
      const [days, hours, minutes] = doseMinTime.split(':').map(Number);
      
      // Convert to total hours for easier handling
      const totalHours = (days * 24) + hours + (minutes / 60);
      
      // If less than 24 hours, show in hours, otherwise show in days
      if (totalHours < 24) {
        setDoseTimeValue(totalHours.toString());
        setDoseTimeUnit('hours');
      } else {
        const totalDays = totalHours / 24;
        setDoseTimeValue(totalDays.toString());
        setDoseTimeUnit('days');
      }
    }
  };
  
  // Helper function to format time value and unit to DD:HH:MM format
  const formatDoseMinTime = (value: string, unit: 'hours' | 'days'): string => {
    if (!value || value === '0') return '';
    
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) return '';
    
    let totalHours: number;
    if (unit === 'days') {
      totalHours = numValue * 24;
    } else {
      totalHours = numValue;
    }
    
    const days = Math.floor(totalHours / 24);
    const hours = Math.floor(totalHours % 24);
    const minutes = Math.floor((totalHours % 1) * 60);
    
    return `${days.toString().padStart(2, '0')}:${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };
  
  // Initialize form data
  const [formData, setFormData] = useState<MedicineFormData>(() => {
    if (medicine) {
      return {
        id: medicine.id,
        name: medicine.name,
        typicalDoseSize: medicine.typicalDoseSize,
        unitAbbr: medicine.unitAbbr || '',
        doseMinTime: medicine.doseMinTime || '',
        notes: medicine.notes || '',
        active: medicine.active,
        contactIds: medicine.contacts?.map((c: any) => c.contact.id) || [],
      };
    }
    
    // Default values for new medicine
    return {
      name: '',
      typicalDoseSize: undefined,
      unitAbbr: '',
      doseMinTime: '',
      notes: '',
      active: true,
      contactIds: [],
    };
  });
  
  // Update form data when medicine changes or when form opens/closes
  useEffect(() => {
    if (medicine) {
      const medicineData = {
        id: medicine.id,
        name: medicine.name,
        typicalDoseSize: medicine.typicalDoseSize,
        unitAbbr: medicine.unitAbbr || '',
        doseMinTime: medicine.doseMinTime || '',
        notes: medicine.notes || '',
        active: medicine.active,
        contactIds: medicine.contacts?.map((c: any) => c.contact.id) || [],
      };
      setFormData(medicineData);
      // Parse the existing doseMinTime for the time selector
      parseDoseMinTime(medicine.doseMinTime || '');
    } else {
      setFormData({
        name: '',
        typicalDoseSize: undefined,
        unitAbbr: '',
        doseMinTime: '',
        notes: '',
        active: true,
        contactIds: [],
      });
      // Reset time selector for new medicine
      setDoseTimeValue('');
      setDoseTimeUnit('hours');
    }
    // Reset errors when form data changes
    setErrors({});
  }, [medicine, isOpen]);
  
  // Update local contacts when props change
  useEffect(() => {
    // Convert contacts to Contact type
    const newContacts: Contact[] = contacts.map(c => ({
      id: c.id,
      name: c.name,
      role: c.role,
      phone: null,
      email: null,
      address: null,
      notes: null
    }));
    setLocalContacts(newContacts);
  }, [contacts]);
  
  // Handle form field changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Log the field change for debugging
    console.log('MedicineForm handleChange:', { name, value });
    
    if (!name) {
      console.error('Field name is undefined or empty:', e.target);
      return;
    }
    
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for the field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };
  
  // Handle number input changes
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Allow any input during typing
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for the field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Validate and convert number input on blur
  const handleNumberBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (value === '') {
      setFormData(prev => ({ ...prev, [name]: undefined }));
      return;
    }
    
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setFormData(prev => ({ ...prev, [name]: numValue }));
    } else {
      // Invalid number - show error and reset
      setErrors(prev => ({ ...prev, [name]: 'Please enter a valid number' }));
      setFormData(prev => ({ ...prev, [name]: undefined }));
    }
  };
  
  // Handle unit selection
  const handleUnitChange = (unitAbbr: string) => {
    setFormData(prev => ({ ...prev, unitAbbr }));
    
    // Clear error for unit field
    if (errors.unitAbbr) {
      setErrors(prev => ({ ...prev, unitAbbr: '' }));
    }
  };
  
  // Handle active state toggle
  const handleActiveToggle = (checked: boolean) => {
    setFormData(prev => ({ ...prev, active: checked }));
  };
  
  // Handle dose time value change
  const handleDoseTimeValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDoseTimeValue(value);
    
    // Update the formData with the formatted time
    const formattedTime = formatDoseMinTime(value, doseTimeUnit);
    setFormData(prev => ({ ...prev, doseMinTime: formattedTime }));
    
    // Clear error for the field
    if (errors.doseMinTime) {
      setErrors(prev => ({ ...prev, doseMinTime: '' }));
    }
  };
  
  // Handle dose time unit toggle
  const handleDoseTimeUnitToggle = (checked: boolean) => {
    const newUnit = checked ? 'days' : 'hours';
    setDoseTimeUnit(newUnit);
    
    // Update the formData with the formatted time using the new unit
    const formattedTime = formatDoseMinTime(doseTimeValue, newUnit);
    setFormData(prev => ({ ...prev, doseMinTime: formattedTime }));
    
    // Clear error for the field
    if (errors.doseMinTime) {
      setErrors(prev => ({ ...prev, doseMinTime: '' }));
    }
  };
  
  // Handle contact selection change
  const handleContactsChange = (contactIds: string[]) => {
    // Filter out duplicate contact IDs
    const uniqueContactIds = Array.from(new Set(contactIds));
    setFormData(prev => ({ ...prev, contactIds: uniqueContactIds }));
  };
  
  // Handle adding a new contact
  const handleAddContact = (newContact: Contact) => {
    // Add the new contact to our local contacts list
    setLocalContacts(prev => {
      // Check if the contact already exists
      if (!prev.some(c => c.id === newContact.id)) {
        return [...prev, newContact];
      }
      return prev;
    });
    
    // Select the new contact if it's not already selected
    setFormData(prev => {
      const currentContactIds = prev.contactIds || [];
      // Only add the contact if it's not already in the array
      if (!currentContactIds.includes(newContact.id)) {
        return {
          ...prev,
          contactIds: [...currentContactIds, newContact.id]
        };
      }
      return prev;
    });
  };
  
  // Handle editing a contact
  const handleEditContact = (updatedContact: Contact) => {
    // Update the contact in our local contacts list
    setLocalContacts(prev => 
      prev.map(c => c.id === updatedContact.id ? updatedContact : c)
    );
  };
  
  // Handle deleting a contact
  const handleDeleteContact = (contactId: string) => {
    // Remove the contact from our local contacts list
    setLocalContacts(prev => prev.filter(c => c.id !== contactId));
    
    // Remove the contact from the selected contacts if it's selected
    if (formData.contactIds?.includes(contactId)) {
      setFormData(prev => ({
        ...prev,
        contactIds: prev.contactIds?.filter(id => id !== contactId) || []
      }));
    }
  };
  
  // Validate form before submission
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Required fields
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    // Allow dose size to be blank or 0
    if (formData.typicalDoseSize && formData.typicalDoseSize > 0 && !formData.unitAbbr) {
      newErrors.unitAbbr = 'Unit is required when dose size is specified';
    }
    
    // Validate doseMinTime format if provided
    if (formData.doseMinTime) {
      const timeRegex = /^([0-9]{1,2}):([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
      if (!timeRegex.test(formData.doseMinTime)) {
        newErrors.doseMinTime = 'Please enter a valid time in DD:HH:MM format';
      }
    }
    
    // Update errors state
    setErrors(newErrors);
    
    // Form is valid if there are no errors
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    // Create a copy of the form data to ensure all fields are included
    const dataToSubmit = {
      ...formData,
      // Explicitly include typicalDoseSize even if it's undefined
      typicalDoseSize: formData.typicalDoseSize,
      // Ensure contactIds has no duplicates
      contactIds: formData.contactIds ? Array.from(new Set(formData.contactIds)) : [],
    };
    
    // Log the form data being sent
    console.log('Submitting medicine form data:', dataToSubmit);
    
    try {
      await onSave(dataToSubmit);
      onClose();
    } catch (error) {
      console.error('Error saving medicine:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  
  return (
    <FormPage
      isOpen={isOpen}
      onClose={onClose}
      title={medicine ? t('Edit Medicine') : t('Add New Medicine')}
      description={medicine ? t('Update medicine details') : t('Add a new medicine to track')}
    >
      <FormPageContent>
        <form id="medicine-form" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Medicine Name */}
            <div className={styles.formGroup}>
              <Label htmlFor="name">
                {t('Medicine Name')}
                <span className="text-red-500 ml-1">*</span>
              </Label>
              <div className="relative">
                <Input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full pl-9"
                  placeholder={t("Enter medicine name")}
                />
                <PillBottle className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              </div>
              {errors.name && (
                <div className="text-xs text-red-500 mt-1">
                  <AlertCircle className="h-3 w-3 inline mr-1" />
                  {errors.name}
                </div>
              )}
            </div>
            
            {/* Typical Dose Size and Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div className={styles.formGroup}>
                <Label htmlFor="typicalDoseSize">
                  {t('Typical Dose Size')}
                </Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  name="typicalDoseSize"
                  value={formData.typicalDoseSize || ''}
                  onChange={handleNumberChange}
                  onBlur={handleNumberBlur}
                  placeholder={t("Enter typical dose (optional)")}
                />
                {errors.typicalDoseSize && (
                  <div className="text-xs text-red-500 mt-1">
                    <AlertCircle className="h-3 w-3 inline mr-1" />
                    {errors.typicalDoseSize}
                  </div>
                )}
              </div>
              
              <div className={styles.formGroup}>
                <Label htmlFor="unitAbbr">
                  {t('Unit')}
                </Label>
                <Select
                  value={formData.unitAbbr}
                  onValueChange={handleUnitChange}
                >
                  <SelectTrigger className={errors.unitAbbr ? 'border-red-500' : ''}>
                    <SelectValue placeholder={t("Select a unit")} />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit.unitAbbr} value={unit.unitAbbr}>
                        {unit.unitName} ({unit.unitAbbr})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.unitAbbr && (
                  <div className="text-xs text-red-500 mt-1">
                    <AlertCircle className="h-3 w-3 inline mr-1" />
                    {errors.unitAbbr}
                  </div>
                )}
              </div>
            </div>
            
            {/* Minimum Time Between Doses */}
            <div className={styles.formGroup}>
              <Label htmlFor="doseMinTime">
                {t('Minimum Time Between Doses')}
              </Label>
              <div className="space-y-3">
                {/* Time Input and Unit Toggle */}
                <div className="flex items-center space-x-3">
                  <div className="relative flex-1">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={doseTimeValue}
                      onChange={handleDoseTimeValueChange}
                      className="w-full pl-9"
                      placeholder={t("Enter time")}
                    />
                    <Clock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  </div>
                  
                  {/* Unit Toggle */}
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="dose-time-unit" className="text-sm font-medium">
                      {t('Hours')}
                    </Label>
                    <Switch
                      id="dose-time-unit"
                      checked={doseTimeUnit === 'days'}
                      onCheckedChange={handleDoseTimeUnitToggle}
                      variant="green"
                    />
                    <Label htmlFor="dose-time-unit" className="text-sm font-medium">
                      {t('Days')}
                    </Label>
                  </div>
                </div>
                
                {/* Helper Text */}
                <div className="text-xs text-gray-500">
                  {doseTimeUnit === 'hours' 
                    ? t('Enter the minimum time in hours (e.g., 6 for 6 hours, 0.5 for 30 minutes)')
                    : t('Enter the minimum time in days (e.g., 1 for 1 day, 0.5 for 12 hours)')
                  }
                </div>
              </div>
              
              {errors.doseMinTime && (
                <div className="text-xs text-red-500 mt-1">
                  <AlertCircle className="h-3 w-3 inline mr-1" />
                  {errors.doseMinTime}
                </div>
              )}
            </div>
            
            {/* Active Status */}
            <div className="flex items-center space-x-2 py-2">
              <Switch
                checked={formData.active}
                onCheckedChange={handleActiveToggle}
                id="active-status"
              />
              <Label
                htmlFor="active-status"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t('Active Medicine')}
              </Label>
            </div>
            
            {/* Notes */}
            <div className={styles.formGroup}>
              <Label htmlFor="notes">
                {t('Notes')}
              </Label>
              <div className="relative">
                <Textarea
                  id="notes"
                  name="notes"
                  value={formData.notes || ''}
                  onChange={handleChange}
                  className="w-full min-h-[100px] pl-9"
                  placeholder="Enter additional notes about this medicine"
                />
                <FileText className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              </div>
            </div>
            
            {/* Associated Contacts */}
            <div className={styles.formGroup}>
              <Label htmlFor="contacts">
                {t('Associated Contacts')}
              </Label>
              <ContactSelector
                contacts={localContacts}
                selectedContactIds={formData.contactIds || []}
                onContactsChange={handleContactsChange}
                onAddNewContact={handleAddContact}
                onEditContact={handleEditContact}
                onDeleteContact={handleDeleteContact}
              />
            </div>
          </div>
        </form>
      </FormPageContent>
      
      <FormPageFooter>
        <div className="flex justify-end w-full space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            {t('Cancel')}
          </Button>
          
          <Button 
            form="medicine-form"
            type="submit" 
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                {t('Saving...')}
              </>
            ) : (medicine ? t('Update') : t('Save'))}
          </Button>
        </div>
      </FormPageFooter>
    </FormPage>
  );
};

export default MedicineForm;
