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
import { lbToLbOz, defaultWeightInputUnit } from '@/src/utils/weightUnits';
import { convertWeightValue, convertLengthValue, convertTemperatureValue } from '@/src/utils/measurementConversion';
import { PhotoAttachments } from '@/src/components/ui/photo-attachments';
import { uploadPhotos, linkPhoto, unlinkPhoto, fetchPhotos, fetchPhotosEnabled } from '@/src/utils/photoClientApi';

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
  
  // Separate state for lb/oz dual input
  const [weightLbs, setWeightLbs] = useState('');
  const [weightOz, setWeightOz] = useState('');

  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializedTime, setInitializedTime] = useState<string | null>(null);
  const [photosEnabled, setPhotosEnabled] = useState(false);
  const [pendingPhotoFiles, setPendingPhotoFiles] = useState<File[]>([]);
  const [attachedPhotos, setAttachedPhotos] = useState<{ id: string; caption: string | null }[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);

  useEffect(() => { fetchPhotosEnabled().then(setPhotosEnabled); }, []);

  useEffect(() => {
    if (!isOpen || !activity?.id || !photosEnabled) return;
    fetchPhotos({ babyId })
      .then((data) => setAttachedPhotos(
        data.photos
          .filter((p) => p.links.some((l) => l.activityType === 'measurement' && l.activityId === activity.id))
          .map((p) => ({ id: p.id, caption: p.caption }))
      ))
      .catch(() => {});
  }, [isOpen, activity?.id, photosEnabled]);

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
              weight: defaultWeightInputUnit(settings.defaultWeightUnit),
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

  // Update form data when default units change (only for new entries, not when editing)
  useEffect(() => {
    if (activity) return; // Don't overwrite units set from the activity being edited
    setFormData(prev => ({
      ...prev,
      height: { ...prev.height, unit: defaultUnits.height },
      weight: { ...prev.weight, unit: defaultUnits.weight },
      headCircumference: { ...prev.headCircumference, unit: defaultUnits.headCircumference },
      temperature: { ...prev.temperature, unit: defaultUnits.temperature },
    }));
  }, [defaultUnits, activity]);

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
            if (activity.unit === 'kg') {
              updatedFormData.weight = { value: String(activity.value), unit: 'kg' };
            } else if (activity.unit === 'g') {
              updatedFormData.weight = { value: String(activity.value), unit: 'g' };
            } else {
              // Both 'lb' and legacy 'oz' use the lb/oz dual input
              const decimalLbs = activity.unit === 'oz' ? activity.value / 16 : activity.value;
              const { lbs, oz } = lbToLbOz(decimalLbs);
              setWeightLbs(lbs > 0 ? String(lbs) : '');
              setWeightOz(oz > 0 ? String(oz) : '');
              updatedFormData.weight = { value: String(activity.value), unit: 'lb' };
            }
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
      setWeightLbs('');
      setWeightOz('');
      setPendingPhotoFiles([]);
      setAttachedPhotos([]);
      setRemovedPhotoIds([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activity, initialTime]);

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
    const oldUnit = formData[type].unit;
    if (oldUnit === unit) return;

    if (type === 'weight') {
      // Current weight as a single decimal value in the old unit (lb = decimal pounds).
      const currentDecimal = oldUnit === 'lb'
        ? (parseFloat(weightLbs) || 0) + (parseFloat(weightOz) || 0) / 16
        : parseFloat(formData.weight.value);
      const hasValue = !isNaN(currentDecimal) && currentDecimal > 0;

      if (unit === 'lb') {
        // Convert to decimal pounds, then split into the lb/oz input fields.
        if (hasValue) {
          const decimalLbs = convertWeightValue(currentDecimal, oldUnit, 'lb');
          const { lbs, oz } = lbToLbOz(decimalLbs);
          setWeightLbs(lbs > 0 ? String(lbs) : '');
          setWeightOz(oz > 0 ? String(oz) : '');
          setFormData(prev => ({ ...prev, weight: { value: String(parseFloat(decimalLbs.toFixed(4))), unit: 'lb' } }));
        } else {
          setWeightLbs('');
          setWeightOz('');
          setFormData(prev => ({ ...prev, weight: { value: '', unit: 'lb' } }));
        }
        return;
      }

      // Switching to kg or g — convert the magnitude and clear the lb/oz fields.
      const value = hasValue
        ? (unit === 'g'
            ? String(Math.round(convertWeightValue(currentDecimal, oldUnit, 'g')))
            : String(parseFloat(convertWeightValue(currentDecimal, oldUnit, 'kg').toFixed(2))))
        : '';
      setWeightLbs('');
      setWeightOz('');
      setFormData(prev => ({ ...prev, weight: { value, unit } }));
      return;
    }

    if (type === 'height' || type === 'headCircumference') {
      const current = parseFloat(formData[type].value);
      if (!isNaN(current)) {
        const converted = convertLengthValue(current, oldUnit, unit);
        setFormData(prev => ({ ...prev, [type]: { value: String(parseFloat(converted.toFixed(2))), unit } }));
        return;
      }
    }

    if (type === 'temperature') {
      const current = parseFloat(formData.temperature.value);
      if (!isNaN(current)) {
        const converted = convertTemperatureValue(current, oldUnit, unit);
        setFormData(prev => ({ ...prev, temperature: { value: String(parseFloat(converted.toFixed(1))), unit } }));
        return;
      }
    }

    // No value to convert — just switch the unit.
    setFormData(prev => ({ ...prev, [type]: { ...prev[type], unit } }));
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
      if (formData.weight.unit === 'lb') {
        // For lb unit, combine lb + oz inputs into decimal pounds
        const lbs = parseFloat(weightLbs) || 0;
        const oz = parseFloat(weightOz) || 0;
        if (lbs > 0 || oz > 0) {
          const decimalLbs = lbs + (oz / 16);
          measurements.push({
            babyId,
            date: utcDateString,
            type: 'WEIGHT',
            value: parseFloat(decimalLbs.toFixed(4)),
            unit: 'lb',
            notes: formData.notes || undefined,
          });
        }
      } else if (formData.weight.value) {
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

      // Tracks which measurement record photos should be attached to. For a
      // single edited/deleted measurement this is unambiguous; for a new
      // entry that creates several measurement types at once, photos attach
      // to the last one created (mirrors the FeedForm dual-side precedent).
      let savedActivityId: string | undefined = activity?.id;

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

          // The measurement was removed, so there's no record left to attach photos to.
          savedActivityId = undefined;
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

          const savedMeasurement = await response.json();
          savedActivityId = savedMeasurement.data?.id;
        }
      }

      if (photosEnabled && savedActivityId) {
        try {
          for (const photoId of removedPhotoIds) {
            await unlinkPhoto(photoId, 'measurement', savedActivityId);
          }
          if (pendingPhotoFiles.length > 0) {
            const result = await uploadPhotos(pendingPhotoFiles, { babyId });
            for (const photo of result.photos) {
              await linkPhoto(photo.id, 'measurement', savedActivityId);
            }
          }
        } catch (photoError) {
          console.error('Photo attachment failed:', photoError);
          showToast({
            variant: 'warning',
            title: t('Warning'),
            message: t('Measurement saved, but one or more photos failed to attach.'),
            duration: 5000,
          });
        }
      }

      onClose();
      onSuccess?.();

      // Reset form data
      setSelectedDateTime(new Date(initialTime));
      setWeightLbs('');
      setWeightOz('');
      setFormData({
        date: initialTime,
        height: { value: '', unit: defaultUnits.height },
        weight: { value: '', unit: defaultUnits.weight },
        headCircumference: { value: '', unit: defaultUnits.headCircumference },
        temperature: { value: '', unit: defaultUnits.temperature },
        notes: '',
      });
      setPendingPhotoFiles([]);
      setAttachedPhotos([]);
      setRemovedPhotoIds([]);
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
            {(!activity || activity.type === 'HEIGHT') && <div className="space-y-2">
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
            </div>}

            {/* Weight Measurement */}
            {(!activity || activity.type === 'WEIGHT') && <div className="space-y-2">
              <Label htmlFor="weight-value">{t('Weight')}</Label>
              <div className="flex items-center space-x-2">
                {formData.weight.unit === 'lb' ? (
                  <div className="flex flex-1 items-center space-x-1">
                    <Input
                      id="weight-lbs"
                      type="text"
                      inputMode="decimal"
                      value={weightLbs}
                      onChange={(e) => {
                        if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) {
                          setWeightLbs(e.target.value);
                        }
                      }}
                      className="flex-1"
                      placeholder={t("lbs")}
                      disabled={loading}
                    />
                    <span className="text-sm text-gray-500">{t('lb')}</span>
                    <Input
                      id="weight-oz"
                      type="text"
                      inputMode="decimal"
                      value={weightOz}
                      onChange={(e) => {
                        if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) {
                          setWeightOz(e.target.value);
                        }
                      }}
                      className="flex-1"
                      placeholder={t("oz")}
                      disabled={loading}
                    />
                    <span className="text-sm text-gray-500">{t('oz')}</span>
                  </div>
                ) : (
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
                )}
                <div className="flex space-x-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={formData.weight.unit === 'lb' ? 'default' : 'outline'}
                    onClick={() => handleUnitChange('weight', 'lb')}
                    disabled={loading}
                    className="px-2 py-1 h-9"
                  >
                    lb/oz
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
                    variant={formData.weight.unit === 'g' ? 'default' : 'outline'}
                    onClick={() => handleUnitChange('weight', 'g')}
                    disabled={loading}
                    className="px-2 py-1 h-9"
                  >
                    g
                  </Button>
                </div>
              </div>
            </div>}

            {/* Head Circumference Measurement */}
            {(!activity || activity.type === 'HEAD_CIRCUMFERENCE') && <div className="space-y-2">
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
            </div>}

            {/* Temperature Measurement */}
            {(!activity || activity.type === 'TEMPERATURE') && <div className="space-y-2">
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
            </div>}

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

            {photosEnabled && (
              <div className="space-y-2">
                <Label>{t('Photos')}</Label>
                <PhotoAttachments
                  pendingFiles={pendingPhotoFiles}
                  onPendingFilesChange={setPendingPhotoFiles}
                  existingPhotos={attachedPhotos}
                  onRemoveExisting={(photoId) => {
                    setAttachedPhotos((prev) => prev.filter((p) => p.id !== photoId));
                    setRemovedPhotoIds((prev) => [...prev, photoId]);
                  }}
                  disabled={loading}
                />
              </div>
            )}
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
