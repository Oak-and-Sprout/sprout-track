'use client';

import React, { useState, useEffect } from 'react';
import { DiaperType } from '@prisma/client';
import { DiaperLogResponse } from '@/app/api/types';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { DateTimePicker } from '@/src/components/ui/date-time-picker';
import { Checkbox } from '@/src/components/ui/checkbox';
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
import { useParams } from 'next/navigation';

interface DiaperFormProps {
  isOpen: boolean;
  onClose: () => void;
  babyId: string | undefined;
  initialTime: string;
  activity?: DiaperLogResponse;
  onSuccess?: () => void;
}

export default function DiaperForm({
  isOpen,
  onClose,
  babyId,
  initialTime,
  activity,
  onSuccess,
}: DiaperFormProps) {
  const { toUTCString } = useTimezone();
  const { showToast } = useToast();
  const params = useParams();
  const familySlug = params?.slug as string;
  
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
    time: initialTime,
    type: '' as DiaperType | '',
    condition: '',
    color: '',
    blowout: false,
  });
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Handle date/time change
  const handleDateTimeChange = (date: Date) => {
    setSelectedDateTime(date);
    
    // Also update the time in formData for compatibility with existing code
    // Format the date as ISO string for storage in formData
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    const formattedTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    setFormData(prev => ({ ...prev, time: formattedTime }));
  };

  useEffect(() => {
    if (isOpen && !isInitialized) {
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
        
        // Format the date for the time property
        const date = new Date(activity.time);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const formattedTime = `${year}-${month}-${day}T${hours}:${minutes}`;
        
        setFormData({
          time: formattedTime,
          type: activity.type,
          condition: activity.condition || '',
          color: activity.color || '',
          blowout: activity.blowout || false,
        });
      } else {
        // New entry mode - the selectedDateTime is already set in the useState initialization
      }
      
      // Mark as initialized
      setIsInitialized(true);
    } else if (!isOpen) {
      // Reset initialization flag when form closes
      setIsInitialized(false);
    }
  }, [isOpen, initialTime, activity, isInitialized]);

  // Separate effect to handle initialTime changes for new entries
  useEffect(() => {
    if (isOpen && !activity && isInitialized) {
      // Update the selected date time when initialTime changes for new entries
      try {
        const date = new Date(initialTime);
        if (!isNaN(date.getTime())) {
          setSelectedDateTime(date);
          
          // Also update the time in formData
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const formattedTime = `${year}-${month}-${day}T${hours}:${minutes}`;
          
          setFormData(prev => ({ ...prev, time: formattedTime }));
        }
      } catch (error) {
        console.error('Error parsing initialTime:', error);
      }
    }
  }, [initialTime, isOpen, activity, isInitialized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!babyId) return;

    // Validate required fields
    if (!formData.type) {
      console.error('Required fields missing: type');
      return;
    }
    
    // Validate date time
    if (!selectedDateTime || isNaN(selectedDateTime.getTime())) {
      console.error('Required fields missing: valid date time');
      return;
    }

    setLoading(true);

    try {
      // Convert local time to UTC ISO string using the timezone context
      // We use selectedDateTime instead of formData.time for better accuracy
      const utcTimeString = toUTCString(selectedDateTime);
      
      console.log('Original time (local):', formData.time);
      console.log('Converted time (UTC):', utcTimeString);

      const payload = {
        babyId,
        time: utcTimeString, // Send the UTC ISO string instead of local time
        type: formData.type,
        condition: formData.condition || null,
        color: formData.color || null,
        blowout: formData.blowout,
      };

      // Get auth token from localStorage
      const authToken = localStorage.getItem('authToken');

      const response = await fetch(`/api/diaper-log${activity ? `?id=${activity.id}` : ''}`, {
        method: activity ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : '',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // Check if this is an account expiration error
        if (response.status === 403) {
          const errorData = await response.json();
          const expirationInfo = errorData.data?.expirationInfo;
          
          // Determine user type from JWT token
          let isAccountUser = false;
          let isSysAdmin = false;
          try {
            const token = localStorage.getItem('authToken');
            if (token) {
              const payload = token.split('.')[1];
              const decodedPayload = JSON.parse(atob(payload));
              isAccountUser = decodedPayload.isAccountAuth || false;
              isSysAdmin = decodedPayload.isSysAdmin || false;
            }
          } catch (error) {
            console.error('Error parsing JWT token:', error);
          }
          
          // Determine expiration type and message
          let variant: 'warning' | 'error' = 'warning';
          let title = 'Account Expired';
          let message = errorData.error || 'Your account has expired. Please upgrade to continue.';
          
          if (expirationInfo?.type === 'TRIAL_EXPIRED') {
            title = 'Free Trial Ended';
            message = isAccountUser 
              ? 'Your free trial has ended. Upgrade to continue tracking diaper changes.'
              : 'The account owner\'s free trial has ended. Please contact them to upgrade.';
          } else if (expirationInfo?.type === 'PLAN_EXPIRED') {
            title = 'Subscription Expired';
            message = isAccountUser
              ? 'Your subscription has expired. Please renew to continue adding entries.'
              : 'The account owner\'s subscription has expired. Please contact them to renew.';
          } else if (expirationInfo?.type === 'NO_PLAN') {
            title = 'No Active Subscription';
            message = isAccountUser
              ? 'Subscribe now to continue tracking your baby\'s activities.'
              : 'The account owner needs to subscribe. Please contact them to upgrade.';
          }
          
          // Show toast notification with appropriate action
          if (isAccountUser && !isSysAdmin) {
            // Account user: show upgrade button that opens PaymentModal
            showToast({
              variant,
              title,
              message,
              duration: 6000,
              action: {
                label: 'Upgrade Now',
                onClick: () => {
                  // Dispatch event to open PaymentModal (layout listens for this)
                  window.dispatchEvent(new CustomEvent('openPaymentModal'));
                }
              }
            });
          } else {
            // Caretaker or system user: show message without upgrade button
            showToast({
              variant,
              title,
              message,
              duration: 6000,
              // No action button for caretakers
            });
          }
          
          // Don't close the form, let user see the error
          return;
        }
        
        // For other errors, throw as before
        throw new Error('Failed to save diaper log');
      }

      onClose();
      onSuccess?.();
      
      // Reset form data
      setSelectedDateTime(new Date(initialTime));
      setFormData({
        time: initialTime,
        type: '' as DiaperType | '',
        condition: '',
        color: '',
        blowout: false,
      });
    } catch (error) {
      console.error('Error saving diaper log:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormPage
      isOpen={isOpen}
      onClose={onClose}
      title={activity ? 'Edit Diaper Change' : 'Log Diaper Change'}
      description={activity ? 'Update details about your baby\'s diaper change' : 'Record details about your baby\'s diaper change'}
    >
        <FormPageContent>
          <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Time Selection - Full width on all screens */}
            <div>
              <label className="form-label">Time</label>
              <DateTimePicker
                value={selectedDateTime}
                onChange={handleDateTimeChange}
                disabled={loading}
                placeholder="Select diaper change time..."
              />
            </div>
            
            {/* Type Selection - Full width on all screens */}
            <div>
              <label className="form-label">Type</label>
              <Select
                value={formData.type || ''}
                onValueChange={(value: DiaperType) =>
                  setFormData({ ...formData, type: value })
                }
                disabled={loading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WET">Wet</SelectItem>
                  <SelectItem value="DIRTY">Dirty</SelectItem>
                  <SelectItem value="BOTH">Wet and Dirty</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Blowout/Leakage checkbox - visible for all diaper types */}
            {formData.type && (
              <div className="flex items-center space-x-3">
                <Checkbox
                  checked={formData.blowout}
                  onCheckedChange={(checked) => setFormData({ ...formData, blowout: checked })}
                  disabled={loading}
                />
                <label className="form-label text-sm">
                  Blowout/Leakage
                </label>
              </div>
            )}

            {formData.type && formData.type !== 'WET' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Condition</label>
                  <Select
                    value={formData.condition}
                    onValueChange={(value: string) =>
                      setFormData({ ...formData, condition: value })
                    }
                    disabled={loading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NORMAL">Normal</SelectItem>
                      <SelectItem value="LOOSE">Loose</SelectItem>
                      <SelectItem value="FIRM">Firm</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="form-label">Color</label>
                  <Select
                    value={formData.color}
                    onValueChange={(value: string) =>
                      setFormData({ ...formData, color: value })
                    }
                    disabled={loading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select color" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YELLOW">Yellow</SelectItem>
                      <SelectItem value="BROWN">Brown</SelectItem>
                      <SelectItem value="GREEN">Green</SelectItem>
                      <SelectItem value="BLACK">Black</SelectItem>
                      <SelectItem value="RED">Red</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
            <Button onClick={handleSubmit} disabled={loading}>
              {activity ? 'Update' : 'Save'}
            </Button>
          </div>
        </FormPageFooter>
    </FormPage>
  );
}
