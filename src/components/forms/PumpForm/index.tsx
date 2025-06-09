'use client';

import React, { useState, useEffect } from 'react';
import { PumpLogResponse } from '@/app/api/types';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
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
import { useTheme } from '@/src/context/theme';
import { Plus, Minus } from 'lucide-react';
import './pump-form.css';


interface PumpFormProps {
  isOpen: boolean;
  onClose: () => void;
  babyId: string | undefined;
  initialTime: string;
  activity?: PumpLogResponse;
  onSuccess?: () => void;
}

export default function PumpForm({
  isOpen,
  onClose,
  babyId,
  initialTime,
  activity,
  onSuccess,
}: PumpFormProps) {
  const { formatDate, toUTCString } = useTimezone();
  const { theme } = useTheme();
  const [selectedStartDateTime, setSelectedStartDateTime] = useState<Date>(() => {
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
  
  const [selectedEndDateTime, setSelectedEndDateTime] = useState<Date>(() => {
    try {
      // Initialize with current time + 15 minutes as default
      const date = new Date(initialTime);
      date.setMinutes(date.getMinutes() + 15);
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 15);
        return now; // Fallback to current date + 15 min if invalid
      }
      return date;
    } catch (error) {
      console.error('Error setting initial end time:', error);
      const now = new Date();
      now.setMinutes(now.getMinutes() + 15);
      return now; // Fallback to current date + 15 min
    }
  });
  
  const [formData, setFormData] = useState({
    startTime: initialTime,
    endTime: '',
    leftAmount: '',
    rightAmount: '',
    totalAmount: '',
    unitAbbr: 'OZ', // Default unit
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Handle start date/time change
  const handleStartDateTimeChange = (date: Date) => {
    setSelectedStartDateTime(date);
    
    // Also update the time in formData for compatibility with existing code
    // Format the date as ISO string for storage in formData
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    const formattedTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    setFormData(prev => ({ ...prev, startTime: formattedTime }));
  };
  
  // Handle end date/time change
  const handleEndDateTimeChange = (date: Date) => {
    setSelectedEndDateTime(date);
    
    // Format the date as ISO string for storage in formData
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    const formattedTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    setFormData(prev => ({ ...prev, endTime: formattedTime }));
  };

  useEffect(() => {
    if (isOpen && !isInitialized) {
      if (activity) {
        // Editing mode - populate with activity data
        try {
          // Set the start date time
          const startDate = new Date(activity.startTime);
          if (!isNaN(startDate.getTime())) {
            setSelectedStartDateTime(startDate);
          }
          
          // Set the end date time if it exists
          if (activity.endTime) {
            const endDate = new Date(activity.endTime);
            if (!isNaN(endDate.getTime())) {
              setSelectedEndDateTime(endDate);
            }
          }
        } catch (error) {
          console.error('Error parsing activity times:', error);
        }
        
        // Format the start date for the time property
        const startDate = new Date(activity.startTime);
        const startYear = startDate.getFullYear();
        const startMonth = String(startDate.getMonth() + 1).padStart(2, '0');
        const startDay = String(startDate.getDate()).padStart(2, '0');
        const startHours = String(startDate.getHours()).padStart(2, '0');
        const startMinutes = String(startDate.getMinutes()).padStart(2, '0');
        const formattedStartTime = `${startYear}-${startMonth}-${startDay}T${startHours}:${startMinutes}`;
        
        // Format the end date for the time property if it exists
        let formattedEndTime = '';
        if (activity.endTime) {
          const endDate = new Date(activity.endTime);
          const endYear = endDate.getFullYear();
          const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
          const endDay = String(endDate.getDate()).padStart(2, '0');
          const endHours = String(endDate.getHours()).padStart(2, '0');
          const endMinutes = String(endDate.getMinutes()).padStart(2, '0');
          formattedEndTime = `${endYear}-${endMonth}-${endDay}T${endHours}:${endMinutes}`;
        }
        
        setFormData({
          startTime: formattedStartTime,
          endTime: formattedEndTime,
          leftAmount: activity.leftAmount?.toString() || '',
          rightAmount: activity.rightAmount?.toString() || '',
          totalAmount: activity.totalAmount?.toString() || '',
          unitAbbr: activity.unitAbbr || 'OZ',
          notes: activity.notes || '',
        });
      } else {
        // New entry mode - the selectedStartDateTime is already set in the useState initialization
      }
      
      // Mark as initialized
      setIsInitialized(true);
    } else if (!isOpen) {
      // Reset initialization flag when form closes
      setIsInitialized(false);
    }
  }, [isOpen, initialTime, activity, isInitialized]);

  // Handle amount increment/decrement
  const incrementAmount = (field: 'leftAmount' | 'rightAmount') => {
    const currentAmount = parseFloat(formData[field] || '0');
    const step = formData.unitAbbr === 'ML' ? 5 : 0.5;
    const newAmount = (currentAmount + step).toFixed(1); // Only show one decimal place
    
    // Update the field and recalculate total
    updateAmountField(field, newAmount);
  };

  const decrementAmount = (field: 'leftAmount' | 'rightAmount') => {
    const currentAmount = parseFloat(formData[field] || '0');
    const step = formData.unitAbbr === 'ML' ? 5 : 0.5;
    if (currentAmount >= step) {
      const newAmount = (currentAmount - step).toFixed(1); // Only show one decimal place
      
      // Update the field and recalculate total
      updateAmountField(field, newAmount);
    }
  };

  // Update amount field and recalculate total
  const updateAmountField = (field: 'leftAmount' | 'rightAmount' | 'totalAmount', value: string) => {
    // For amount fields, allow any numeric values
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      if (field === 'leftAmount' || field === 'rightAmount') {
        // Update the specific field
        setFormData(prev => ({ ...prev, [field]: value }));
        
        // Recalculate total
        const leftVal = field === 'leftAmount' ? value : formData.leftAmount;
        const rightVal = field === 'rightAmount' ? value : formData.rightAmount;
        
        const leftNum = leftVal ? parseFloat(leftVal) : 0;
        const rightNum = rightVal ? parseFloat(rightVal) : 0;
        
        setFormData(prev => ({ 
          ...prev, 
          [field]: value,
          totalAmount: (leftNum + rightNum).toFixed(1) // Only show one decimal place
        }));
      } else {
        // Just update the total field directly
        setFormData(prev => ({ ...prev, totalAmount: value }));
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (['leftAmount', 'rightAmount', 'totalAmount'].includes(name)) {
      updateAmountField(name as 'leftAmount' | 'rightAmount' | 'totalAmount', value);
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!babyId) {
      console.error('No baby selected');
      return;
    }
    
    setLoading(true);
    
    try {
      // Calculate duration between start and end times
      let duration: number | undefined = undefined;
      duration = Math.round((selectedEndDateTime.getTime() - selectedStartDateTime.getTime()) / 60000); // Convert ms to minutes
      
      // Convert local times to UTC ISO strings using the selectedDateTime objects
      const utcStartTime = toUTCString(selectedStartDateTime);
      
      // Convert end time to UTC
      const utcEndTime = toUTCString(selectedEndDateTime);
      
      console.log('Original start time (local):', selectedStartDateTime.toLocaleString());
      console.log('Converted start time (UTC):', utcStartTime);
      console.log('Original end time (local):', selectedEndDateTime.toLocaleString());
      console.log('Converted end time (UTC):', utcEndTime);
      
      const payload = {
        babyId,
        startTime: utcStartTime, // Send the UTC ISO string instead of local time
        endTime: utcEndTime,
        duration,
        leftAmount: formData.leftAmount ? parseFloat(formData.leftAmount) : undefined,
        rightAmount: formData.rightAmount ? parseFloat(formData.rightAmount) : undefined,
        totalAmount: formData.totalAmount ? parseFloat(formData.totalAmount) : undefined,
        unitAbbr: formData.unitAbbr || 'OZ',
        notes: formData.notes || undefined,
      };
      
      // Determine if we're creating a new record or updating an existing one
      const url = activity ? `/api/pump-log?id=${activity.id}` : '/api/pump-log';
      const method = activity ? 'PUT' : 'POST';
      
      // Get auth token from localStorage
      const authToken = localStorage.getItem('authToken');
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : '',
        },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Close the form and trigger the success callback
        onClose();
        if (onSuccess) onSuccess();
      } else {
        console.error('Error saving pump log:', data.error);
        alert(`Error: ${data.error || 'Failed to save pump log'}`);
      }
    } catch (error) {
      console.error('Error saving pump log:', error);
      alert('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormPage
      isOpen={isOpen}
      onClose={onClose}
      title={activity ? 'Edit Pump' : 'New Pump'}
      description={activity ? 'Update details about your pumping session' : 'Record details about your pumping session'}
    >
        <FormPageContent>
          <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Start Time Input */}
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <DateTimePicker
                value={selectedStartDateTime}
                onChange={handleStartDateTimeChange}
                disabled={loading}
                placeholder="Select start time..."
              />
            </div>
            
            {/* End Time Input */}
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <DateTimePicker
                value={selectedEndDateTime}
                onChange={handleEndDateTimeChange}
                disabled={loading}
                placeholder="Select end time..."
              />
            </div>
            
            {/* Unit Selection with Buttons - Moved above amount inputs */}
            <div className="space-y-2">
              <Label htmlFor="unitAbbr">Unit</Label>
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant={formData.unitAbbr === 'OZ' ? 'default' : 'outline'}
                  className="w-full unit-button"
                  onClick={() => setFormData(prev => ({ ...prev, unitAbbr: 'OZ' }))}
                  disabled={loading}
                >
                  oz
                </Button>
                <Button
                  type="button"
                  variant={formData.unitAbbr === 'ML' ? 'default' : 'outline'}
                  className="w-full unit-button"
                  onClick={() => setFormData(prev => ({ ...prev, unitAbbr: 'ML' }))}
                  disabled={loading}
                >
                  ml
                </Button>
              </div>
            </div>
            
            {/* Left Amount Input - Now on its own row */}
            <div className="space-y-2">
              <Label htmlFor="leftAmount">Left Amount</Label>
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => decrementAmount('leftAmount')}
                  disabled={loading}
                  className="bg-gradient-to-r from-teal-600 to-emerald-600 border-0 rounded-full h-10 w-10 flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5 decrement-button"
                >
                  <Minus className="h-4 w-4 text-white" />
                </Button>
                <div className="flex mx-2">
                  <Input
                    id="leftAmount"
                    name="leftAmount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={formData.leftAmount}
                    onChange={handleInputChange}
                    className="rounded-r-none text-center text-lg w-24"
                  />
                  <div className="inline-flex items-center px-3 bg-gray-200 border border-l-0 border-gray-300 rounded-r-md amount-unit">
                    {formData.unitAbbr}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => incrementAmount('leftAmount')}
                  disabled={loading}
                  className="bg-gradient-to-r from-teal-600 to-emerald-600 border-0 rounded-full h-10 w-10 flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5 increment-button"
                >
                  <Plus className="h-4 w-4 text-white" />
                </Button>
              </div>
            </div>
            
            {/* Right Amount Input - Now on its own row */}
            <div className="space-y-2">
              <Label htmlFor="rightAmount">Right Amount</Label>
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => decrementAmount('rightAmount')}
                  disabled={loading}
                  className="bg-gradient-to-r from-teal-600 to-emerald-600 border-0 rounded-full h-10 w-10 flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5 decrement-button"
                >
                  <Minus className="h-4 w-4 text-white" />
                </Button>
                <div className="flex mx-2">
                  <Input
                    id="rightAmount"
                    name="rightAmount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={formData.rightAmount}
                    onChange={handleInputChange}
                    className="rounded-r-none text-center text-lg w-24"
                  />
                  <div className="inline-flex items-center px-3 bg-gray-200 border border-l-0 border-gray-300 rounded-r-md amount-unit">
                    {formData.unitAbbr}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => incrementAmount('rightAmount')}
                  disabled={loading}
                  className="bg-gradient-to-r from-teal-600 to-emerald-600 border-0 rounded-full h-10 w-10 flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5 increment-button"
                >
                  <Plus className="h-4 w-4 text-white" />
                </Button>
              </div>
            </div>
            
            {/* Total Amount */}
            <div className="space-y-2">
              <Label htmlFor="totalAmount">Total Amount</Label>
              <div className="flex">
                <Input
                  id="totalAmount"
                  name="totalAmount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.0"
                  value={formData.totalAmount}
                  onChange={handleInputChange}
                  className="rounded-r-none text-lg"
                />
                <div className="inline-flex items-center px-3 bg-gray-200 border border-l-0 border-gray-300 rounded-r-md amount-unit">
                  {formData.unitAbbr}
                </div>
              </div>
            </div>
            
            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Enter any notes about the pumping session"
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
              {loading ? 'Saving...' : (activity ? 'Update' : 'Save')}
            </Button>
          </div>
        </FormPageFooter>
    </FormPage>
  );
}
