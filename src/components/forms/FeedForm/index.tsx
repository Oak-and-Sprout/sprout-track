'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FeedType, BreastSide } from '@prisma/client';
import { FeedLogResponse } from '@/app/api/types';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { DateTimePicker } from '@/src/components/ui/date-time-picker';
import {
  FormPage, 
  FormPageContent, 
  FormPageFooter 
} from '@/src/components/ui/form-page';
import { Check } from 'lucide-react';
import { useTimezone } from '@/app/context/timezone';
import { useTheme } from '@/src/context/theme';
import { useToast } from '@/src/components/ui/toast';
import { handleExpirationError } from '@/src/lib/expiration-error-handler';
import './feed-form.css';

// Import subcomponents
import BreastFeedForm from './BreastFeedForm';
import BottleFeedForm from './BottleFeedForm';
import SolidsFeedForm from './SolidsFeedForm';

interface FeedFormProps {
  isOpen: boolean;
  onClose: () => void;
  babyId: string | undefined;
  initialTime: string;
  activity?: FeedLogResponse;
  onSuccess?: () => void;
}

export default function FeedForm({
  isOpen,
  onClose,
  babyId,
  initialTime,
  activity,
  onSuccess,
}: FeedFormProps) {
  const { formatDate, toUTCString } = useTimezone();
  const { theme } = useTheme();
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
    time: initialTime,
    type: '' as FeedType | '',
    amount: '',
    unit: 'OZ', // Default unit
    side: '' as BreastSide | '',
    food: '',
    feedDuration: 0, // Duration in seconds for breastfeeding timer
    leftDuration: 0, // Duration in seconds for left breast
    rightDuration: 0, // Duration in seconds for right breast
    activeBreast: '' as 'LEFT' | 'RIGHT' | '', // Currently active breast for timer
  });
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const [defaultSettings, setDefaultSettings] = useState({
    defaultBottleUnit: 'OZ',
    defaultSolidsUnit: 'TBSP',
  });

  const fetchLastAmount = async (type: FeedType) => {
    if (!babyId) return;
    
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`/api/feed-log/last?babyId=${babyId}&type=${type}`, {
        headers: {
          'Authorization': authToken ? `Bearer ${authToken}` : '',
        },
      });
      if (!response.ok) return;
      
      const data = await response.json();
      if (data.success && data.data?.amount) {
        setFormData(prev => ({
          ...prev,
          amount: data.data.amount.toString(),
          unit: data.data.unitAbbr || prev.unit
        }));
      }
    } catch (error) {
      console.error('Error fetching last amount:', error);
    }
  };

  // Fetch the last feed record to determine the last feed type
  const fetchLastFeedType = async () => {
    if (!babyId) return;
    
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`/api/feed-log/last?babyId=${babyId}`, {
        headers: {
          'Authorization': authToken ? `Bearer ${authToken}` : '',
        },
      });
      if (!response.ok) return;
      
      const data = await response.json();
      if (data.success && data.data?.type) {
        // Set the last feed type
        setFormData(prev => ({
          ...prev,
          type: data.data.type,
          // For breast feeding, also set the side
          ...(data.data.type === 'BREAST' && { side: data.data.side || '' }),
          // For solids, also set the food
          ...(data.data.type === 'SOLIDS' && { food: data.data.food || '' })
        }));
        
        // If it's bottle feeding, also fetch the last amount
        if (data.data.type === 'BOTTLE') {
          // We'll fetch the amount in the useEffect when type changes
        }
      }
    } catch (error) {
      console.error('Error fetching last feed type:', error);
    }
  };

  const fetchDefaultSettings = async () => {
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch('/api/settings', {
        headers: {
          'Authorization': authToken ? `Bearer ${authToken}` : '',
        },
      });
      if (!response.ok) return;
      
      const data = await response.json();
      if (data.success && data.data) {
        setDefaultSettings({
          defaultBottleUnit: data.data.defaultBottleUnit || 'OZ',
          defaultSolidsUnit: data.data.defaultSolidsUnit || 'TBSP',
        });
        
        // Set the default unit from settings
        setFormData(prev => ({
          ...prev,
          unit: data.data.defaultBottleUnit || 'OZ'
        }));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

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
      // Fetch default settings when form opens
      fetchDefaultSettings();
      
      if (activity) {
      // Editing mode - populate with activity data
      // Calculate feedDuration from different sources based on what's available
      let feedDuration = 0;
      
      // First try to get duration from feedDuration field (added in recent migration)
      if (activity.type === 'BREAST' && activity.feedDuration) {
        feedDuration = activity.feedDuration;
      } 
      // Then try to calculate from startTime and endTime if available
      else if (activity.type === 'BREAST' && activity.startTime && activity.endTime) {
        const start = new Date(activity.startTime);
        const end = new Date(activity.endTime);
        feedDuration = Math.floor((end.getTime() - start.getTime()) / 1000);
      }
      // Finally, fall back to amount field (which was used for duration in minutes in older records)
      else if (activity.type === 'BREAST' && activity.amount) {
        // Convert minutes to seconds
        feedDuration = activity.amount * 60;
      }
      
      // Update the selected date time
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
        time: formattedTime, // Add the time property
        type: activity.type,
        amount: activity.amount?.toString() || '',
        unit: activity.unitAbbr || 
          (activity.type === 'BOTTLE' ? defaultSettings.defaultBottleUnit : 
           activity.type === 'SOLIDS' ? defaultSettings.defaultSolidsUnit : ''),
        side: activity.side || '',
        food: activity.food || '',
        feedDuration: feedDuration,
        leftDuration: activity.side === 'LEFT' ? feedDuration : 0,
        rightDuration: activity.side === 'RIGHT' ? feedDuration : 0,
        activeBreast: ''
      });
      } else {
        // New entry mode - set the time and fetch the last feed type
        // The selectedDateTime is already set in the useState initialization
        
        // Fetch the last feed type to pre-populate the form
        fetchLastFeedType();
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

  useEffect(() => {
    if (formData.type === 'BOTTLE' || formData.type === 'SOLIDS') {
      fetchLastAmount(formData.type);
      
      // Set the appropriate default unit based on feed type
      if (formData.type === 'BOTTLE') {
        setFormData(prev => ({ ...prev, unit: defaultSettings.defaultBottleUnit }));
      } else if (formData.type === 'SOLIDS') {
        setFormData(prev => ({ ...prev, unit: defaultSettings.defaultSolidsUnit }));
      }
    }
  }, [formData.type, babyId, defaultSettings.defaultBottleUnit, defaultSettings.defaultSolidsUnit]);

  const handleAmountChange = (newAmount: string) => {
    // Allow any numeric values
    if (newAmount === '' || /^\d*\.?\d*$/.test(newAmount)) {
      setFormData(prev => ({
        ...prev,
        amount: newAmount
      }));
    }
  };

  const incrementAmount = () => {
    const currentAmount = parseFloat(formData.amount || '0');
    // Different step sizes for different units
    let step = 0.5; // Default for OZ and TBSP
    if (formData.unit === 'ML') {
      step = 5;
    } else if (formData.unit === 'G') {
      step = 5; // 1 grams increments for grams
    }
    
    const newAmount = (currentAmount + step).toFixed(formData.unit === 'G' ? 0 : 1);
    setFormData(prev => ({
      ...prev,
      amount: newAmount
    }));
  };

  const decrementAmount = () => {
    const currentAmount = parseFloat(formData.amount || '0');
    // Different step sizes for different units
    let step = 0.5; // Default for OZ and TBSP
    if (formData.unit === 'ML') {
      step = 5;
    } else if (formData.unit === 'G') {
      step = 1; // 1 gram increments for grams
    }
    
    if (currentAmount >= step) {
      const newAmount = (currentAmount - step).toFixed(formData.unit === 'G' ? 0 : 1);
      setFormData(prev => ({
        ...prev,
        amount: newAmount
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!babyId) return;

    // Clear any previous validation errors
    setValidationError('');

    // Validate required fields
    if (!formData.type) {
      setValidationError('Please select a feeding type');
      return;
    }
    
    // Validate date time
    if (!selectedDateTime || isNaN(selectedDateTime.getTime())) {
      setValidationError('Please select a valid date and time');
      return;
    }

    // For breast feeding, at least one side must have a duration
    if (formData.type === 'BREAST' && formData.leftDuration === 0 && formData.rightDuration === 0) {
      setValidationError('Please enter a duration for at least one breast side');
      return;
    }

    // For bottle feeding, validate amount
    if (formData.type === 'BOTTLE' && (!formData.amount || parseFloat(formData.amount) <= 0)) {
      setValidationError('Please enter a valid amount for bottle feeding');
      return;
    }

    // For solids feeding, validate amount
    if (formData.type === 'SOLIDS' && (!formData.amount || parseFloat(formData.amount) <= 0)) {
      setValidationError('Please enter a valid amount for solids feeding');
      return;
    }
    
    // Stop timer if it's running
    if (isTimerRunning) {
      stopTimer();
    }

    setLoading(true);

    try {
      if (formData.type === 'BREAST' && !activity) {
        // For new breast feeding entries, create entries for both sides if they have durations
        if (formData.leftDuration > 0 && formData.rightDuration > 0) {
          // Create entries for both sides
          await createBreastFeedingEntries();
        } else if (formData.leftDuration > 0) {
          // Create only left side entry
          await createSingleFeedEntry('LEFT');
        } else if (formData.rightDuration > 0) {
          // Create only right side entry
          await createSingleFeedEntry('RIGHT');
        }
      } else {
        // For editing or non-breast feeding entries, use the single entry method
        await createSingleFeedEntry(formData.side as BreastSide);
      }

      onClose();
      onSuccess?.();
      
      // Reset form data
      setSelectedDateTime(new Date(initialTime));
      setFormData({
        time: initialTime,
        type: '' as FeedType | '',
        amount: '',
        unit: defaultSettings.defaultBottleUnit,
        side: '' as BreastSide | '',
        food: '',
        feedDuration: 0,
        leftDuration: 0,
        rightDuration: 0,
        activeBreast: ''
      });
    } catch (error) {
      console.error('Error saving feed log:', error);
      // If it's an expiration error, don't close the form (already handled by handleExpirationError)
      if (error instanceof Error && error.message === 'EXPIRATION_ERROR') {
        return;
      }
      // Other errors are already handled with toast in createSingleFeedEntry
    } finally {
      setLoading(false);
    }
  };

  // Helper function to create entries for both breast sides
  const createBreastFeedingEntries = async () => {
    // Create left side entry
    if (formData.leftDuration > 0) {
      await createSingleFeedEntry('LEFT');
    }
    
    // Create right side entry
    if (formData.rightDuration > 0) {
      await createSingleFeedEntry('RIGHT');
    }
  };

  // Helper function to create a single feed entry
  const createSingleFeedEntry = async (breastSide?: BreastSide) => {
    // For breast feeding, use the provided side or the form data side
    const side = formData.type === 'BREAST' ? (breastSide || formData.side) : undefined;
    
    // Calculate start and end times for breastfeeding based on feedDuration
    let startTime, endTime, duration;
    if (formData.type === 'BREAST') {
      // Use the appropriate duration based on the side
      duration = side === 'LEFT' ? formData.leftDuration : 
                 side === 'RIGHT' ? formData.rightDuration : 
                 formData.feedDuration;
      
      if (duration > 0) {
        endTime = new Date(selectedDateTime);
        startTime = new Date(selectedDateTime.getTime() - duration * 1000);
      }
    }
    
    // Convert local time to UTC ISO string
    const localDate = new Date(formData.time);
    const utcTimeString = toUTCString(localDate);
    
    console.log('Original time (local):', formData.time);
    console.log('Converted time (UTC):', utcTimeString);
    console.log('Unit being sent:', formData.unit); // Debug log for unit
    
    const payload = {
      babyId,
      time: utcTimeString, // Send the UTC ISO string instead of local time
      type: formData.type,
      ...(formData.type === 'BREAST' && side && { 
        side,
        ...(startTime && { startTime: toUTCString(startTime) }),
        ...(endTime && { endTime: toUTCString(endTime) }),
        feedDuration: duration
      }),
      ...((formData.type === 'BOTTLE' || formData.type === 'SOLIDS') && formData.amount && { 
        amount: parseFloat(formData.amount),
        unitAbbr: formData.unit // This should correctly send 'TBSP' or 'G'
      }),
      ...(formData.type === 'SOLIDS' && formData.food && { food: formData.food }),
    };

    console.log('Payload being sent:', payload); // Debug log for payload

    // Get auth token from localStorage
    const authToken = localStorage.getItem('authToken');

    const response = await fetch(`/api/feed-log${activity ? `?id=${activity.id}` : ''}`, {
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
        const { isExpirationError, errorData } = await handleExpirationError(
          response,
          showToast,
          'logging feedings'
        );
        if (isExpirationError) {
          // Don't close the form, let user see the error
          throw new Error('EXPIRATION_ERROR');
        }
        // If it's a 403 but not an expiration error, handle it normally
        if (errorData) {
          showToast({
            variant: 'error',
            title: 'Error',
            message: errorData.error || 'Failed to save feed log',
            duration: 5000,
          });
          throw new Error(errorData.error || 'Failed to save feed log');
        }
      }
      
      // Handle other errors
      const errorData = await response.json();
      showToast({
        variant: 'error',
        title: 'Error',
        message: errorData.error || 'Failed to save feed log',
        duration: 5000,
      });
      throw new Error(errorData.error || 'Failed to save feed log');
    }

    return response;
  };

  // This section is now handled in the createSingleFeedEntry and createBreastFeedingEntries functions

  // Timer functionality
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const startTimer = (breast: 'LEFT' | 'RIGHT') => {
    if (!isTimerRunning) {
      setIsTimerRunning(true);
      
      // Set the active breast if provided
      if (breast) {
        setFormData(prev => ({
          ...prev,
          activeBreast: breast
        }));
      }
      
      timerRef.current = setInterval(() => {
        setFormData(prev => {
          // Update the appropriate duration based on active breast
          if (prev.activeBreast === 'LEFT') {
            return {
              ...prev,
              leftDuration: prev.leftDuration + 1
            };
          } else if (prev.activeBreast === 'RIGHT') {
            return {
              ...prev,
              rightDuration: prev.rightDuration + 1
            };
          } else {
            // This case shouldn't happen with the simplified UI
            return prev;
          }
        });
      }, 1000);
    }
  };
  
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsTimerRunning(false);
    
    // Reset active breast when stopping timer
    setFormData(prev => ({
      ...prev,
      activeBreast: ''
    }));
  };
  
  // Format time as hh:mm:ss
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  };
  
  // Enhanced close handler that resets form state
  const handleClose = () => {
    // Stop any running timer
    if (isTimerRunning) {
      stopTimer();
    }
    
    // Clear validation errors
    setValidationError('');
    
    // Reset form data to initial state
    const resetDateTime = new Date(initialTime);
    setSelectedDateTime(resetDateTime);
    setFormData({
      time: initialTime,
      type: '' as FeedType | '',
      amount: '',
      unit: defaultSettings.defaultBottleUnit,
      side: '' as BreastSide | '',
      food: '',
      feedDuration: 0,
      leftDuration: 0,
      rightDuration: 0,
      activeBreast: ''
    });
    
    // Reset initialization flag
    setIsInitialized(false);
    
    // Call the original onClose
    onClose();
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);
  
  return (
    <FormPage
      isOpen={isOpen}
      onClose={handleClose}
      title={activity ? 'Edit Feeding' : 'Log Feeding'}
      description={activity ? 'Update what and when your baby ate' : 'Record what and when your baby ate'}
    >
        <FormPageContent className="overflow-y-auto">
          <form onSubmit={handleSubmit} className="h-full flex flex-col">
          <div className="space-y-4 pb-20">
            {/* Validation Error Display */}
            {validationError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                {validationError}
              </div>
            )}

            {/* Time Selection - Full width on all screens */}
            <div>
              <label className="form-label">Time</label>
              <DateTimePicker
                value={selectedDateTime}
                onChange={handleDateTimeChange}
                disabled={loading}
                placeholder="Select feeding time..."
              />
            </div>
            
            {/* Feed Type Selection - Full width on all screens */}
            <div>
              <label className="form-label">Type</label>
              <div className="flex justify-between items-center gap-3 mt-2">
                  {/* Breast Feed Button */}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'BREAST' })}
                    disabled={loading}
                    className={`relative flex flex-col items-center justify-center p-2 rounded-full w-24 h-24 transition-all feed-type-button ${formData.type === 'BREAST' 
                      ? 'bg-blue-100 ring-2 ring-blue-500 shadow-md feed-type-selected' 
                      : 'bg-gray-50 hover:bg-gray-100'}`}
                  >
                    <img 
                      src="/breastfeed-128.png" 
                      alt="Breast Feed" 
                      className="w-16 h-16 object-contain" 
                    />
                    <span className="text-xs font-medium mt-1">Breast</span>
                    {formData.type === 'BREAST' && (
                      <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-1">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </button>
                  
                  {/* Bottle Feed Button */}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'BOTTLE' })}
                    disabled={loading}
                    className={`relative flex flex-col items-center justify-center p-2 rounded-full w-24 h-24 transition-all feed-type-button ${formData.type === 'BOTTLE' 
                      ? 'bg-blue-100 ring-2 ring-blue-500 shadow-md feed-type-selected' 
                      : 'bg-gray-50 hover:bg-gray-100'}`}
                  >
                    <img 
                      src="/bottlefeed-128.png" 
                      alt="Bottle Feed" 
                      className="w-16 h-16 object-contain" 
                    />
                    <span className="text-xs font-medium mt-1">Bottle</span>
                    {formData.type === 'BOTTLE' && (
                      <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-1">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </button>
                  
                  {/* Solids Button */}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'SOLIDS' })}
                    disabled={loading}
                    className={`relative flex flex-col items-center justify-center p-2 rounded-full w-24 h-24 transition-all feed-type-button ${formData.type === 'SOLIDS' 
                      ? 'bg-blue-100 ring-2 ring-blue-500 shadow-md feed-type-selected' 
                      : 'bg-gray-50 hover:bg-gray-100'}`}
                  >
                    <img 
                      src="/solids-128.png" 
                      alt="Solids" 
                      className="w-16 h-16 object-contain" 
                    />
                    <span className="text-xs font-medium mt-1">Solids</span>
                    {formData.type === 'SOLIDS' && (
                      <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-1">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </button>
                </div>
              </div>
            
            {formData.type === 'BREAST' && (
              <BreastFeedForm
                side={formData.side}
                leftDuration={formData.leftDuration}
                rightDuration={formData.rightDuration}
                activeBreast={formData.activeBreast}
                isTimerRunning={isTimerRunning}
                loading={loading}
                onSideChange={(side) => setFormData({ ...formData, side })}
                onTimerStart={startTimer}
                onTimerStop={stopTimer}
                onDurationChange={(breast, seconds) => {
                  if (breast === 'LEFT') {
                    setFormData(prev => ({ ...prev, leftDuration: seconds }));
                  } else if (breast === 'RIGHT') {
                    setFormData(prev => ({ ...prev, rightDuration: seconds }));
                  }
                }}
                isEditing={!!activity} // Pass true if editing an existing record
              />
            )}
            
            {formData.type === 'BOTTLE' && (
              <BottleFeedForm
                amount={formData.amount}
                unit={formData.unit}
                loading={loading}
                onAmountChange={handleAmountChange}
                onUnitChange={(unit) => setFormData(prev => ({ ...prev, unit }))}
                onIncrement={incrementAmount}
                onDecrement={decrementAmount}
              />
            )}
            
            {formData.type === 'SOLIDS' && (
              <SolidsFeedForm
                amount={formData.amount}
                unit={formData.unit}
                food={formData.food}
                loading={loading}
                onAmountChange={handleAmountChange}
                onUnitChange={(unit) => setFormData(prev => ({ ...prev, unit }))}
                onFoodChange={(food) => setFormData({ ...formData, food })}
                onIncrement={incrementAmount}
                onDecrement={decrementAmount}
              />
            )}
          </div>
          </form>
        </FormPageContent>
        <FormPageFooter>
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
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
