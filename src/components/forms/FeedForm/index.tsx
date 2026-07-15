'use client';

import React, { useState, useEffect, useRef, useCallback, useId } from 'react';
import { FeedType, BreastSide } from '@prisma/client';
import { FeedLogResponse, ActiveBreastFeedResponse } from '@/app/api/types';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { DateTimePicker } from '@/src/components/ui/date-time-picker';
import {
  FormPage, 
  FormPageContent, 
  FormPageFooter 
} from '@/src/components/ui/form-page';
import { Check, ArrowLeftRight, Pause, Play, TriangleAlert } from 'lucide-react';
import { Textarea } from '@/src/components/ui/textarea';
import { Switch } from '@/src/components/ui/switch';
import { useTimezone } from '@/app/context/timezone';
import { useTheme } from '@/src/context/theme';
import { useToast } from '@/src/components/ui/toast';
import { handleExpirationError } from '@/src/lib/expiration-error-handler';
import { newFeedSessionId } from '@/src/utils/feedSessionUtils';
import { PhotoAttachments } from '@/src/components/ui/photo-attachments';
import { uploadPhotos, linkPhoto, unlinkPhoto, fetchPhotos, fetchPhotosEnabled } from '@/src/utils/photoClientApi';
import { cacheDefaultBottleUnit, readCachedDefaultBottleUnit } from '@/src/utils/defaultBottleUnit';
import './feed-form.css';

// Import subcomponents
import BreastFeedForm from './BreastFeedForm';
import LinkedFeedsSection from './LinkedFeedsSection';
import BottleFeedForm from './BottleFeedForm';
import SolidsFeedForm from './SolidsFeedForm';
import { useLocalization } from '@/src/context/localization';

interface FeedFormProps {
  isOpen: boolean;
  onClose: () => void;
  babyId: string | undefined;
  initialTime: string;
  activity?: FeedLogResponse;
  onSuccess?: () => void;
  isFeeding?: boolean;
  activeFeedData?: ActiveBreastFeedResponse | null;
  onFeedToggle?: () => void;
  onSwitch?: () => void;
  onPause?: () => void;
  onResume?: (side: 'LEFT' | 'RIGHT') => void;
  onSwap?: () => void;
}

export default function FeedForm({
  isOpen,
  onClose,
  babyId,
  initialTime,
  activity,
  onSuccess,
  isFeeding = false,
  activeFeedData,
  onFeedToggle,
  onSwitch,
  onPause,
  onResume,
  onSwap,
}: FeedFormProps) {
  const { t } = useLocalization();
  const formId = useId();
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
    unit: readCachedDefaultBottleUnit() as string,
    side: '' as BreastSide | '',
    food: '',
    notes: '',
    hadReaction: false,
    reactionDescription: '',
    bottleType: '',
    breastMilkAmount: '',
    formulaAmount: '',
    feedDuration: 0, // Duration in seconds for breastfeeding timer
    leftDuration: 0, // Duration in seconds for left breast
    rightDuration: 0, // Duration in seconds for right breast
    activeBreast: '' as 'LEFT' | 'RIGHT' | '', // Currently active breast for timer
  });
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializedTime, setInitializedTime] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string>('');
  const [defaultSettings, setDefaultSettings] = useState({
    defaultBottleUnit: readCachedDefaultBottleUnit() as string,
    defaultSolidsUnit: 'TBSP',
  });

  // Editing state for session duration inputs (null = not editing, use formatted value)
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [manualEntry, setManualEntry] = useState(false);

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
          .filter((p) => p.links.some((l) => l.activityType === 'feed' && l.activityId === activity.id))
          .map((p) => ({ id: p.id, caption: p.caption }))
      ))
      .catch(() => {});
  }, [isOpen, activity?.id, photosEnabled]);

  // Whether the current mode ends in a call to handleSubmit (vs. Start/End Feed's own API calls)
  const endsInSubmit = !(isFeeding && activeFeedData && !activity) &&
    !(formData.type === 'BREAST' && !isFeeding && !activity && !manualEntry);
  const showPhotosSection = photosEnabled && endsInSubmit;
  // Reaction toggle applies to all feed types once one is selected
  const showReactionSection = !!formData.type && endsInSubmit;

  // Live timer for active breastfeed session
  const [liveElapsed, setLiveElapsed] = useState(0);

  const calculateLiveElapsed = useCallback(() => {
    if (!activeFeedData || activeFeedData.isPaused || !activeFeedData.currentSideStartTime) {
      return 0;
    }
    return Math.floor((Date.now() - new Date(activeFeedData.currentSideStartTime).getTime()) / 1000);
  }, [activeFeedData]);

  useEffect(() => {
    if (!isFeeding || !activeFeedData || activeFeedData.isPaused) {
      setLiveElapsed(0);
      return;
    }
    setLiveElapsed(calculateLiveElapsed());
    const interval = setInterval(() => {
      setLiveElapsed(calculateLiveElapsed());
    }, 1000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setLiveElapsed(calculateLiveElapsed());
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isFeeding, activeFeedData, calculateLiveElapsed]);

  // Compute live durations from activeFeedData + elapsed
  const liveLeftDuration = activeFeedData
    ? activeFeedData.leftDuration + (activeFeedData.activeSide === 'LEFT' && !activeFeedData.isPaused ? liveElapsed : 0)
    : formData.leftDuration;
  const liveRightDuration = activeFeedData
    ? activeFeedData.rightDuration + (activeFeedData.activeSide === 'RIGHT' && !activeFeedData.isPaused ? liveElapsed : 0)
    : formData.rightDuration;

  // Sync live durations to formData for submission
  useEffect(() => {
    if (isFeeding && activeFeedData) {
      setFormData(prev => ({
        ...prev,
        leftDuration: liveLeftDuration,
        rightDuration: liveRightDuration,
        feedDuration: liveLeftDuration + liveRightDuration,
      }));
    }
  }, [liveLeftDuration, liveRightDuration, isFeeding, activeFeedData]);

  const formatDuration = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

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
        const lastBottleType = data.data.bottleType || '';
        const lastBmAmount = data.data.breastMilkAmount;
        setFormData(prev => ({
          ...prev,
          amount: data.data.amount.toString(),
          unit: data.data.unitAbbr || prev.unit,
          ...(lastBottleType === 'Formula\\Breast' && lastBmAmount != null ? {
            breastMilkAmount: lastBmAmount.toString(),
            formulaAmount: (data.data.amount - lastBmAmount).toString(),
          } : {}),
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
        cache: 'no-store',
        headers: {
          'Authorization': authToken ? `Bearer ${authToken}` : '',
        },
      });
      if (!response.ok) return;
      
      const data = await response.json();
      if (data.success && data.data) {
        const defaultBottleUnit = cacheDefaultBottleUnit(data.data.defaultBottleUnit) || 'OZ';
        setDefaultSettings({
          defaultBottleUnit,
          defaultSolidsUnit: data.data.defaultSolidsUnit || 'TBSP',
        });
        
        // Set the default unit from settings (new entries only — when editing
        // an existing activity its stored unit must be preserved).
        if (!activity) {
          setFormData(prev => ({
            ...prev,
            unit: defaultBottleUnit
          }));
        }
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
      // For breast feeds, use startTime (session start) instead of time (session end)
      const displayTimeStr = activity.type === 'BREAST' && activity.startTime
        ? activity.startTime
        : activity.time;
      try {
        const activityDate = new Date(displayTimeStr);
        // Check if the date is valid
        if (!isNaN(activityDate.getTime())) {
          setSelectedDateTime(activityDate);
        }
      } catch (error) {
        console.error('Error parsing activity time:', error);
      }

      // Format the date for the time property
      const date = new Date(displayTimeStr);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const formattedTime = `${year}-${month}-${day}T${hours}:${minutes}`;
      
      const activityBottleType = (activity as any).bottleType || '';
      const activityBmAmount = (activity as any).breastMilkAmount;
      setFormData({
        time: formattedTime, // Add the time property
        type: activity.type,
        amount: activity.amount?.toString() || '',
        unit: activity.unitAbbr ||
          (activity.type === 'BOTTLE' ? defaultSettings.defaultBottleUnit :
           activity.type === 'SOLIDS' ? defaultSettings.defaultSolidsUnit : ''),
        side: activity.side || '',
        food: activity.food || '',
        notes: (activity as any).notes || '',
        hadReaction: (activity as any).hadReaction === true,
        reactionDescription: (activity as any).reactionDescription || '',
        bottleType: activityBottleType,
        breastMilkAmount: activityBottleType === 'Formula\\Breast' && activityBmAmount != null
          ? activityBmAmount.toString() : '',
        formulaAmount: activityBottleType === 'Formula\\Breast' && activityBmAmount != null && activity.amount != null
          ? (activity.amount - activityBmAmount).toString() : '',
        feedDuration: feedDuration,
        leftDuration: activity.side === 'LEFT' ? feedDuration : 0,
        rightDuration: activity.side === 'RIGHT' ? feedDuration : 0,
        activeBreast: ''
      });
      } else if (isFeeding && activeFeedData) {
        // End Feed mode - populate with active breastfeed data
        const now = new Date();

        // Calculate current elapsed time on active side
        let currentElapsed = 0;
        if (activeFeedData.currentSideStartTime && !activeFeedData.isPaused) {
          currentElapsed = Math.floor((now.getTime() - new Date(activeFeedData.currentSideStartTime).getTime()) / 1000);
        }

        const leftDur = activeFeedData.leftDuration + (activeFeedData.activeSide === 'LEFT' ? currentElapsed : 0);
        const rightDur = activeFeedData.rightDuration + (activeFeedData.activeSide === 'RIGHT' ? currentElapsed : 0);

        setSelectedDateTime(now);
        setFormData(prev => ({
          ...prev,
          type: 'BREAST',
          side: activeFeedData.activeSide,
          leftDuration: leftDur,
          rightDuration: rightDur,
          feedDuration: leftDur + rightDur,
        }));
      } else {
        // New entry mode - initialize from initialTime prop
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

        // Store the initial time used for new entry
        setInitializedTime(initialTime);

        // Fetch the last feed type to pre-populate the form
        fetchLastFeedType();
      }
      
      // Mark as initialized
      setIsInitialized(true);
    } else if (!isOpen) {
      // Reset initialization flag and stored time when form closes
      setIsInitialized(false);
      setInitializedTime(null);
      setPendingPhotoFiles([]);
      setAttachedPhotos([]);
      setRemovedPhotoIds([]);
    }
  }, [isOpen, activity, initialTime]);

  useEffect(() => {
    if (formData.type === 'BOTTLE' || formData.type === 'SOLIDS') {
      if (!activity) {
        fetchLastAmount(formData.type);

        if (formData.type === 'BOTTLE') {
          setFormData(prev => ({ ...prev, unit: defaultSettings.defaultBottleUnit }));
        } else if (formData.type === 'SOLIDS') {
          setFormData(prev => ({ ...prev, unit: defaultSettings.defaultSolidsUnit }));
        }
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

  const handleBreastMilkAmountChange = (newAmount: string) => {
    if (newAmount === '' || /^\d*\.?\d*$/.test(newAmount)) {
      setFormData(prev => ({ ...prev, breastMilkAmount: newAmount }));
    }
  };

  const handleFormulaAmountChange = (newAmount: string) => {
    if (newAmount === '' || /^\d*\.?\d*$/.test(newAmount)) {
      setFormData(prev => ({ ...prev, formulaAmount: newAmount }));
    }
  };

  const incrementBreastMilkAmount = () => {
    const current = parseFloat(formData.breastMilkAmount || '0');
    const step = formData.unit === 'ML' ? 5 : 0.5;
    setFormData(prev => ({ ...prev, breastMilkAmount: (current + step).toFixed(formData.unit === 'ML' ? 0 : 1) }));
  };

  const decrementBreastMilkAmount = () => {
    const current = parseFloat(formData.breastMilkAmount || '0');
    const step = formData.unit === 'ML' ? 5 : 0.5;
    if (current >= step) {
      setFormData(prev => ({ ...prev, breastMilkAmount: (current - step).toFixed(formData.unit === 'ML' ? 0 : 1) }));
    }
  };

  const incrementFormulaAmount = () => {
    const current = parseFloat(formData.formulaAmount || '0');
    const step = formData.unit === 'ML' ? 5 : 0.5;
    setFormData(prev => ({ ...prev, formulaAmount: (current + step).toFixed(formData.unit === 'ML' ? 0 : 1) }));
  };

  const decrementFormulaAmount = () => {
    const current = parseFloat(formData.formulaAmount || '0');
    const step = formData.unit === 'ML' ? 5 : 0.5;
    if (current >= step) {
      setFormData(prev => ({ ...prev, formulaAmount: (current - step).toFixed(formData.unit === 'ML' ? 0 : 1) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!babyId) return;

    // Clear any previous validation errors
    setValidationError('');

    // Validate required fields
    if (!formData.type) {
      setValidationError(t('Please select a feeding type'));
      return;
    }
    
    // Validate date time
    if (!selectedDateTime || isNaN(selectedDateTime.getTime())) {
      setValidationError(t('Please select a valid date and time'));
      return;
    }

    // Get accurate durations from BreastFeedForm before validation and stopping timer
    // This ensures we capture the correct elapsed time even if app was backgrounded
    let accurateLeftDuration = formData.leftDuration;
    let accurateRightDuration = formData.rightDuration;

    if (formData.type === 'BREAST' && getCurrentDurationsRef.current) {
      const durations = getCurrentDurationsRef.current();
      accurateLeftDuration = durations.left;
      accurateRightDuration = durations.right;

      // Update formData with accurate durations
      setFormData(prev => ({
        ...prev,
        leftDuration: accurateLeftDuration,
        rightDuration: accurateRightDuration
      }));
    }

    // For breast feeding, at least one side must have a duration
    if (formData.type === 'BREAST' && accurateLeftDuration === 0 && accurateRightDuration === 0) {
      setValidationError(t('Please enter a duration for at least one breast side'));
      return;
    }

    // For bottle feeding, validate amount
    if (formData.type === 'BOTTLE') {
      if (formData.bottleType === 'Formula\\Breast') {
        const bmAmt = parseFloat(formData.breastMilkAmount || '0');
        const fAmt = parseFloat(formData.formulaAmount || '0');
        if (bmAmt <= 0 || fAmt <= 0) {
          setValidationError(t('Please enter valid amounts for both breast milk and formula'));
          return;
        }
      } else if (!formData.amount || parseFloat(formData.amount) <= 0) {
        setValidationError(t('Please enter a valid amount for bottle feeding'));
        return;
      }
    }

    // For solids feeding, validate amount
    if (formData.type === 'SOLIDS' && (!formData.amount || parseFloat(formData.amount) <= 0)) {
      setValidationError(t('Please enter a valid amount for solids feeding'));
      return;
    }

    // Stop timer if it's running
    if (isTimerRunning) {
      stopTimer();
    }

    setLoading(true);

    try {
      let savedActivityId: string | undefined = activity?.id;

      if (formData.type === 'BREAST' && !activity) {
        // For new breast feeding entries, create entries for both sides if they have durations
        // Use accurate durations captured above
        if (accurateLeftDuration > 0 && accurateRightDuration > 0) {
          // Create entries for both sides
          savedActivityId = await createBreastFeedingEntries(accurateLeftDuration, accurateRightDuration);
        } else if (accurateLeftDuration > 0) {
          // Create only left side entry
          savedActivityId = await createSingleFeedEntry('LEFT', accurateLeftDuration);
        } else if (accurateRightDuration > 0) {
          // Create only right side entry
          savedActivityId = await createSingleFeedEntry('RIGHT', accurateRightDuration);
        }
      } else {
        // For editing or non-breast feeding entries, use the single entry method
        savedActivityId = await createSingleFeedEntry(formData.side as BreastSide);
      }

      if (photosEnabled && savedActivityId) {
        try {
          for (const photoId of removedPhotoIds) {
            await unlinkPhoto(photoId, 'feed', savedActivityId);
          }
          if (pendingPhotoFiles.length > 0) {
            const result = await uploadPhotos(pendingPhotoFiles, { babyId });
            for (const photo of result.photos) {
              await linkPhoto(photo.id, 'feed', savedActivityId);
            }
          }
        } catch (photoError) {
          console.error('Photo attachment failed:', photoError);
          showToast({
            variant: 'warning',
            title: t('Warning'),
            message: t('Feeding saved, but one or more photos failed to attach.'),
            duration: 5000,
          });
        }
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
        notes: '',
        hadReaction: false,
        reactionDescription: '',
        bottleType: '',
        breastMilkAmount: '',
        formulaAmount: '',
        feedDuration: 0,
        leftDuration: 0,
        rightDuration: 0,
        activeBreast: ''
      });
      setPendingPhotoFiles([]);
      setAttachedPhotos([]);
      setRemovedPhotoIds([]);
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
  const createBreastFeedingEntries = async (leftDur?: number, rightDur?: number) => {
    const leftDuration = leftDur ?? formData.leftDuration;
    const rightDuration = rightDur ?? formData.rightDuration;

    // When both sides are logged together they are one nursing session
    const sessionId = leftDuration > 0 && rightDuration > 0 ? newFeedSessionId() : undefined;

    let lastId: string | undefined;

    // Create left side entry
    if (leftDuration > 0) {
      lastId = await createSingleFeedEntry('LEFT', leftDuration, sessionId);
    }

    // Create right side entry
    if (rightDuration > 0) {
      lastId = await createSingleFeedEntry('RIGHT', rightDuration, sessionId);
    }

    return lastId;
  };

  // Helper function to create a single feed entry
  const createSingleFeedEntry = async (breastSide?: BreastSide, durationOverride?: number, sessionId?: string) => {
    // For breast feeding, use the provided side or the form data side
    const side = formData.type === 'BREAST' ? (breastSide || formData.side) : undefined;

    // Calculate start and end times for breastfeeding based on feedDuration
    let startTime, endTime, duration;
    if (formData.type === 'BREAST') {
      // Use the override duration if provided, otherwise use the appropriate duration based on the side
      duration = durationOverride ?? (side === 'LEFT' ? formData.leftDuration :
                 side === 'RIGHT' ? formData.rightDuration :
                 formData.feedDuration);
      
      if (duration > 0) {
        if (activity) {
          // Editing: selectedDateTime is the start time (set during form init)
          startTime = new Date(selectedDateTime);
          endTime = new Date(selectedDateTime.getTime() + duration * 1000);
        } else {
          // New entry: selectedDateTime is the end time (current time)
          endTime = new Date(selectedDateTime);
          startTime = new Date(selectedDateTime.getTime() - duration * 1000);
        }
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
        ...(sessionId && { sessionId }),
        feedDuration: duration
      }),
      ...((formData.type === 'BOTTLE' || formData.type === 'SOLIDS') && {
        amount: formData.type === 'BOTTLE' && formData.bottleType === 'Formula\\Breast'
          ? parseFloat(formData.breastMilkAmount || '0') + parseFloat(formData.formulaAmount || '0')
          : parseFloat(formData.amount),
        unitAbbr: formData.unit,
      }),
      ...(formData.type === 'BOTTLE' && formData.bottleType === 'Formula\\Breast' && {
        breastMilkAmount: parseFloat(formData.breastMilkAmount || '0'),
      }),
      ...(formData.type === 'SOLIDS' && formData.food && { food: formData.food }),
      ...(formData.type === 'BOTTLE' && formData.bottleType && { bottleType: formData.bottleType }),
      ...(formData.notes && { notes: formData.notes }),
      // Always sent so editing can clear a previously flagged reaction
      hadReaction: formData.hadReaction,
      reactionDescription: formData.hadReaction ? formData.reactionDescription : '',
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
            title: t('Error'),
            message: errorData.error || t('Failed to save feed log'),
            duration: 5000,
          });
          throw new Error(errorData.error || t('Failed to save feed log'));
        }
      }
      
      // Handle other errors
      const errorData = await response.json();
      showToast({
        variant: 'error',
        title: t('Error'),
        message: errorData.error || t('Failed to save feed log'),
        duration: 5000,
      });
      throw new Error(errorData.error || t('Failed to save feed log'));
    }

    const savedFeedLog = await response.json();
    return (activity?.id || savedFeedLog.data?.id) as string | undefined;
  };

  // This section is now handled in the createSingleFeedEntry and createBreastFeedingEntries functions

  // Timer functionality
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Ref to get current accurate durations from BreastFeedForm
  const getCurrentDurationsRef = useRef<(() => { left: number; right: number }) | null>(null);
  
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
      notes: '',
      hadReaction: false,
      reactionDescription: '',
      bottleType: '',
      breastMilkAmount: '',
      formulaAmount: '',
      feedDuration: 0,
      leftDuration: 0,
      rightDuration: 0,
      activeBreast: ''
    });

    // Reset initialization flag
    setIsInitialized(false);
    setManualEntry(false);
    setPendingPhotoFiles([]);
    setAttachedPhotos([]);
    setRemovedPhotoIds([]);

    // Call the original onClose
    onClose();
  };

  // Start a persistent breastfeed session via API
  const handleStartBreastfeed = async (side: 'LEFT' | 'RIGHT') => {
    if (!babyId) return;
    setLoading(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch('/api/active-breastfeed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : '',
        },
        body: JSON.stringify({ babyId, side }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast({ variant: 'error', title: t('Error'), message: errorData.error || t('Failed to start breastfeed'), duration: 5000 });
        return;
      }

      handleClose();
      onFeedToggle?.();
    } catch (error) {
      console.error('Error starting breastfeed:', error);
    } finally {
      setLoading(false);
    }
  };

  // End a persistent breastfeed session via API
  const handleEndBreastfeed = async () => {
    if (!activeFeedData) return;
    setLoading(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`/api/active-breastfeed?id=${activeFeedData.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : '',
        },
        body: JSON.stringify({
          leftDuration: formData.leftDuration,
          rightDuration: formData.rightDuration,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast({ variant: 'error', title: t('Error'), message: errorData.error || t('Failed to end breastfeed'), duration: 5000 });
        return;
      }

      handleClose();
      onFeedToggle?.();
      onSuccess?.();
    } catch (error) {
      console.error('Error ending breastfeed:', error);
    } finally {
      setLoading(false);
    }
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
      title={activity ? t('Edit Feeding') : (isFeeding ? t('End Breastfeed') : t('Log Feeding'))}
      description={activity ? t('Update what and when your baby ate') : (isFeeding ? t('Review and end the breastfeeding session') : t('Record what and when your baby ate'))}
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
            <div role="group" aria-labelledby={`${formId}-time-label`}>
              <label id={`${formId}-time-label`} className="form-label">{t('Time')}</label>
              <DateTimePicker
                value={selectedDateTime}
                onChange={handleDateTimeChange}
                disabled={loading}
                placeholder={t("Select feeding time...")}
              />
            </div>
            
            {/* Feed Type Selection - Full width on all screens */}
            <div>
              <label id={`${formId}-type-label`} className="form-label">{t('Type')}</label>
              <div className="flex justify-between items-center gap-3 mt-2" role="group" aria-labelledby={`${formId}-type-label`}>
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
                    <span className="text-xs font-medium mt-1">{t('Breast')}</span>
                    {formData.type === 'BREAST' && (
                      <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-1">
                        <Check className="h-3 w-3 text-white" aria-hidden="true" />
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
                    <span className="text-xs font-medium mt-1">{t('Bottle')}</span>
                    {formData.type === 'BOTTLE' && (
                      <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-1">
                        <Check className="h-3 w-3 text-white" aria-hidden="true" />
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
                    <span className="text-xs font-medium mt-1">{t('Solids')}</span>
                    {formData.type === 'SOLIDS' && (
                      <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-1">
                        <Check className="h-3 w-3 text-white" aria-hidden="true" />
                      </div>
                    )}
                  </button>
                </div>
              </div>
            
            {formData.type === 'BREAST' && isFeeding && activeFeedData && !activity && (
              /* End Feed mode - live timer with switch/pause controls */
              <div className="space-y-4">
                <div className="border rounded-lg p-4 active-breast-session">
                  <h3 className="text-sm font-medium mb-3 active-breast-session-title">{t('Active Breastfeed Session')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className={`text-center p-3 rounded-lg ${activeFeedData.activeSide === 'LEFT' && !activeFeedData.isPaused ? 'timer-active-side border-2' : ''}`}>
                      <label htmlFor={activeFeedData.isPaused ? `${formId}-session-left-min` : undefined} className="form-label text-xs">{t('Left')}</label>
                      {activeFeedData.isPaused ? (
                        <div className="flex items-center justify-center gap-1 mt-1">
                          <Input
                            id={`${formId}-session-left-min`}
                            aria-label={t('Left minutes')}
                            type="text"
                            inputMode="numeric"
                            className="w-12 text-center px-1 session-duration-input"
                            value={editingField === 'leftMin' ? editingValue : Math.floor(formData.leftDuration / 60).toString().padStart(2, '0')}
                            onFocus={() => {
                              setEditingField('leftMin');
                              setEditingValue('');
                            }}
                            onChange={(e) => setEditingValue(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                            onBlur={() => {
                              const mins = parseInt(editingValue) || 0;
                              const secs = formData.leftDuration % 60;
                              setFormData(prev => ({ ...prev, leftDuration: (mins * 60) + secs }));
                              setEditingField(null);
                            }}
                            disabled={loading}
                          />
                          <span className="text-lg font-mono active-breast-session-title">:</span>
                          <Input
                            aria-label={t('Left seconds')}
                            type="text"
                            inputMode="numeric"
                            className="w-12 text-center px-1 session-duration-input"
                            value={editingField === 'leftSec' ? editingValue : (formData.leftDuration % 60).toString().padStart(2, '0')}
                            onFocus={() => {
                              setEditingField('leftSec');
                              setEditingValue('');
                            }}
                            onChange={(e) => setEditingValue(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                            onBlur={() => {
                              const secs = Math.min(parseInt(editingValue) || 0, 59);
                              const mins = Math.floor(formData.leftDuration / 60);
                              setFormData(prev => ({ ...prev, leftDuration: (mins * 60) + secs }));
                              setEditingField(null);
                            }}
                            disabled={loading}
                          />
                        </div>
                      ) : (
                        <div className="text-2xl font-mono font-bold mt-1 active-breast-session-title">
                          {formatDuration(liveLeftDuration)}
                        </div>
                      )}
                    </div>
                    <div className={`text-center p-3 rounded-lg ${activeFeedData.activeSide === 'RIGHT' && !activeFeedData.isPaused ? 'timer-active-side border-2' : ''}`}>
                      <label htmlFor={activeFeedData.isPaused ? `${formId}-session-right-min` : undefined} className="form-label text-xs">{t('Right')}</label>
                      {activeFeedData.isPaused ? (
                        <div className="flex items-center justify-center gap-1 mt-1">
                          <Input
                            id={`${formId}-session-right-min`}
                            aria-label={t('Right minutes')}
                            type="text"
                            inputMode="numeric"
                            className="w-12 text-center px-1 session-duration-input"
                            value={editingField === 'rightMin' ? editingValue : Math.floor(formData.rightDuration / 60).toString().padStart(2, '0')}
                            onFocus={() => {
                              setEditingField('rightMin');
                              setEditingValue('');
                            }}
                            onChange={(e) => setEditingValue(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                            onBlur={() => {
                              const mins = parseInt(editingValue) || 0;
                              const secs = formData.rightDuration % 60;
                              setFormData(prev => ({ ...prev, rightDuration: (mins * 60) + secs }));
                              setEditingField(null);
                            }}
                            disabled={loading}
                          />
                          <span className="text-lg font-mono active-breast-session-title">:</span>
                          <Input
                            aria-label={t('Right seconds')}
                            type="text"
                            inputMode="numeric"
                            className="w-12 text-center px-1 session-duration-input"
                            value={editingField === 'rightSec' ? editingValue : (formData.rightDuration % 60).toString().padStart(2, '0')}
                            onFocus={() => {
                              setEditingField('rightSec');
                              setEditingValue('');
                            }}
                            onChange={(e) => setEditingValue(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                            onBlur={() => {
                              const secs = Math.min(parseInt(editingValue) || 0, 59);
                              const mins = Math.floor(formData.rightDuration / 60);
                              setFormData(prev => ({ ...prev, rightDuration: (mins * 60) + secs }));
                              setEditingField(null);
                            }}
                            disabled={loading}
                          />
                        </div>
                      ) : (
                        <div className="text-2xl font-mono font-bold mt-1 active-breast-session-title">
                          {formatDuration(liveRightDuration)}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Control buttons */}
                  <div className="flex justify-center gap-3 mt-4">
                    {!activeFeedData.isPaused ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={onSwitch}
                          title={t('Switch Side')}
                        >
                          <ArrowLeftRight className="h-5 w-5" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={onPause}
                          title={t('Pause Feed')}
                        >
                          <Pause className="h-5 w-5" aria-hidden="true" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onResume?.('LEFT')}
                          title={t('Resume Left')}
                        >
                          <Play className="h-4 w-4 mr-0.5" aria-hidden="true" />
                          <span className="text-xs font-semibold">L</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onResume?.('RIGHT')}
                          title={t('Resume Right')}
                        >
                          <Play className="h-4 w-4 mr-0.5" aria-hidden="true" />
                          <span className="text-xs font-semibold">R</span>
                        </Button>
                      </>
                    )}
                  </div>
                  {onSwap && (
                    <div className="flex justify-center mt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onSwap}
                        title={t('Reassign the time recorded so far to the other side')}
                      >
                        {t('Started on the wrong side? Fix it')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {formData.type === 'BREAST' && !isFeeding && !activity && !manualEntry && (
              /* Start Feed mode - side selector + start button */
              <div className="space-y-4">
                <label id={`${formId}-side-label`} className="form-label">{t('Select Side to Start')}</label>
                <div className="flex gap-4 justify-center" role="group" aria-labelledby={`${formId}-side-label`}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleStartBreastfeed('LEFT')}
                    disabled={loading}
                    className="flex-1 h-16 text-lg font-semibold"
                  >
                    {t('Left Side')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleStartBreastfeed('RIGHT')}
                    disabled={loading}
                    className="flex-1 h-16 text-lg font-semibold"
                  >
                    {t('Right Side')}
                  </Button>
                </div>
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setManualEntry(true)}
                    disabled={loading}
                  >
                    {t('Manual Entry')}
                  </Button>
                </div>
              </div>
            )}

            {formData.type === 'BREAST' && !isFeeding && !activity && manualEntry && (
              /* Manual entry mode - editable MM:SS inputs for both sides */
              <div className="space-y-4">
                <div className="border rounded-lg p-4 active-breast-session">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium active-breast-session-title">{t('Manual Entry')}</h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setManualEntry(false);
                        setFormData(prev => ({ ...prev, leftDuration: 0, rightDuration: 0 }));
                      }}
                    >
                      {t('Cancel')}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 rounded-lg">
                      <label htmlFor={`${formId}-manual-left-min`} className="form-label text-xs">{t('Left')}</label>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <Input
                          id={`${formId}-manual-left-min`}
                          aria-label={t('Left minutes')}
                          type="text"
                          inputMode="numeric"
                          className="w-12 text-center px-1 session-duration-input"
                          value={editingField === 'leftMin' ? editingValue : Math.floor(formData.leftDuration / 60).toString().padStart(2, '0')}
                          onFocus={() => {
                            setEditingField('leftMin');
                            setEditingValue('');
                          }}
                          onChange={(e) => setEditingValue(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                          onBlur={() => {
                            const mins = parseInt(editingValue) || 0;
                            const secs = formData.leftDuration % 60;
                            setFormData(prev => ({ ...prev, leftDuration: (mins * 60) + secs }));
                            setEditingField(null);
                          }}
                          disabled={loading}
                        />
                        <span className="text-lg font-mono active-breast-session-title">:</span>
                        <Input
                          aria-label={t('Left seconds')}
                          type="text"
                          inputMode="numeric"
                          className="w-12 text-center px-1 session-duration-input"
                          value={editingField === 'leftSec' ? editingValue : (formData.leftDuration % 60).toString().padStart(2, '0')}
                          onFocus={() => {
                            setEditingField('leftSec');
                            setEditingValue('');
                          }}
                          onChange={(e) => setEditingValue(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                          onBlur={() => {
                            const secs = Math.min(parseInt(editingValue) || 0, 59);
                            const mins = Math.floor(formData.leftDuration / 60);
                            setFormData(prev => ({ ...prev, leftDuration: (mins * 60) + secs }));
                            setEditingField(null);
                          }}
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <div className="text-center p-3 rounded-lg">
                      <label htmlFor={`${formId}-manual-right-min`} className="form-label text-xs">{t('Right')}</label>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <Input
                          id={`${formId}-manual-right-min`}
                          aria-label={t('Right minutes')}
                          type="text"
                          inputMode="numeric"
                          className="w-12 text-center px-1 session-duration-input"
                          value={editingField === 'rightMin' ? editingValue : Math.floor(formData.rightDuration / 60).toString().padStart(2, '0')}
                          onFocus={() => {
                            setEditingField('rightMin');
                            setEditingValue('');
                          }}
                          onChange={(e) => setEditingValue(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                          onBlur={() => {
                            const mins = parseInt(editingValue) || 0;
                            const secs = formData.rightDuration % 60;
                            setFormData(prev => ({ ...prev, rightDuration: (mins * 60) + secs }));
                            setEditingField(null);
                          }}
                          disabled={loading}
                        />
                        <span className="text-lg font-mono active-breast-session-title">:</span>
                        <Input
                          aria-label={t('Right seconds')}
                          type="text"
                          inputMode="numeric"
                          className="w-12 text-center px-1 session-duration-input"
                          value={editingField === 'rightSec' ? editingValue : (formData.rightDuration % 60).toString().padStart(2, '0')}
                          onFocus={() => {
                            setEditingField('rightSec');
                            setEditingValue('');
                          }}
                          onChange={(e) => setEditingValue(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                          onBlur={() => {
                            const secs = Math.min(parseInt(editingValue) || 0, 59);
                            const mins = Math.floor(formData.rightDuration / 60);
                            setFormData(prev => ({ ...prev, rightDuration: (mins * 60) + secs }));
                            setEditingField(null);
                          }}
                          disabled={loading}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {formData.type === 'BREAST' && activity && (
              /* Edit existing breast feed record - keep existing timer UI */
              <BreastFeedForm
                side={formData.side}
                leftDuration={formData.leftDuration}
                rightDuration={formData.rightDuration}
                activeBreast={formData.activeBreast}
                isTimerRunning={isTimerRunning}
                loading={loading}
                onSideChange={(side) => setFormData(prev => {
                  if (!side || side === prev.side) return { ...prev, side };
                  // Move the entered duration to the newly selected side
                  const total = prev.leftDuration + prev.rightDuration;
                  return {
                    ...prev,
                    side,
                    leftDuration: side === 'LEFT' ? total : 0,
                    rightDuration: side === 'RIGHT' ? total : 0,
                    feedDuration: total,
                  };
                })}
                onTimerStart={startTimer}
                onTimerStop={stopTimer}
                onDurationChange={(breast, seconds) => {
                  if (breast === 'LEFT') {
                    setFormData(prev => ({ ...prev, leftDuration: seconds }));
                  } else if (breast === 'RIGHT') {
                    setFormData(prev => ({ ...prev, rightDuration: seconds }));
                  }
                }}
                isEditing={true}
                notes={formData.notes}
                onNotesChange={(notes) => setFormData(prev => ({ ...prev, notes }))}
                getCurrentDurations={getCurrentDurationsRef}
              />
            )}

            {formData.type === 'BREAST' && activity && babyId && (
              <LinkedFeedsSection
                activity={activity}
                babyId={babyId}
                disabled={loading}
              />
            )}

            {formData.type === 'BOTTLE' && (
              <BottleFeedForm
                amount={formData.amount}
                unit={formData.unit}
                bottleType={formData.bottleType}
                notes={formData.notes}
                loading={loading}
                onAmountChange={handleAmountChange}
                onUnitChange={(unit) => setFormData(prev => ({ ...prev, unit }))}
                onBottleTypeChange={(bottleType) => setFormData(prev => ({ ...prev, bottleType, breastMilkAmount: '', formulaAmount: '' }))}
                onNotesChange={(notes) => setFormData(prev => ({ ...prev, notes }))}
                onIncrement={incrementAmount}
                onDecrement={decrementAmount}
                breastMilkAmount={formData.breastMilkAmount}
                formulaAmount={formData.formulaAmount}
                onBreastMilkAmountChange={handleBreastMilkAmountChange}
                onFormulaAmountChange={handleFormulaAmountChange}
                onBreastMilkIncrement={incrementBreastMilkAmount}
                onBreastMilkDecrement={decrementBreastMilkAmount}
                onFormulaIncrement={incrementFormulaAmount}
                onFormulaDecrement={decrementFormulaAmount}
              />
            )}
            
            {formData.type === 'SOLIDS' && (
              <SolidsFeedForm
                amount={formData.amount}
                unit={formData.unit}
                food={formData.food}
                notes={formData.notes}
                loading={loading}
                onAmountChange={handleAmountChange}
                onUnitChange={(unit) => setFormData(prev => ({ ...prev, unit }))}
                onFoodChange={(food) => setFormData({ ...formData, food })}
                onNotesChange={(notes) => setFormData(prev => ({ ...prev, notes }))}
                onIncrement={incrementAmount}
                onDecrement={decrementAmount}
              />
            )}

            {showReactionSection && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="form-label !mb-0 flex items-center gap-1.5">
                    <TriangleAlert aria-hidden="true" className="h-4 w-4 text-amber-500" />
                    {t('Reaction occurred')}
                  </label>
                  <Switch
                    checked={formData.hadReaction}
                    onCheckedChange={(hadReaction: boolean) => setFormData(prev => ({ ...prev, hadReaction }))}
                    disabled={loading}
                    aria-label={t('Reaction occurred')}
                  />
                </div>
                {formData.hadReaction && (
                  <div className="mt-2">
                    <label className="form-label" htmlFor={`${formId}-reaction-description`}>{t('Describe the reaction')}</label>
                    <Textarea
                      id={`${formId}-reaction-description`}
                      value={formData.reactionDescription}
                      onChange={(e) => setFormData(prev => ({ ...prev, reactionDescription: e.target.value }))}
                      className="w-full min-h-[60px]"
                      placeholder={t("Redness, swelling, hives...")}
                      disabled={loading}
                    />
                  </div>
                )}
              </div>
            )}

            {showPhotosSection && (
              <div>
                <label className="form-label">{t('Photos')}</label>
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
              onClick={handleClose}
              disabled={loading}
            >
              {t('Cancel')}
            </Button>
            {isFeeding && activeFeedData && !activity ? (
              <Button onClick={handleEndBreastfeed} disabled={loading} className="bg-red-600 hover:bg-red-700">
                {t('End Feed')}
              </Button>
            ) : formData.type === 'BREAST' && !isFeeding && !activity && !manualEntry ? (
              /* Start Feed mode - no save button needed, side buttons handle it */
              null
            ) : (
              <Button onClick={handleSubmit} disabled={loading}>
                {activity ? t('Update') : t('Save')}
              </Button>
            )}
          </div>
        </FormPageFooter>
    </FormPage>
  );
}
