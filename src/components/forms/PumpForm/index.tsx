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
import { useToast } from '@/src/components/ui/toast';
import { handleExpirationError } from '@/src/lib/expiration-error-handler';
import { Plus, Minus } from 'lucide-react';
import { Switch } from '@/src/components/ui/switch';
import { useLocalization } from '@/src/context/localization';
import { BreastMilkAdjustmentResponse } from '@/app/api/types';

import './pump-form.css';


interface PumpFormProps {
  isOpen: boolean;
  onClose: () => void;
  babyId: string | undefined;
  initialTime: string;
  activity?: PumpLogResponse;
  adjustmentActivity?: BreastMilkAdjustmentResponse;
  onSuccess?: () => void;
}

export default function PumpForm({
  isOpen,
  onClose,
  babyId,
  initialTime,
  activity,
  adjustmentActivity,
  onSuccess,
}: PumpFormProps) {
  const { t } = useLocalization();
  const { formatDate, toUTCString } = useTimezone();
  const { theme } = useTheme();
  const { showToast } = useToast();

  // Adjustment mode state
  const [isAdjustMode, setIsAdjustMode] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustUnit, setAdjustUnit] = useState('OZ');
  const [adjustIsAdding, setAdjustIsAdding] = useState(true);
  const [adjustReason, setAdjustReason] = useState('Initial Stock');
  const [adjustNotes, setAdjustNotes] = useState('');

  // Pump action state
  const [pumpAction, setPumpAction] = useState<'STORED' | 'FED' | 'DISCARDED'>('STORED');
  const [selectedStartDateTime, setSelectedStartDateTime] = useState<Date>(() => {
    try {
      // Initialize with current time - 15 minutes as default (start time is in the past)
      const date = new Date(initialTime);
      date.setMinutes(date.getMinutes() - 15);
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - 15);
        return now; // Fallback to current date - 15 min if invalid
      }
      return date;
    } catch (error) {
      console.error('Error parsing initialTime:', error);
      const now = new Date();
      now.setMinutes(now.getMinutes() - 15);
      return now; // Fallback to current date - 15 min
    }
  });
  
  const [selectedEndDateTime, setSelectedEndDateTime] = useState<Date>(() => {
    try {
      // Initialize with current time as default (end time is now)
      const date = new Date(initialTime);
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return new Date(); // Fallback to current date if invalid
      }
      return date;
    } catch (error) {
      console.error('Error setting initial end time:', error);
      return new Date(); // Fallback to current date
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
  const [initializedTime, setInitializedTime] = useState<string | null>(null);
  const [breastMilkTrackingEnabled, setBreastMilkTrackingEnabled] = useState(true);

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

  // Initialize adjustment mode when editing an adjustment
  useEffect(() => {
    if (isOpen && adjustmentActivity) {
      setIsAdjustMode(true);
      setAdjustAmount(Math.abs(adjustmentActivity.amount).toString());
      setAdjustUnit(adjustmentActivity.unitAbbr || 'OZ');
      setAdjustIsAdding(adjustmentActivity.amount >= 0);
      setAdjustReason(adjustmentActivity.reason || 'Other');
      setAdjustNotes(adjustmentActivity.notes || '');
    } else if (isOpen && !adjustmentActivity) {
      setIsAdjustMode(false);
    }
  }, [isOpen, adjustmentActivity]);

  useEffect(() => {
    if (isOpen && !isInitialized) {
      if (activity) {
        // Set pump action from activity
        setPumpAction((activity as any).pumpAction || 'STORED');
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
        // New entry mode - fetch default unit from settings
        const fetchDefaultUnit = async () => {
          try {
            const authToken = localStorage.getItem('authToken');
            const response = await fetch('/api/settings', {
              headers: {
                'Authorization': authToken ? `Bearer ${authToken}` : '',
              },
            });
            if (!response.ok) return;
            const data = await response.json();
            if (data.success && data.data?.defaultBottleUnit) {
              setFormData(prev => ({ ...prev, unitAbbr: data.data.defaultBottleUnit }));
            }
            setBreastMilkTrackingEnabled(data.data?.enableBreastMilkTracking ?? true);
          } catch (error) {
            console.error('Error fetching settings:', error);
          }
        };
        fetchDefaultUnit();

        // Initialize from initialTime prop
        try {
          const date = new Date(initialTime);
          if (!isNaN(date.getTime())) {
            // Set start time to 15 minutes in the past
            const startDate = new Date(date);
            startDate.setMinutes(startDate.getMinutes() - 15);
            setSelectedStartDateTime(startDate);
            
            // Set end time to current time
            setSelectedEndDateTime(date);
            
            // Also update the times in formData
            const startYear = startDate.getFullYear();
            const startMonth = String(startDate.getMonth() + 1).padStart(2, '0');
            const startDay = String(startDate.getDate()).padStart(2, '0');
            const startHours = String(startDate.getHours()).padStart(2, '0');
            const startMinutes = String(startDate.getMinutes()).padStart(2, '0');
            const formattedStartTime = `${startYear}-${startMonth}-${startDay}T${startHours}:${startMinutes}`;
            
            const endYear = date.getFullYear();
            const endMonth = String(date.getMonth() + 1).padStart(2, '0');
            const endDay = String(date.getDate()).padStart(2, '0');
            const endHours = String(date.getHours()).padStart(2, '0');
            const endMinutes = String(date.getMinutes()).padStart(2, '0');
            const formattedEndTime = `${endYear}-${endMonth}-${endDay}T${endHours}:${endMinutes}`;
            
            setFormData(prev => ({ 
              ...prev, 
              startTime: formattedStartTime,
              endTime: formattedEndTime
            }));
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
      // Reset all form state when form closes
      setIsInitialized(false);
      setInitializedTime(null);
      setFormData({
        startTime: '',
        endTime: '',
        leftAmount: '',
        rightAmount: '',
        totalAmount: '',
        unitAbbr: 'OZ',
        notes: '',
      });
      setPumpAction('STORED');
      setAdjustAmount('');
      setAdjustUnit('OZ');
      setAdjustIsAdding(true);
      setAdjustReason('Initial Stock');
      setAdjustNotes('');
      setIsAdjustMode(false);
    }
  }, [isOpen, activity, initialTime]);

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

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!babyId) {
      console.error('No baby selected');
      return;
    }

    const parsedAmount = parseFloat(adjustAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast({ variant: 'error', title: 'Error', message: t('Please enter a valid amount'), duration: 5000 });
      return;
    }

    setLoading(true);

    try {
      const finalAmount = adjustIsAdding ? parsedAmount : -parsedAmount;
      const utcTime = toUTCString(new Date());

      const payload = {
        babyId,
        time: utcTime,
        amount: finalAmount,
        unitAbbr: adjustUnit,
        reason: adjustReason,
        notes: adjustNotes || undefined,
      };

      const url = adjustmentActivity
        ? `/api/breast-milk-adjustment?id=${adjustmentActivity.id}`
        : '/api/breast-milk-adjustment';
      const method = adjustmentActivity ? 'PUT' : 'POST';

      const authToken = localStorage.getItem('authToken');
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : '',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 403) {
          const { isExpirationError } = await handleExpirationError(response, showToast, 'adjusting breast milk inventory');
          if (isExpirationError) return;
        }
        const data = await response.json();
        showToast({ variant: 'error', title: 'Error', message: data.error || 'Failed to save adjustment', duration: 5000 });
        return;
      }

      const data = await response.json();
      if (data.success) {
        onClose();
        if (onSuccess) onSuccess();
      } else {
        showToast({ variant: 'error', title: 'Error', message: data.error || 'Failed to save adjustment', duration: 5000 });
      }
    } catch (error) {
      console.error('Error saving adjustment:', error);
      showToast({ variant: 'error', title: 'Error', message: 'An unexpected error occurred.', duration: 5000 });
    } finally {
      setLoading(false);
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
        startTime: utcStartTime,
        endTime: utcEndTime,
        duration,
        leftAmount: formData.leftAmount ? parseFloat(formData.leftAmount) : undefined,
        rightAmount: formData.rightAmount ? parseFloat(formData.rightAmount) : undefined,
        totalAmount: formData.totalAmount ? parseFloat(formData.totalAmount) : undefined,
        unitAbbr: formData.unitAbbr || 'OZ',
        pumpAction,
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
      
      if (!response.ok) {
        // Check if this is an account expiration error
        if (response.status === 403) {
          const { isExpirationError } = await handleExpirationError(
            response,
            showToast,
            'logging pump sessions'
          );
          if (isExpirationError) {
            // Don't close the form, let user see the error
            return;
          }
        }
        
        // For other errors, parse and display
        const data = await response.json();
        showToast({
          variant: 'error',
          title: 'Error',
          message: data.error || 'Failed to save pump log',
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
        showToast({
          variant: 'error',
          title: 'Error',
          message: data.error || 'Failed to save pump log',
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error saving pump log:', error);
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

  const adjustReasons = ['Initial Stock', 'Expired', 'Spilled', 'Donated', 'Other'];

  const incrementAdjustAmount = () => {
    const current = parseFloat(adjustAmount || '0');
    const step = adjustUnit === 'ML' ? 5 : 0.5;
    setAdjustAmount((current + step).toFixed(1));
  };

  const decrementAdjustAmount = () => {
    const current = parseFloat(adjustAmount || '0');
    const step = adjustUnit === 'ML' ? 5 : 0.5;
    if (current >= step) {
      setAdjustAmount((current - step).toFixed(1));
    }
  };

  // Determine titles based on mode
  const getTitle = () => {
    if (isAdjustMode) {
      return adjustmentActivity ? t('Edit Adjustment') : t('Adjust Inventory');
    }
    return activity ? t('Edit Pump') : t('New Pump');
  };

  const getDescription = () => {
    if (isAdjustMode) {
      return t('Add or remove breast milk from your stored inventory');
    }
    return activity ? t('Update details about your pumping session') : t('Record details about your pumping session');
  };

  return (
    <FormPage
      isOpen={isOpen}
      onClose={onClose}
      title={getTitle()}
      description={getDescription()}
    >
        <FormPageContent>
          {/* Mode Switch - only show when not editing and breast milk tracking is enabled */}
          {breastMilkTrackingEnabled && !activity && !adjustmentActivity && (
            <div className="flex items-center gap-3 px-1 py-3 mb-4">
              <Label className="text-sm font-medium">{t('Pump Session')}</Label>
              <Switch
                checked={isAdjustMode}
                onCheckedChange={setIsAdjustMode}
                disabled={loading}
              />
              <Label className="text-sm font-medium">{t('Adjust Inventory')}</Label>
            </div>
          )}

          {isAdjustMode ? (
            /* Adjustment Mode Form */
            <form onSubmit={handleAdjustmentSubmit}>
              <div className="space-y-4">
                {/* Add/Remove Toggle */}
                <div className="space-y-2">
                  <Label>{t('Type')}</Label>
                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      variant={adjustIsAdding ? 'default' : 'outline'}
                      className="w-full"
                      onClick={() => setAdjustIsAdding(true)}
                      disabled={loading}
                    >
                      + {t('Add')}
                    </Button>
                    <Button
                      type="button"
                      variant={!adjustIsAdding ? 'default' : 'outline'}
                      className="w-full"
                      onClick={() => setAdjustIsAdding(false)}
                      disabled={loading}
                    >
                      - {t('Remove')}
                    </Button>
                  </div>
                </div>

                {/* Unit Selection */}
                <div className="space-y-2">
                  <Label>{t('Unit')}</Label>
                  <div className="flex space-x-2">
                    <Button type="button" variant={adjustUnit === 'OZ' ? 'default' : 'outline'} className="w-full" onClick={() => setAdjustUnit('OZ')} disabled={loading}>{t('oz')}</Button>
                    <Button type="button" variant={adjustUnit === 'ML' ? 'default' : 'outline'} className="w-full" onClick={() => setAdjustUnit('ML')} disabled={loading}>{t('ml')}</Button>
                  </div>
                </div>

                {/* Amount */}
                <div className="space-y-2">
                  <Label>{t('Amount')}</Label>
                  <div className="flex items-center">
                    <Button type="button" variant="outline" size="icon" onClick={decrementAdjustAmount} disabled={loading} className="bg-gradient-to-r from-teal-600 to-emerald-600 border-0 rounded-full h-10 w-10 flex items-center justify-center shadow-lg">
                      <Minus className="h-4 w-4 text-white" />
                    </Button>
                    <div className="flex mx-2">
                      <Input type="text" inputMode="decimal" placeholder={t("0.0")} value={adjustAmount} onChange={(e) => { if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) setAdjustAmount(e.target.value); }} className="rounded-r-none text-center text-lg w-24" />
                      <div className="inline-flex items-center px-3 bg-gray-200 border border-l-0 border-gray-300 rounded-r-md amount-unit">{adjustUnit}</div>
                    </div>
                    <Button type="button" variant="outline" size="icon" onClick={incrementAdjustAmount} disabled={loading} className="bg-gradient-to-r from-teal-600 to-emerald-600 border-0 rounded-full h-10 w-10 flex items-center justify-center shadow-lg">
                      <Plus className="h-4 w-4 text-white" />
                    </Button>
                  </div>
                </div>

                {/* Reason */}
                <div className="space-y-2">
                  <Label>{t('Reason')}</Label>
                  <div className="flex flex-wrap gap-2">
                    {adjustReasons.map((reason) => (
                      <Button key={reason} type="button" variant={adjustReason === reason ? 'default' : 'outline'} className="flex-1 min-w-[80px]" onClick={() => setAdjustReason(reason)} disabled={loading}>
                        {t(reason)}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label>{t('Notes')}</Label>
                  <Textarea placeholder={t("Enter any notes")} value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)} rows={3} disabled={loading} />
                </div>
              </div>
            </form>
          ) : (
            /* Pump Session Form */
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Start Time Input */}
                <div className="space-y-2">
                  <Label htmlFor="startTime">{t('Start Time')}</Label>
                  <DateTimePicker value={selectedStartDateTime} onChange={handleStartDateTimeChange} disabled={loading} placeholder={t("Select start time...")} />
                </div>

                {/* End Time Input */}
                <div className="space-y-2">
                  <Label htmlFor="endTime">{t('End Time')}</Label>
                  <DateTimePicker value={selectedEndDateTime} onChange={handleEndDateTimeChange} disabled={loading} placeholder={t("Select end time...")} />
                </div>

                {/* Unit Selection */}
                <div className="space-y-2">
                  <Label htmlFor="unitAbbr">{t('Unit')}</Label>
                  <div className="flex space-x-2">
                    <Button type="button" variant={formData.unitAbbr === 'OZ' ? 'default' : 'outline'} className="w-full unit-button" onClick={() => setFormData(prev => ({ ...prev, unitAbbr: 'OZ' }))} disabled={loading}>{t('oz')}</Button>
                    <Button type="button" variant={formData.unitAbbr === 'ML' ? 'default' : 'outline'} className="w-full unit-button" onClick={() => setFormData(prev => ({ ...prev, unitAbbr: 'ML' }))} disabled={loading}>{t('ml')}</Button>
                  </div>
                </div>

                {/* Left Amount Input */}
                <div className="space-y-2">
                  <Label htmlFor="leftAmount">{t('Left Amount')}</Label>
                  <div className="flex items-center">
                    <Button type="button" variant="outline" size="icon" onClick={() => decrementAmount('leftAmount')} disabled={loading} className="bg-gradient-to-r from-teal-600 to-emerald-600 border-0 rounded-full h-10 w-10 flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5 decrement-button">
                      <Minus className="h-4 w-4 text-white" />
                    </Button>
                    <div className="flex mx-2">
                      <Input id="leftAmount" name="leftAmount" type="text" inputMode="decimal" placeholder={t("0.0")} value={formData.leftAmount} onChange={handleInputChange} className="rounded-r-none text-center text-lg w-24" />
                      <div className="inline-flex items-center px-3 bg-gray-200 border border-l-0 border-gray-300 rounded-r-md amount-unit">{formData.unitAbbr}</div>
                    </div>
                    <Button type="button" variant="outline" size="icon" onClick={() => incrementAmount('leftAmount')} disabled={loading} className="bg-gradient-to-r from-teal-600 to-emerald-600 border-0 rounded-full h-10 w-10 flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5 increment-button">
                      <Plus className="h-4 w-4 text-white" />
                    </Button>
                  </div>
                </div>

                {/* Right Amount Input */}
                <div className="space-y-2">
                  <Label htmlFor="rightAmount">{t('Right Amount')}</Label>
                  <div className="flex items-center">
                    <Button type="button" variant="outline" size="icon" onClick={() => decrementAmount('rightAmount')} disabled={loading} className="bg-gradient-to-r from-teal-600 to-emerald-600 border-0 rounded-full h-10 w-10 flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5 decrement-button">
                      <Minus className="h-4 w-4 text-white" />
                    </Button>
                    <div className="flex mx-2">
                      <Input id="rightAmount" name="rightAmount" type="text" inputMode="decimal" placeholder={t("0.0")} value={formData.rightAmount} onChange={handleInputChange} className="rounded-r-none text-center text-lg w-24" />
                      <div className="inline-flex items-center px-3 bg-gray-200 border border-l-0 border-gray-300 rounded-r-md amount-unit">{formData.unitAbbr}</div>
                    </div>
                    <Button type="button" variant="outline" size="icon" onClick={() => incrementAmount('rightAmount')} disabled={loading} className="bg-gradient-to-r from-teal-600 to-emerald-600 border-0 rounded-full h-10 w-10 flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5 increment-button">
                      <Plus className="h-4 w-4 text-white" />
                    </Button>
                  </div>
                </div>

                {/* Total Amount */}
                <div className="space-y-2">
                  <Label htmlFor="totalAmount">{t('Total Amount')}</Label>
                  <div className="flex">
                    <Input id="totalAmount" name="totalAmount" type="text" inputMode="decimal" placeholder={t("0.0")} value={formData.totalAmount} onChange={handleInputChange} className="rounded-r-none text-lg" />
                    <div className="inline-flex items-center px-3 bg-gray-200 border border-l-0 border-gray-300 rounded-r-md amount-unit">{formData.unitAbbr}</div>
                  </div>
                </div>

                {/* Pump Action Radio Buttons - only show when breast milk tracking is enabled */}
                {breastMilkTrackingEnabled && (
                <div className="space-y-2">
                  <Label>{t('Action')}</Label>
                  <div className="flex space-x-2">
                    <Button type="button" variant={pumpAction === 'STORED' ? 'default' : 'outline'} className="flex-1" onClick={() => setPumpAction('STORED')} disabled={loading}>
                      {t('Stored')}
                    </Button>
                    <Button type="button" variant={pumpAction === 'FED' ? 'default' : 'outline'} className="flex-1" onClick={() => setPumpAction('FED')} disabled={loading}>
                      {t('Fed')}
                    </Button>
                    <Button type="button" variant={pumpAction === 'DISCARDED' ? 'default' : 'outline'} className="flex-1" onClick={() => setPumpAction('DISCARDED')} disabled={loading}>
                      {t('Discarded')}
                    </Button>
                  </div>
                </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">{t('Notes')}</Label>
                  <Textarea id="notes" name="notes" placeholder={t("Enter any notes about the pumping session")} value={formData.notes} onChange={handleInputChange} rows={3} />
                </div>
              </div>
            </form>
          )}
        </FormPageContent>

        <FormPageFooter>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              {t('Cancel')}
            </Button>
            <Button
              onClick={isAdjustMode ? handleAdjustmentSubmit : handleSubmit}
              disabled={loading}
            >
              {loading ? t('Saving...') : ((activity || adjustmentActivity) ? t('Update') : t('Save'))}
            </Button>
          </div>
        </FormPageFooter>
    </FormPage>
  );
}
