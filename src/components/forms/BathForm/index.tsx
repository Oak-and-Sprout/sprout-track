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
import { useFamily } from '@/src/context/family';

interface BathFormProps {
  isOpen: boolean;
  onClose: () => void;
  babyId: string | undefined;
  initialTime: string;
  activity?: BathLogResponse;
  onSuccess?: () => void;
  familyId?: string; // Add familyId prop for multi-family support
}

export default function BathForm({
  isOpen,
  onClose,
  babyId,
  initialTime,
  activity,
  onSuccess,
  familyId,
}: BathFormProps) {
  const { formatDate, toUTCString } = useTimezone();
  const { family } = useFamily();
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
        setFormData({
          soapUsed: activity.soapUsed || false,
          shampooUsed: activity.shampooUsed || false,
          notes: activity.notes || '',
        });
      } else {
        // New entry mode - set the time
        try {
          const initialDate = new Date(initialTime);
          // Check if the date is valid
          if (!isNaN(initialDate.getTime())) {
            setSelectedDateTime(initialDate);
          }
        } catch (error) {
          console.error('Error parsing initialTime:', error);
        }
      }
      
      // Mark as initialized
      setIsInitialized(true);
    } else if (!isOpen) {
      // Reset initialization flag when form closes
      setIsInitialized(false);
    }
  }, [isOpen, initialTime, activity, isInitialized]);

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
        familyId: familyId || family?.id || undefined, // Use prop familyId, fallback to context family ID
      };
      
      // Determine if we're creating a new record or updating an existing one
      const url = activity ? `/api/bath-log?id=${activity.id}` : '/api/bath-log';
      const method = activity ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Close the form and trigger the success callback
        onClose();
        if (onSuccess) onSuccess();
      } else {
        console.error('Error saving bath log:', data.error);
        alert(`Error: ${data.error || 'Failed to save bath log'}`);
      }
    } catch (error) {
      console.error('Error saving bath log:', error);
      alert('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormPage
      isOpen={isOpen}
      onClose={onClose}
      title={activity ? 'Edit Bath' : 'New Bath'}
    >
        <FormPageContent>
          <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Date/Time Input */}
            <div className="space-y-2">
              <Label>Date & Time</Label>
              <DateTimePicker
                value={selectedDateTime}
                onChange={handleDateTimeChange}
                disabled={loading}
                placeholder="Select bath time..."
              />
            </div>
            
            {/* Bath Options */}
            <div className="space-y-2">
              <Label>Bath Options</Label>
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
                  <Label htmlFor="soapUsed" className="cursor-pointer">Soap Used</Label>
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
                  <Label htmlFor="shampooUsed" className="cursor-pointer">Shampoo Used</Label>
                </div>
              </div>
            </div>
            

            
            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Enter any notes about the bath"
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
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Saving...' : activity ? 'Update' : 'Save'}
            </Button>
          </div>
        </FormPageFooter>
    </FormPage>
  );
}
