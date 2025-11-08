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
        
        setFormData({
          type: activity.type,
          location: activity.location || '',
          quality: activity.quality || '',
        });
        
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
              
              setFormData(prev => ({
                ...prev,
                type: currentSleep.type,
                location: currentSleep.location || '',
                quality: 'GOOD', // Default to GOOD when ending sleep
              }));
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
          location: formData.location || null,
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
        if (!sleepResponse.ok) throw new Error('Failed to fetch sleep logs');
        const sleepData = await sleepResponse.json();
        if (!sleepData.success) throw new Error('Failed to fetch sleep logs');
        
        const currentSleep = sleepData.data.find((log: SleepLogResponse) => !log.endTime);
        if (!currentSleep) throw new Error('No ongoing sleep record found');

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
          location: formData.location || null,
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
              title: 'Error',
              message: errorData.error || 'Failed to save sleep log',
              duration: 5000,
            });
            throw new Error(errorData.error || 'Failed to save sleep log');
          }
        }
        
        // Handle other errors
        const errorData = await response.json();
        showToast({
          variant: 'error',
          title: 'Error',
          message: errorData.error || 'Failed to save sleep log',
          duration: 5000,
        });
        throw new Error(errorData.error || 'Failed to save sleep log');
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
    } catch (error) {
      console.error('Error saving sleep log:', error);
      // Error toast already shown above for non-expiration errors
    } finally {
      setLoading(false);
    }
  };

  const isEditMode = !!activity;
  const title = isEditMode ? 'Edit Sleep Record' : (isSleeping ? 'End Sleep Session' : 'Start Sleep Session');
  const description = isEditMode 
    ? 'Update sleep record details'
    : (isSleeping ? 'Record when your baby woke up and how well they slept' : 'Record when your baby is going to sleep');

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
              <Label>Start Time</Label>
              <DateTimePicker
                value={startDateTime}
                onChange={handleStartDateTimeChange}
                className="w-full"
                disabled={(isSleeping && !isEditMode) || loading} // Only disabled when ending sleep and not editing
                placeholder="Select start time..."
              />
            </div>
            {(isSleeping || isEditMode) && (
              <div>
                <Label>End Time</Label>
                <DateTimePicker
                  value={endDateTime}
                  onChange={handleEndDateTimeChange}
                  className="w-full"
                  disabled={loading}
                  placeholder="Select end time..."
                />
              </div>
            )}
          </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label">Type</label>
                <Select
                  value={formData.type}
                  onValueChange={(value: SleepType) =>
                    setFormData({ ...formData, type: value })
                  }
                  disabled={(isSleeping && !isEditMode) || loading} // Only disabled when ending sleep and not editing
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NAP">Nap</SelectItem>
                    <SelectItem value="NIGHT_SLEEP">Night Sleep</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="form-label">Location</label>
                <Select
                  value={formData.location}
                  onValueChange={(value: string) =>
                    setFormData({ ...formData, location: value })
                  }
                  disabled={(isSleeping && !isEditMode) || loading} // Only disabled when ending sleep and not editing
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Crib">Crib</SelectItem>
                    <SelectItem value="Car Seat">Car Seat</SelectItem>
                    <SelectItem value="Parents Room">Parents Room</SelectItem>
                    <SelectItem value="Contact">Contact</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(isSleeping || (isEditMode && endDateTime)) && (
              <div>
                <label className="form-label">Sleep Quality</label>
                <Select
                  value={formData.quality}
                  onValueChange={(value: SleepQuality) =>
                    setFormData({ ...formData, quality: value })
                  }
                  disabled={loading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="How well did they sleep?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POOR">Poor</SelectItem>
                    <SelectItem value="FAIR">Fair</SelectItem>
                    <SelectItem value="GOOD">Good</SelectItem>
                    <SelectItem value="EXCELLENT">Excellent</SelectItem>
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
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={loading}
            >
              {isEditMode ? 'Update Sleep' : (isSleeping ? 'End Sleep' : 'Start Sleep')}
            </Button>
          </div>
        </FormPageFooter>
    </FormPage>
  );
}
