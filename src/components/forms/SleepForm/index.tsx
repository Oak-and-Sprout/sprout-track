'use client';

import React, { useState, useEffect } from 'react';
import { SleepType, SleepQuality } from '@prisma/client';
import { SleepLogResponse } from '@/app/api/types';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { DateTimePicker } from '@/src/components/ui/date-time-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { 
  FormPage, 
  FormPageContent, 
  FormPageFooter 
} from '@/src/components/ui/form-page';
import { useTimezone } from '@/app/context/timezone';
import { useToast } from '@/src/components/ui/toast';
import { handleExpirationError } from '@/src/lib/expiration-error-handler';
import { useLocalization } from '@/src/context/localization';

// Note: DEFAULT_LOCATIONS are displayed as-is but could be localized if needed
const DEFAULT_LOCATIONS = ['Bassinet', 'Stroller', 'Crib', 'Car Seat', 'Parents Room', 'Contact', 'Other'];

interface SleepFormProps {
  isOpen: boolean;
  onClose: () => void;
  isSleeping: boolean;
  onSleepToggle: () => void;
  babyId: string | undefined;
  initialTime: string;
  activity?: SleepLogResponse;
  onSuccess?: () => void;
}

export default function SleepForm({
  isOpen,
  onClose,
  isSleeping,
  onSleepToggle,
  babyId,
  initialTime,
  activity,
  onSuccess,
}: SleepFormProps) {
  const { t } = useLocalization();
  const { formatDate, calculateDurationMinutes, toUTCString } = useTimezone();
  const { showToast } = useToast();
  const [startDateTime, setStartDateTime] = useState<Date>(() => {
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
  const [endDateTime, setEndDateTime] = useState<Date | null>(null);
  const [formData, setFormData] = useState({
    type: '' as SleepType | '',
    location: '',
    quality: '' as SleepQuality | '',
  });
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [customLocations, setCustomLocations] = useState<string[]>([]);
  const [isCustomLocation, setIsCustomLocation] = useState(false);
  const [customLocationInput, setCustomLocationInput] = useState('');

  // Fetch custom locations when form opens
  useEffect(() => {
    if (isOpen) {
      const fetchCustomLocations = async () => {
        try {
          const authToken = localStorage.getItem('authToken');
          const response = await fetch('/api/sleep-log?locations=true', {
            headers: {
              'Authorization': authToken ? `Bearer ${authToken}` : ''
            }
          });
          if (!response.ok) return;
          
          const data = await response.json();
          if (data.success) {
            setCustomLocations(data.data);
          }
        } catch (error) {
          console.error('Error fetching custom locations:', error);
        }
      };
      fetchCustomLocations();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !isInitialized) {
      if (activity) {
        // Editing mode - populate with activity data
        try {
          const startDate = new Date(activity.startTime);
          if (!isNaN(startDate.getTime())) {
            setStartDateTime(startDate);
          }
          
          if (activity.endTime) {
            const endDate = new Date(activity.endTime);
            if (!isNaN(endDate.getTime())) {
              setEndDateTime(endDate);
            }
          } else {
            setEndDateTime(null);
          }
        } catch (error) {
          console.error('Error parsing activity times:', error);
        }
        
        const activityLocation = activity.location || '';
        const isDefaultLocation = activityLocation && DEFAULT_LOCATIONS.includes(activityLocation);
        
        // Check if it's a custom location that will be in the dropdown (fetched from API)
        // We'll set it after customLocations are fetched, but for now set it directly
        // The customLocations will be populated by the useEffect that runs when isOpen is true
        if (isDefaultLocation) {
          setFormData({
            type: activity.type,
            location: activityLocation,
            quality: activity.quality || '',
          });
          setIsCustomLocation(false);
          setCustomLocationInput('');
        } else if (activityLocation) {
          // It's a custom location - check if it's in the customLocations array
          // Since customLocations might not be loaded yet, we'll use a separate effect
          // For now, set it to Custom mode
          setFormData({
            type: activity.type,
            location: 'Custom',
            quality: activity.quality || '',
          });
          setIsCustomLocation(true);
          setCustomLocationInput(activityLocation);
        } else {
          setFormData({
            type: activity.type,
            location: '',
            quality: activity.quality || '',
          });
          setIsCustomLocation(false);
          setCustomLocationInput('');
        }
        
        // Mark as initialized
        setIsInitialized(true);
      } else if (isSleeping && babyId) {
        // Ending sleep mode - fetch current sleep
        const fetchCurrentSleep = async () => {
          try {
            // Get auth token from localStorage
            const authToken = localStorage.getItem('authToken');
            const url = `/api/sleep-log?babyId=${babyId}`;

            const response = await fetch(url, {
              headers: {
                'Authorization': authToken ? `Bearer ${authToken}` : ''
              }
            });
            if (!response.ok) return;
            
            const data = await response.json();
            if (!data.success) return;
            
            // Find the most recent sleep record without an end time
            const currentSleep = data.data.find((log: SleepLogResponse) => !log.endTime);
            if (currentSleep) {
              try {
                const startDate = new Date(currentSleep.startTime);
                if (!isNaN(startDate.getTime())) {
                  setStartDateTime(startDate);
                }
                
                const endDate = new Date(initialTime);
                if (!isNaN(endDate.getTime())) {
                  setEndDateTime(endDate);
                }
              } catch (error) {
                console.error('Error parsing sleep times:', error);
              }
              
              const sleepLocation = currentSleep.location || '';
              const isCustom = sleepLocation && !DEFAULT_LOCATIONS.includes(sleepLocation);
              
              setFormData(prev => ({
                ...prev,
                type: currentSleep.type,
                location: isCustom ? 'Custom' : sleepLocation,
                quality: 'GOOD', // Default to GOOD when ending sleep
              }));
              
              if (isCustom) {
                setIsCustomLocation(true);
                setCustomLocationInput(sleepLocation);
              } else {
                setIsCustomLocation(false);
                setCustomLocationInput('');
              }
            }
            
            // Mark as initialized
            setIsInitialized(true);
          } catch (error) {
            console.error('Error fetching current sleep:', error);
            // Mark as initialized even on error to prevent infinite retries
            setIsInitialized(true);
          }
        };
        fetchCurrentSleep();
      } else {
        // Starting new sleep
        try {
          const initialDate = new Date(initialTime);
          if (!isNaN(initialDate.getTime())) {
            setStartDateTime(initialDate);
          }
          
          if (isSleeping) {
            setEndDateTime(new Date(initialTime));
          } else {
            setEndDateTime(null);
          }
        } catch (error) {
          console.error('Error parsing initialTime:', error);
        }
        
        setFormData(prev => ({
          ...prev,
          type: prev.type || 'NAP', // Default to NAP if not set
          location: prev.location,
          quality: isSleeping ? 'GOOD' : prev.quality,
        }));
        
        // Mark as initialized
        setIsInitialized(true);
      }
    } else if (!isOpen) {
      // Reset initialization flag and form when modal closes
      setIsInitialized(false);
      try {
        const initialDate = new Date(initialTime);
        if (!isNaN(initialDate.getTime())) {
          setStartDateTime(initialDate);
        }
      } catch (error) {
        console.error('Error parsing initialTime:', error);
      }
      setEndDateTime(null);
      setFormData({
        type: '' as SleepType | '',
        location: '',
        quality: '' as SleepQuality | '',
      });
      setIsCustomLocation(false);
      setCustomLocationInput('');
    }
  }, [isOpen, initialTime, isSleeping, babyId, activity?.id, isInitialized]);

  // Handle date/time changes
  const handleStartDateTimeChange = (date: Date) => {
    setStartDateTime(date);
  };
  
  const handleEndDateTimeChange = (date: Date) => {
    setEndDateTime(date);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!babyId) return;

    // Validate required fields
    if (!formData.type || !startDateTime || (isSleeping && endDateTime === null)) {
      console.error('Required fields missing');
      return;
    }

    // Validate custom location if Custom is selected
    if (isCustomLocation && !customLocationInput.trim()) {
      showToast({
        variant: 'error',
        title: t('Error'),
        message: t('Please enter a custom location'),
        duration: 5000,
      });
      return;
    }

    // Determine the location value to use
    const locationValue = isCustomLocation ? customLocationInput.trim() : (formData.location || null);

    setLoading(true);

    try {
      // Convert local times to UTC ISO strings using the timezone context
      const utcStartTime = toUTCString(startDateTime);
      
      // Only convert end time if it exists
      let utcEndTime = null;
      if (endDateTime) {
        utcEndTime = toUTCString(endDateTime);
      }
      
      console.log('Original start time (local):', startDateTime.toISOString());
      console.log('Converted start time (UTC):', utcStartTime);
      if (utcEndTime && endDateTime) {
        console.log('Original end time (local):', endDateTime.toISOString());
        console.log('Converted end time (UTC):', utcEndTime);
      }
      
      // Calculate duration using the timezone context if both start and end times are provided
      const duration = utcEndTime ? 
        calculateDurationMinutes(utcStartTime, utcEndTime) : 
        null;

      let response;
      
      if (activity) {
        // Editing mode - update existing record
        const payload = {
          startTime: utcStartTime,
          endTime: utcEndTime,
          duration,
          type: formData.type,
          location: locationValue,
          quality: formData.quality || null,
        };

        // Get auth token from localStorage
        const authToken = localStorage.getItem('authToken');

        response = await fetch(`/api/sleep-log?id=${activity.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authToken ? `Bearer ${authToken}` : '',
          },
          body: JSON.stringify(payload),
        });
      } else if (isSleeping) {
        // Ending sleep - update existing record
        // Get auth token from localStorage
        const authToken = localStorage.getItem('authToken');
        const url = `/api/sleep-log?babyId=${babyId}`;

        const sleepResponse = await fetch(url, {
          headers: {
            'Authorization': authToken ? `Bearer ${authToken}` : ''
          }
        });
        if (!sleepResponse.ok) throw new Error(t('Failed to fetch sleep logs'));
        const sleepData = await sleepResponse.json();
        if (!sleepData.success) throw new Error(t('Failed to fetch sleep logs'));
        
        const currentSleep = sleepData.data.find((log: SleepLogResponse) => !log.endTime);
        if (!currentSleep) throw new Error(t('No ongoing sleep record found'));

        response = await fetch(`/api/sleep-log?id=${currentSleep.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authToken ? `Bearer ${authToken}` : '',
          },
          body: JSON.stringify({
            endTime: utcEndTime,
            duration,
            quality: formData.quality || null,
          }),
        });
      } else {
        // Starting new sleep
        const payload = {
          babyId,
          startTime: utcStartTime,
          endTime: null,
          duration: null,
          type: formData.type,
          location: locationValue,
          quality: null,
        };

        // Get auth token from localStorage
        const authToken = localStorage.getItem('authToken');

        response = await fetch('/api/sleep-log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authToken ? `Bearer ${authToken}` : '',
          },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        // Check if this is an account expiration error
        if (response.status === 403) {
          const { isExpirationError, errorData } = await handleExpirationError(
            response,
            showToast,
            'logging sleep'
          );
          if (isExpirationError) {
            // Don't close the form, let user see the error
            return;
          }
          // If it's a 403 but not an expiration error, handle it normally
          if (errorData) {
            showToast({
              variant: 'error',
              title: t('Error'),
              message: errorData.error || t('Failed to save sleep log'),
              duration: 5000,
            });
            throw new Error(errorData.error || t('Failed to save sleep log'));
          }
        }
        
        // Handle other errors
        const errorData = await response.json();
        showToast({
          variant: 'error',
          title: t('Error'),
          message: errorData.error || t('Failed to save sleep log'),
          duration: 5000,
        });
        throw new Error(errorData.error || t('Failed to save sleep log'));
      }

      onClose();
      if (!activity) onSleepToggle(); // Only toggle sleep state when not editing
      onSuccess?.();
      
      // Reset form data
      try {
        const initialDate = new Date(initialTime);
        if (!isNaN(initialDate.getTime())) {
          setStartDateTime(initialDate);
        }
      } catch (error) {
        console.error('Error parsing initialTime:', error);
      }
      setEndDateTime(null);
      setFormData({
        type: '' as SleepType | '',
        location: '',
        quality: '' as SleepQuality | '',
      });
      setIsCustomLocation(false);
      setCustomLocationInput('');
    } catch (error) {
      console.error('Error saving sleep log:', error);
      // Error toast already shown above for non-expiration errors
    } finally {
      setLoading(false);
    }
  };

  const isEditMode = !!activity;
  const title = isEditMode ? t('Edit Sleep Record') : (isSleeping ? t('End Sleep Session') : t('Start Sleep Session'));
  const description = isEditMode 
    ? t('Update sleep record details')
    : (isSleeping ? t('Record when your baby woke up and how well they slept') : t('Record when your baby is going to sleep'));

  return (
    <FormPage
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
    >
        <FormPageContent>
          <form onSubmit={handleSubmit}>
          <div className="space-y-4">
          <div className="space-y-3">
            <div>
              <Label>{t('Start Time')}</Label>
              <DateTimePicker
                value={startDateTime}
                onChange={handleStartDateTimeChange}
                className="w-full"
                disabled={(isSleeping && !isEditMode) || loading} // Only disabled when ending sleep and not editing
                placeholder={t("Select start time...")}
              />
            </div>
            {(isSleeping || isEditMode) && (
              <div>
                <Label>{t('End Time')}</Label>
                <DateTimePicker
                  value={endDateTime}
                  onChange={handleEndDateTimeChange}
                  className="w-full"
                  disabled={loading}
                  placeholder={t("Select end time...")}
                />
              </div>
            )}
          </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label">{t('Type')}</label>
                <Select
                  value={formData.type}
                  onValueChange={(value: SleepType) =>
                    setFormData({ ...formData, type: value })
                  }
                  disabled={(isSleeping && !isEditMode) || loading} // Only disabled when ending sleep and not editing
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("Select type")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NAP">{t('Nap')}</SelectItem>
                    <SelectItem value="NIGHT_SLEEP">{t('Night Sleep')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="form-label">{t('Location')}</label>
                <Select
                  value={formData.location}
                  onValueChange={(value: string) => {
                    if (value === 'Custom') {
                      setIsCustomLocation(true);
                      setFormData({ ...formData, location: 'Custom' });
                    } else {
                      setIsCustomLocation(false);
                      setCustomLocationInput('');
                      setFormData({ ...formData, location: value });
                    }
                  }}
                  disabled={(isSleeping && !isEditMode) || loading} // Only disabled when ending sleep and not editing
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("Select location")} />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_LOCATIONS.map((location) => (
                      <SelectItem key={location} value={location}>
                        {location}
                      </SelectItem>
                    ))}
                    <SelectItem value="Custom">{t('Custom')}</SelectItem>
                    {customLocations.map((location) => (
                      <SelectItem key={location} value={location}>
                        {location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isCustomLocation && (
                  <div className="mt-2">
                    <Input
                      type="text"
                      value={customLocationInput}
                      onChange={(e) => setCustomLocationInput(e.target.value)}
                      placeholder={t("Enter custom location")}
                      disabled={loading}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </div>
            {(isSleeping || (isEditMode && endDateTime)) && (
              <div>
                <label className="form-label">{t('Sleep Quality')}</label>
                <Select
                  value={formData.quality}
                  onValueChange={(value: SleepQuality) =>
                    setFormData({ ...formData, quality: value })
                  }
                  disabled={loading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("How well did they sleep?")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POOR">{t('Poor')}</SelectItem>
                    <SelectItem value="FAIR">{t('Fair')}</SelectItem>
                    <SelectItem value="GOOD">{t('Good')}</SelectItem>
                    <SelectItem value="EXCELLENT">{t('Excellent')}</SelectItem>
                  </SelectContent>
                </Select>
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
            <Button 
              onClick={handleSubmit}
              disabled={loading}
            >
              {isEditMode ? t('Update Sleep') : (isSleeping ? t('End Sleep') : t('Start Sleep'))}
            </Button>
          </div>
        </FormPageFooter>
    </FormPage>
  );
}
