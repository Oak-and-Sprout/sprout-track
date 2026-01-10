'use client';

import React, { useState, useEffect } from 'react';
import { BathLogResponse } from '@/app/api/types';
import { Button } from '@/src/components/ui/button';
import { Textarea } from '@/src/components/ui/textarea';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Label } from '@/src/components/ui/label';
import { DateTimePicker } from '@/src/components/ui/date-time-picker';
import {
  FormPage, 
  FormPageContent, 
  FormPageFooter 
} from '@/src/components/ui/form-page';
import { useTimezone } from '@/app/context/timezone';
import { useToast } from '@/src/components/ui/toast';
import { handleExpirationError } from '@/src/lib/expiration-error-handler';
import { useLocalization } from '@/src/context/localization';

interface BathFormProps {
  isOpen: boolean;
  onClose: () => void;
  babyId: string | undefined;
  initialTime: string;
  activity?: BathLogResponse;
  onSuccess?: () => void;
}

export default function BathForm({
  isOpen,
  onClose,
  babyId,
  initialTime,
  activity,
  onSuccess,
}: BathFormProps) {
  const { t } = useLocalization();
  const { toUTCString } = useTimezone();
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
  const [formData, setFormData] = useState({
    soapUsed: false,
    shampooUsed: false,
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializedTime, setInitializedTime] = useState<string | null>(null);
  const [lastActivityId, setLastActivityId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Only initialize if not already initialized, or if activity ID changed (switching between edit/new/different activities)
      const currentActivityId = activity?.id || null;
      const shouldInitialize = !isInitialized || currentActivityId !== lastActivityId;
      
      if (shouldInitialize) {
        if (activity) {
          // Editing mode - populate with activity data
          try {
            const activityDate = new Date(activity.time);
            // Check if the date is valid
            if (!isNaN(activityDate.getTime())) {
              setSelectedDateTime(activityDate);
            }
          } catch (error) {
            console.error('Error parsing activity time:', error);
          }
          setFormData({
            soapUsed: activity.soapUsed || false,
            shampooUsed: activity.shampooUsed || false,
            notes: activity.notes || '',
          });
          
          // Store the initial time used for editing
          setInitializedTime(activity.time);
        } else {
          // New entry mode - initialize from initialTime prop
          try {
            const initialDate = new Date(initialTime);
            // Check if the date is valid
            if (!isNaN(initialDate.getTime())) {
              setSelectedDateTime(initialDate);
            }
          } catch (error) {
            console.error('Error parsing initialTime:', error);
          }
          
          // Store the initial time used for new entry
          setInitializedTime(initialTime);
        }
        
        // Mark as initialized and track activity ID
        setIsInitialized(true);
        setLastActivityId(currentActivityId);
      }
    } else if (!isOpen) {
      // Reset initialization flag and stored time when form closes
      setIsInitialized(false);
      setInitializedTime(null);
      setLastActivityId(null);
    }
  }, [isOpen, activity, initialTime, isInitialized, lastActivityId]);

  // Handle date/time change
  const handleDateTimeChange = (date: Date) => {
    setSelectedDateTime(date);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!babyId) {
      console.error('No baby selected');
      return;
    }
    
    setLoading(true);
    
    try {
      // Convert local time to UTC ISO string
      const utcTimeString = toUTCString(selectedDateTime);
      
      console.log('Original time (local):', selectedDateTime.toISOString());
      console.log('Converted time (UTC):', utcTimeString);
      
      const payload = {
        babyId,
        time: utcTimeString, // Send the UTC ISO string instead of local time
        soapUsed: formData.soapUsed,
        shampooUsed: formData.shampooUsed,
        notes: formData.notes || null,
      };
      
      // Get auth token from localStorage
      const authToken = localStorage.getItem('authToken');
      
      // Determine if we're creating a new record or updating an existing one
      const url = activity ? `/api/bath-log?id=${activity.id}` : '/api/bath-log';
      const method = activity ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : '',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // Check if this is an account expiration error
        if (response.status === 403) {
          const { isExpirationError, errorData } = await handleExpirationError(
            response, 
            showToast, 
            'tracking baths'
          );
          if (isExpirationError) {
            // Don't close the form, let user see the error
            return;
          }
          // If it's a 403 but not an expiration error, use the errorData we got
          if (errorData) {
            showToast({
              variant: 'error',
              title: 'Error',
              message: errorData.error || 'Failed to save bath log',
              duration: 5000,
            });
            return;
          }
        }
        
        // For other errors, parse and show error message
        const errorData = await response.json();
        console.error('Error saving bath log:', errorData.error);
        showToast({
          variant: 'error',
          title: 'Error',
          message: errorData.error || 'Failed to save bath log',
          duration: 5000,
        });
        return;
      }

      const data = await response.json();
      
      if (data.success) {
        // Close the form and trigger the success callback
        onClose();
        if (onSuccess) onSuccess();
      } else {
        console.error('Error saving bath log:', data.error);
        showToast({
          variant: 'error',
          title: 'Error',
          message: data.error || 'Failed to save bath log',
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error saving bath log:', error);
      showToast({
        variant: 'error',
        title: 'Error',
        message: 'An unexpected error occurred. Please try again.',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormPage
      isOpen={isOpen}
      onClose={onClose}
      title={activity ? t('Edit Bath') : t('New Bath')}
    >
        <FormPageContent>
          <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Date/Time Input */}
            <div className="space-y-2">
              <Label>{t('Date & Time')}</Label>
              <DateTimePicker
                value={selectedDateTime}
                onChange={handleDateTimeChange}
                disabled={loading}
                placeholder={t("Select bath time...")}
              />
            </div>
            
            {/* Bath Options */}
            <div className="space-y-2">
              <Label>{t('Bath Options')}</Label>
              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="soapUsed"
                    checked={formData.soapUsed}
                    onCheckedChange={(checked) => 
                      handleCheckboxChange('soapUsed', checked as boolean)
                    }
                    variant="success"
                  />
                  <Label htmlFor="soapUsed" className="cursor-pointer">{t('Soap Used')}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="shampooUsed"
                    checked={formData.shampooUsed}
                    onCheckedChange={(checked) => 
                      handleCheckboxChange('shampooUsed', checked as boolean)
                    }
                    variant="success"
                  />
                  <Label htmlFor="shampooUsed" className="cursor-pointer">{t('Shampoo Used')}</Label>
                </div>
              </div>
            </div>
            

            
            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">{t('Notes')}</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder={t("Enter any notes about the bath")}
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
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
            <Button
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? t('Saving...') : activity ? t('Update') : t('Save')}
            </Button>
          </div>
        </FormPageFooter>
    </FormPage>
  );
}
