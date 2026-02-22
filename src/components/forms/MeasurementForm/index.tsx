'use client';

import React, { useState, useEffect } from 'react';
import { MeasurementResponse, MeasurementCreate } from '@/app/api/types';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { DateTimePicker } from '@/src/components/ui/date-time-picker';
import { Label } from '@/src/components/ui/label';
import { 
  FormPage, 
  FormPageContent, 
  FormPageFooter 
} from '@/src/components/ui/form-page';
import { useTimezone } from '@/app/context/timezone';
import { Textarea } from '@/src/components/ui/textarea';
import { useToast } from '@/src/components/ui/toast';
import { handleExpirationError } from '@/src/lib/expiration-error-handler';
import { useLocalization } from '@/src/context/localization';

interface MeasurementFormProps {
  isOpen: boolean;
  onClose: () => void;
  babyId: string | undefined;
  initialTime: string;
  activity?: MeasurementResponse;
  onSuccess?: () => void;
}

// Define a type for the measurement data
interface MeasurementData {
  value: string;
  unit: string;
}

// Define a type for the form data
interface FormData {
  date: string;
  height: MeasurementData;
  weight: MeasurementData;
  headCircumference: MeasurementData;
  temperature: MeasurementData;
  notes: string;
}

export default function MeasurementForm({
  isOpen,
  onClose,
  babyId,
  initialTime,
  activity,
  onSuccess,
}: MeasurementFormProps) {
  const { t } = useLocalization();
  const { formatDate, toUTCString } = useTimezone();
  const { showToast } = useToast();
  const [selectedDateTime, setSelectedDateTime] = useState<Date>(() => {
    try {
      // Try to parse the initialTime
      const date = new Date(initialTime);
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return new Date(); // Fallback to current date if invalid
      }
      return date;
    } catch (error) {
      console.error('Error parsing initialTime:', error);
      return new Date(); // Fallback to current date
    }
  });
  
  // Default units from settings
  const [defaultUnits, setDefaultUnits] = useState({
    height: 'in',
    weight: 'lb',
    headCircumference: 'in',
    temperature: '°F'
  });
  
  // Initialize form data with empty values and default units
  const [formData, setFormData] = useState<FormData>({
    date: initialTime,
    height: { value: '', unit: defaultUnits.height },
    weight: { value: '', unit: defaultUnits.weight },
    headCircumference: { value: '', unit: defaultUnits.headCircumference },
    temperature: { value: '', unit: defaultUnits.temperature },
    notes: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializedTime, setInitializedTime] = useState<string | null>(null);

  // Fetch default units from settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const authToken = localStorage.getItem('authToken');
        const response = await fetch('/api/settings', {
          headers: {
            'Authorization': authToken ? `Bearer ${authToken}` : '',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            const settings = data.data;
            setDefaultUnits({
              height: settings.defaultHeightUnit === 'IN' ? 'in' : 'cm',
              weight: settings.defaultWeightUnit === 'LB' ? 'lb' : (settings.defaultWeightUnit === 'KG' ? 'kg' : 'oz'),
              headCircumference: settings.defaultHeightUnit === 'IN' ? 'in' : 'cm', // Using height unit for head circumference
              temperature: settings.defaultTempUnit === 'F' ? '°F' : '°C',
            });
          }
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };
    
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  // Update form data when default units change
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      height: { ...prev.height, unit: defaultUnits.height },
      weight: { ...prev.weight, unit: defaultUnits.weight },
      headCircumference: { ...prev.headCircumference, unit: defaultUnits.headCircumference },
      temperature: { ...prev.temperature, unit: defaultUnits.temperature },
    }));
  }, [defaultUnits]);

  // Handle date/time change
  const handleDateTimeChange = (date: Date) => {
    setSelectedDateTime(date);
    
    // Also update the date in formData for compatibility with existing code
    // Format the date as ISO string for storage in formData
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    const formattedTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    setFormData(prev => ({ ...prev, date: formattedTime }));
  };

  useEffect(() => {
    if (isOpen && !isInitialized) {
      if (activity) {
        // Editing mode - populate with activity data
        try {
          const activityDate = new Date(activity.date);
          // Check if the date is valid
          if (!isNaN(activityDate.getTime())) {
            setSelectedDateTime(activityDate);
          }
        } catch (error) {
          console.error('Error parsing activity date:', error);
        }
        
        // Format the date for the date property
        const date = new Date(activity.date);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const formattedTime = `${year}-${month}-${day}T${hours}:${minutes}`;
        
        // Update the specific measurement type that's being edited
        const updatedFormData = { 
          date: formattedTime, 
          notes: activity.notes || '',
          height: { value: '', unit: defaultUnits.height },
          weight: { value: '', unit: defaultUnits.weight },
          headCircumference: { value: '', unit: defaultUnits.headCircumference },
          temperature: { value: '', unit: defaultUnits.temperature },
        };
        
        switch (activity.type) {
          case 'HEIGHT':
            updatedFormData.height = { value: String(activity.value), unit: activity.unit };
            break;
          case 'WEIGHT':
            updatedFormData.weight = { value: String(activity.value), unit: activity.unit };
            break;
          case 'HEAD_CIRCUMFERENCE':
            updatedFormData.headCircumference = { value: String(activity.value), unit: activity.unit };
            break;
          case 'TEMPERATURE':
            updatedFormData.temperature = { value: String(activity.value), unit: activity.unit };
            break;
        }
        
        setFormData(updatedFormData);
        
        // Store the initial time used for editing
        setInitializedTime(activity.date);
      } else {
        // New entry mode - initialize from initialTime prop
        try {
          const date = new Date(initialTime);
          if (!isNaN(date.getTime())) {
            setSelectedDateTime(date);
            
            // Also update the date in formData
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const formattedTime = `${year}-${month}-${day}T${hours}:${minutes}`;
            
            setFormData(prev => ({ ...prev, date: formattedTime }));
          }
        } catch (error) {
          console.error('Error parsing initialTime:', error);
        }
        
        // Store the initial time used for new entry
        setInitializedTime(initialTime);
      }
      
      // Mark as initialized
      setIsInitialized(true);
    } else if (!isOpen) {
      // Reset initialization flag and stored time when form closes
      setIsInitialized(false);
      setInitializedTime(null);
    }
  }, [isOpen, activity, initialTime, defaultUnits]);

  // Handle value change for a specific measurement type
  const handleValueChange = (type: keyof Omit<FormData, 'date' | 'notes'>, value: string) => {
    // Only allow numeric values with decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFormData(prev => ({
        ...prev,
        [type]: { ...prev[type], value }
      }));
    }
  };

  // Handle unit change for a specific measurement type
  const handleUnitChange = (type: keyof Omit<FormData, 'date' | 'notes'>, unit: string) => {
    setFormData(prev => ({
      ...prev,
      [type]: { ...prev[type], unit }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!babyId) return;
    
    // Validate date time
    if (!selectedDateTime || isNaN(selectedDateTime.getTime())) {
      console.error('Required fields missing: valid date time');
      return;
    }

    setLoading(true);

    try {
      // Convert local time to UTC ISO string using the timezone context
      const utcDateString = toUTCString(selectedDateTime);
      
      // If we couldn't convert the date to a UTC string, show an error
      if (!utcDateString) {
        console.error('Failed to convert date to UTC string');
        alert('Invalid date. Please try again.');
        setLoading(false);
        return;
      }
      
      // Create an array of measurements to save
      const measurements: Omit<MeasurementCreate, 'familyId'>[] = [];
      
      // Add height measurement if value is provided
      if (formData.height.value) {
        measurements.push({
          babyId,
          date: utcDateString,
          type: 'HEIGHT',
          value: parseFloat(formData.height.value),
          unit: formData.height.unit,
          notes: formData.notes || undefined,
        });
      }
      
      // Add weight measurement if value is provided
      if (formData.weight.value) {
        measurements.push({
          babyId,
          date: utcDateString,
          type: 'WEIGHT',
          value: parseFloat(formData.weight.value),
          unit: formData.weight.unit,
          notes: formData.notes || undefined,
        });
      }
      
      // Add head circumference measurement if value is provided
      if (formData.headCircumference.value) {
        measurements.push({
          babyId,
          date: utcDateString,
          type: 'HEAD_CIRCUMFERENCE',
          value: parseFloat(formData.headCircumference.value),
          unit: formData.headCircumference.unit,
          notes: formData.notes || undefined,
        });
      }
      
      // Add temperature measurement if value is provided
      if (formData.temperature.value) {
        measurements.push({
          babyId,
          date: utcDateString,
          type: 'TEMPERATURE',
          value: parseFloat(formData.temperature.value),
          unit: formData.temperature.unit,
          notes: formData.notes || undefined,
        });
      }
      
      // If no measurements, show error
      if (measurements.length === 0) {
        console.error('No measurements provided');
        alert(t('Please enter at least one measurement value'));
        setLoading(false);
        return;
      }
      
      // Get auth token from localStorage
      const authToken = localStorage.getItem('authToken');
      
      // If editing an existing measurement, update it
      if (activity) {
        // Find the measurement that matches the activity type
        const matchingMeasurement = measurements.find(m => m.type === activity.type);
        
        if (matchingMeasurement) {
          const response = await fetch(`/api/measurement-log?id=${activity.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authToken ? `Bearer ${authToken}` : '',
            },
            body: JSON.stringify(matchingMeasurement),
          });
          
          if (!response.ok) {
            // Check if this is an account expiration error
            if (response.status === 403) {
              const { isExpirationError, errorData } = await handleExpirationError(
                response,
                showToast,
                'updating measurements'
              );
              if (isExpirationError) {
                // Don't close the form, let user see the error
                return;
              }
              // If it's a 403 but not an expiration error, handle it normally
              if (errorData) {
                showToast({
                  variant: 'error',
                  title: 'Error',
                  message: errorData.error || 'Failed to update measurement',
                  duration: 5000,
                });
                throw new Error(errorData.error || 'Failed to update measurement');
              }
            }
            
            // Handle other errors
            const errorData = await response.json();
            showToast({
              variant: 'error',
              title: 'Error',
              message: errorData.error || 'Failed to update measurement',
              duration: 5000,
            });
            throw new Error(errorData.error || 'Failed to update measurement');
          }
        } else {
          // If the user cleared the value for the edited measurement type
          // Delete the measurement
          const response = await fetch(`/api/measurement-log?id=${activity.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': authToken ? `Bearer ${authToken}` : '',
            },
          });
          
          if (!response.ok) {
            // Check if this is an account expiration error
            if (response.status === 403) {
              const { isExpirationError, errorData } = await handleExpirationError(
                response,
                showToast,
                'deleting measurements'
              );
              if (isExpirationError) {
                // Don't close the form, let user see the error
                return;
              }
              // If it's a 403 but not an expiration error, handle it normally
              if (errorData) {
                showToast({
                  variant: 'error',
                  title: 'Error',
                  message: errorData.error || 'Failed to delete measurement',
                  duration: 5000,
                });
                throw new Error(errorData.error || 'Failed to delete measurement');
              }
            }
            
            // Handle other errors
            const errorData = await response.json();
            showToast({
              variant: 'error',
              title: 'Error',
              message: errorData.error || 'Failed to delete measurement',
              duration: 5000,
            });
            throw new Error(errorData.error || 'Failed to delete measurement');
          }
        }
      } else {
        // Create new measurements
        for (const measurement of measurements) {
          const response = await fetch('/api/measurement-log', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authToken ? `Bearer ${authToken}` : '',
            },
            body: JSON.stringify(measurement),
          });
          
          if (!response.ok) {
            // Check if this is an account expiration error
            if (response.status === 403) {
              const { isExpirationError, errorData } = await handleExpirationError(
                response,
                showToast,
                'logging measurements'
              );
              if (isExpirationError) {
                // Don't close the form, let user see the error
                return;
              }
              // If it's a 403 but not an expiration error, handle it normally
              if (errorData) {
                showToast({
                  variant: 'error',
                  title: 'Error',
                  message: errorData.error || `Failed to save ${measurement.type.toLowerCase()} measurement`,
                  duration: 5000,
                });
                throw new Error(errorData.error || `Failed to save ${measurement.type.toLowerCase()} measurement`);
              }
            }
            
            // Handle other errors
            const errorData = await response.json();
            showToast({
              variant: 'error',
              title: 'Error',
              message: errorData.error || `Failed to save ${measurement.type.toLowerCase()} measurement`,
              duration: 5000,
            });
            throw new Error(errorData.error || `Failed to save ${measurement.type.toLowerCase()} measurement`);
          }
        }
      }

      onClose();
      onSuccess?.();
      
      // Reset form data
      setSelectedDateTime(new Date(initialTime));
      setFormData({
        date: initialTime,
        height: { value: '', unit: defaultUnits.height },
        weight: { value: '', unit: defaultUnits.weight },
        headCircumference: { value: '', unit: defaultUnits.headCircumference },
        temperature: { value: '', unit: defaultUnits.temperature },
        notes: '',
      });
    } catch (error) {
      console.error('Error saving measurements:', error);
      // Error toast already shown above for non-expiration errors
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormPage
      isOpen={isOpen}
      onClose={onClose}
      title={activity ? t('Edit Measurement') : t('Log Measurements')}
      description={activity ? t('Update details about your baby\'s measurement') : t('Record new measurements for your baby')}
    >
        <FormPageContent>
          <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Date & Time - Full width on all screens */}
            <div>
              <Label htmlFor="measurement-date">{t('Date & Time')}</Label>
              <DateTimePicker
                value={selectedDateTime}
                onChange={handleDateTimeChange}
                disabled={loading}
                placeholder={t("Select measurement time...")}
              />
            </div>
            
            {/* Height Measurement */}
            <div className="space-y-2">
              <Label htmlFor="height-value">{t('Height')}</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="height-value"
                  type="text"
                  inputMode="decimal"
                  value={formData.height.value}
                  onChange={(e) => handleValueChange('height', e.target.value)}
                  className="flex-1"
                  placeholder={t("Enter height")}
                  disabled={loading}
                />
                <div className="flex space-x-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={formData.height.unit === 'in' ? 'default' : 'outline'}
                    onClick={() => handleUnitChange('height', 'in')}
                    disabled={loading}
                    className="px-2 py-1 h-9"
                  >
                    in
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={formData.height.unit === 'cm' ? 'default' : 'outline'}
                    onClick={() => handleUnitChange('height', 'cm')}
                    disabled={loading}
                    className="px-2 py-1 h-9"
                  >
                    cm
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Weight Measurement */}
            <div className="space-y-2">
              <Label htmlFor="weight-value">{t('Weight')}</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="weight-value"
                  type="text"
                  inputMode="decimal"
                  value={formData.weight.value}
                  onChange={(e) => handleValueChange('weight', e.target.value)}
                  className="flex-1"
                  placeholder={t("Enter weight")}
                  disabled={loading}
                />
                <div className="flex space-x-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={formData.weight.unit === 'lb' ? 'default' : 'outline'}
                    onClick={() => handleUnitChange('weight', 'lb')}
                    disabled={loading}
                    className="px-2 py-1 h-9"
                  >
                    lb
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={formData.weight.unit === 'kg' ? 'default' : 'outline'}
                    onClick={() => handleUnitChange('weight', 'kg')}
                    disabled={loading}
                    className="px-2 py-1 h-9"
                  >
                    kg
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={formData.weight.unit === 'oz' ? 'default' : 'outline'}
                    onClick={() => handleUnitChange('weight', 'oz')}
                    disabled={loading}
                    className="px-2 py-1 h-9"
                  >
                    oz
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Head Circumference Measurement */}
            <div className="space-y-2">
              <Label htmlFor="head-value">{t('Head Circumference')}</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="head-value"
                  type="text"
                  inputMode="decimal"
                  value={formData.headCircumference.value}
                  onChange={(e) => handleValueChange('headCircumference', e.target.value)}
                  className="flex-1"
                  placeholder={t("Enter head circumference")}
                  disabled={loading}
                />
                <div className="flex space-x-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={formData.headCircumference.unit === 'in' ? 'default' : 'outline'}
                    onClick={() => handleUnitChange('headCircumference', 'in')}
                    disabled={loading}
                    className="px-2 py-1 h-9"
                  >
                    in
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={formData.headCircumference.unit === 'cm' ? 'default' : 'outline'}
                    onClick={() => handleUnitChange('headCircumference', 'cm')}
                    disabled={loading}
                    className="px-2 py-1 h-9"
                  >
                    cm
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Temperature Measurement */}
            <div className="space-y-2">
              <Label htmlFor="temp-value">{t('Temperature')}</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="temp-value"
                  type="text"
                  inputMode="decimal"
                  value={formData.temperature.value}
                  onChange={(e) => handleValueChange('temperature', e.target.value)}
                  className="flex-1"
                  placeholder={t("Enter temperature")}
                  disabled={loading}
                />
                <div className="flex space-x-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={formData.temperature.unit === '°F' ? 'default' : 'outline'}
                    onClick={() => handleUnitChange('temperature', '°F')}
                    disabled={loading}
                    className="px-2 py-1 h-9"
                  >
                    {t('°F')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={formData.temperature.unit === '°C' ? 'default' : 'outline'}
                    onClick={() => handleUnitChange('temperature', '°C')}
                    disabled={loading}
                    className="px-2 py-1 h-9"
                  >
                    {t('°C')}
                  </Button>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">{t('Notes (Optional)')}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full"
                placeholder={t("Add any additional notes about these measurements")}
                disabled={loading}
              />
            </div>
          </div>
          </form>
        </FormPageContent>
        <FormPageFooter>
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              {t('Cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {activity ? t('Update') : t('Save')}
            </Button>
          </div>
        </FormPageFooter>
    </FormPage>
  );
}
