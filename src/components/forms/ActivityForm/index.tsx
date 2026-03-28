'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PlayLogResponse, ActiveActivityResponse } from '@/app/api/types';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { DateTimePicker } from '@/src/components/ui/date-time-picker';
import { dateTimePickerButtonStyles } from '@/src/components/ui/date-time-picker/date-time-picker.styles';
import { cn } from '@/src/lib/utils';
import {
  FormPage,
  FormPageContent,
  FormPageFooter
} from '@/src/components/ui/form-page';
import { ChevronDown, Timer, Pause, Play, Square } from 'lucide-react';
import { useTimezone } from '@/app/context/timezone';
import { useTheme } from '@/src/context/theme';
import { useToast } from '@/src/components/ui/toast';
import { handleExpirationError } from '@/src/lib/expiration-error-handler';
import { useLocalization } from '@/src/context/localization';

import './activity-form.css';

type PlayType = 'TUMMY_TIME' | 'INDOOR_PLAY' | 'OUTDOOR_PLAY' | 'WALK';

const formatTimerDuration = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const DEFAULT_SUBCATEGORIES: Record<PlayType, string[]> = {
  TUMMY_TIME: [],
  INDOOR_PLAY: ['Sensory Play', 'Reading', 'Music', 'Arts & Crafts'],
  OUTDOOR_PLAY: ['Sandbox', 'Swings', 'Water Play', 'Garden'],
  WALK: ['Park', 'Stroller', 'Push Car', 'Wagon'],
};

interface ActivityFormProps {
  isOpen: boolean;
  onClose: () => void;
  babyId: string | undefined;
  initialTime: string;
  activity?: PlayLogResponse;
  onSuccess?: () => void;
  activeActivityData?: ActiveActivityResponse | null;
  onStartTimer?: (playType: string, subCategory: string, notes: string, existingDurationSeconds: number) => void;
  onPauseTimer?: () => void;
  onResumeTimer?: () => void;
  onEndTimer?: () => void;
  prefillData?: {
    startTime: string;
    durationMinutes: number;
    playType: string;
    subCategory: string | null;
    notes: string | null;
  } | null;
}

export default function ActivityForm({
  isOpen,
  onClose,
  babyId,
  initialTime,
  activity,
  onSuccess,
  activeActivityData,
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  onEndTimer,
  prefillData,
}: ActivityFormProps) {
  const { t } = useLocalization();
  const { formatDate, toUTCString } = useTimezone();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [selectedDateTime, setSelectedDateTime] = useState<Date>(() => {
    try {
      const date = new Date(initialTime);
      if (isNaN(date.getTime())) return new Date();
      return date;
    } catch {
      return new Date();
    }
  });
  const [playType, setPlayType] = useState<PlayType>('TUMMY_TIME');
  const [duration, setDuration] = useState<string>('');
  const [subCategory, setSubCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Live timer state for active activity
  const [liveElapsed, setLiveElapsed] = useState(0);
  const isTimerActive = !!activeActivityData && !activity;

  const calculateElapsed = useCallback(() => {
    if (!activeActivityData || activeActivityData.isPaused || !activeActivityData.currentStartTime) {
      return 0;
    }
    return Math.floor((Date.now() - new Date(activeActivityData.currentStartTime).getTime()) / 1000);
  }, [activeActivityData]);

  useEffect(() => {
    if (!activeActivityData || activeActivityData.isPaused) {
      setLiveElapsed(0);
      return;
    }
    setLiveElapsed(calculateElapsed());
    const interval = setInterval(() => {
      setLiveElapsed(calculateElapsed());
    }, 1000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setLiveElapsed(calculateElapsed());
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeActivityData, calculateElapsed]);

  const liveTotalSeconds = activeActivityData
    ? activeActivityData.duration + (activeActivityData.isPaused ? 0 : liveElapsed)
    : 0;

  // Sub-category dropdown state
  const [categories, setCategories] = useState<string[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch existing sub-categories for the selected play type
  useEffect(() => {
    const fetchCategories = async () => {
      if (playType === 'TUMMY_TIME') {
        setCategories([]);
        setFilteredCategories([]);
        return;
      }
      try {
        const authToken = localStorage.getItem('authToken');
        const response = await fetch(`/api/play-log?categories=true&type=${playType}`, {
          headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
        });
        if (!response.ok) throw new Error('Failed to fetch categories');
        const data = await response.json();
        if (data.success) {
          // Merge server categories with defaults, removing duplicates
          const defaults = DEFAULT_SUBCATEGORIES[playType] || [];
          const merged = Array.from(new Set([...defaults, ...data.data]));
          setCategories(merged);
          setFilteredCategories(merged);
        }
      } catch {
        // Fall back to defaults
        const defaults = DEFAULT_SUBCATEGORIES[playType] || [];
        setCategories(defaults);
        setFilteredCategories(defaults);
      }
    };

    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen, playType]);

  // Filter categories based on input
  useEffect(() => {
    if (subCategory.trim() === '') {
      setFilteredCategories(categories);
      setDropdownOpen(false);
    } else {
      const filtered = categories.filter(cat =>
        cat.toLowerCase().includes(subCategory.toLowerCase())
      );
      setFilteredCategories(filtered);
    }
  }, [subCategory, categories]);

  // Handle date/time change
  const handleDateTimeChange = (date: Date) => {
    setSelectedDateTime(date);
  };

  // Initialize form
  useEffect(() => {
    if (isOpen && !isInitialized) {
      if (activity) {
        // Edit mode
        try {
          const activityDate = new Date(activity.startTime);
          if (!isNaN(activityDate.getTime())) {
            setSelectedDateTime(activityDate);
          }
        } catch {}
        setPlayType(activity.type as PlayType);
        setDuration(activity.duration ? String(activity.duration) : '');
        setSubCategory(activity.activities || '');
        setNotes(activity.notes || '');
      } else if (activeActivityData) {
        // Active timer mode - populate from active session
        try {
          const date = new Date(activeActivityData.sessionStartTime);
          if (!isNaN(date.getTime())) {
            setSelectedDateTime(date);
          }
        } catch {}
        setPlayType(activeActivityData.playType as PlayType);
        setDuration(''); // Duration is live, don't set a static value
        setSubCategory(activeActivityData.subCategory || '');
        setNotes(activeActivityData.notes || '');
      } else {
        // New entry
        try {
          const date = new Date(initialTime);
          if (!isNaN(date.getTime())) {
            setSelectedDateTime(date);
          }
        } catch {}
        setPlayType('TUMMY_TIME');
        setDuration('');
        setSubCategory('');
        setNotes('');
      }
      setIsInitialized(true);
    } else if (!isOpen) {
      setIsInitialized(false);
    }
  }, [isOpen, activity, initialTime]);

  // Handle prefill data from ended activity timer
  useEffect(() => {
    if (prefillData && isOpen) {
      try {
        const date = new Date(prefillData.startTime);
        if (!isNaN(date.getTime())) {
          setSelectedDateTime(date);
        }
      } catch {}
      setPlayType(prefillData.playType as PlayType);
      setDuration(prefillData.durationMinutes > 0 ? String(prefillData.durationMinutes) : '');
      setSubCategory(prefillData.subCategory || '');
      setNotes(prefillData.notes || '');
    }
  }, [prefillData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!babyId) return;

    if (!selectedDateTime || isNaN(selectedDateTime.getTime())) {
      return;
    }

    setLoading(true);

    try {
      const utcTimeString = toUTCString(selectedDateTime);
      const durationMinutes = duration ? parseInt(duration, 10) : undefined;

      const payload = {
        babyId,
        startTime: utcTimeString,
        duration: durationMinutes,
        type: playType,
        activities: subCategory || null,
        notes: notes || null,
      };

      const authToken = localStorage.getItem('authToken');

      const response = await fetch(`/api/play-log${activity ? `?id=${activity.id}` : ''}`, {
        method: activity ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : '',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 403) {
          const { isExpirationError, errorData } = await handleExpirationError(
            response,
            showToast,
            'saving activity'
          );
          if (isExpirationError) return;
          if (errorData) {
            showToast({
              variant: 'error',
              title: 'Error',
              message: errorData.error || 'Failed to save activity',
              duration: 5000,
            });
            throw new Error(errorData.error || 'Failed to save activity');
          }
        }
        const errorData = await response.json();
        showToast({
          variant: 'error',
          title: 'Error',
          message: errorData.error || 'Failed to save activity',
          duration: 5000,
        });
        throw new Error(errorData.error || 'Failed to save activity');
      }

      onClose();
      onSuccess?.();

      // Reset form
      setSelectedDateTime(new Date(initialTime));
      setPlayType('TUMMY_TIME');
      setDuration('');
      setSubCategory('');
      setNotes('');
    } catch (error) {
      console.error('Error saving activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (category: string) => {
    setSubCategory(category);
    setDropdownOpen(false);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const handleCategoryInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSubCategory(value);
    setHighlightedIndex(-1);
    if (value.trim() !== '') {
      setDropdownOpen(true);
    }
  };

  const handleCategoryInputFocus = () => {
    if (subCategory.trim() !== '') {
      setDropdownOpen(true);
    }
  };

  const handleCategoryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setDropdownOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredCategories.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : filteredCategories.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredCategories.length) {
          handleCategorySelect(filteredCategories[highlightedIndex]);
        } else if (subCategory.trim() !== '') {
          handleCategorySelect(subCategory.trim());
        }
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setDropdownOpen(false);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        break;
    }
  };

  const playTypeOptions: { value: PlayType; label: string }[] = [
    { value: 'TUMMY_TIME', label: t('Tummy Time') },
    { value: 'INDOOR_PLAY', label: t('Indoor Play') },
    { value: 'OUTDOOR_PLAY', label: t('Outdoor Play') },
    { value: 'WALK', label: t('Walk') },
  ];

  return (
    <FormPage
      isOpen={isOpen}
      onClose={onClose}
      title={activity ? t('Edit Activity') : t('New Activity')}
      description={activity ? t('Update the activity details') : t('Record a new activity')}
    >
      <FormPageContent>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Activity Type Selection */}
            <div>
              <label className="form-label">{t('Activity Type')}</label>
              <div className="grid grid-cols-2 gap-2">
                {playTypeOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors activity-type-button ${
                      playType === option.value
                        ? 'bg-orange-100 border-orange-400 text-orange-800 activity-type-button-active'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 activity-type-button-inactive'
                    }`}
                    onClick={() => {
                      setPlayType(option.value);
                      setSubCategory('');
                    }}
                    disabled={loading || isTimerActive}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Start Time */}
            <div>
              <label className="form-label">{t('Start Time')}</label>
              <div className="flex flex-wrap gap-2">
                <DateTimePicker
                  value={selectedDateTime}
                  onChange={handleDateTimeChange}
                  disabled={loading}
                  placeholder={t("Select start time...")}
                />
                {/* Start Timer button - no active session */}
                {!activity && onStartTimer && !activeActivityData && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const existingSeconds = duration ? parseInt(duration, 10) * 60 : 0;
                      onStartTimer(playType, subCategory, notes, existingSeconds);
                      onClose();
                    }}
                    className={cn(dateTimePickerButtonStyles, "date-time-picker-button whitespace-nowrap")}
                    disabled={loading}
                  >
                    <Timer className="h-4 w-4" />
                    {duration ? t('Resume Timer') : t('Start Timer')}
                  </Button>
                )}
                {/* Active timer controls */}
                {isTimerActive && activeActivityData && (
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-sm font-semibold ${activeActivityData.isPaused ? 'activity-timer-paused-text' : 'activity-timer-active-text'}`}>
                      {formatTimerDuration(liveTotalSeconds)}
                    </span>
                    {!activeActivityData.isPaused ? (
                      <button
                        type="button"
                        onClick={onPauseTimer}
                        className="banner-btn activity-banner-btn-pause"
                        title={t('Pause Activity')}
                      >
                        <Pause className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onResumeTimer}
                        className="banner-btn activity-banner-btn-resume"
                        title={t('Resume Activity')}
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onEndTimer}
                      className="banner-btn activity-banner-btn-stop"
                      title={t('End Activity')}
                    >
                      <Square className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="form-label">{t('Duration (minutes)')}</label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder={t("Enter duration in minutes")}
                min="0"
                disabled={loading}
                className="activity-form-input"
              />
            </div>

            {/* Sub-Category (not for Tummy Time) */}
            {playType !== 'TUMMY_TIME' && (
              <div>
                <label className="form-label">{t('Sub-Category')}</label>
                <div className="relative">
                  <div className="relative w-full">
                    <div className="flex items-center w-full">
                      <Input
                        ref={inputRef}
                        value={subCategory}
                        onChange={handleCategoryInputChange}
                        onFocus={handleCategoryInputFocus}
                        onKeyDown={handleCategoryKeyDown}
                        className="w-full pr-10 activity-form-dropdown-trigger"
                        placeholder={t("Enter or select a category")}
                        disabled={loading}
                      />
                      <ChevronDown
                        className="absolute right-3 h-4 w-4 text-gray-500 activity-form-dropdown-icon"
                        onClick={() => {
                          setDropdownOpen(!dropdownOpen);
                          if (document.activeElement instanceof HTMLElement) {
                            document.activeElement.blur();
                          }
                        }}
                      />
                    </div>

                    {dropdownOpen && (
                      <div
                        ref={dropdownRef}
                        className="absolute z-50 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-auto activity-dropdown-container"
                        style={{ width: inputRef.current?.offsetWidth }}
                      >
                        {filteredCategories.length > 0 ? (
                          <div className="py-1">
                            {filteredCategories.map((category, index) => (
                              <div
                                key={category}
                                className={`px-3 py-2 text-sm cursor-pointer activity-dropdown-item ${
                                  highlightedIndex === index
                                    ? 'bg-gray-100 activity-dropdown-item-highlighted'
                                    : 'hover:bg-gray-100'
                                }`}
                                onClick={() => handleCategorySelect(category)}
                                onMouseEnter={() => setHighlightedIndex(index)}
                              >
                                {t(category)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          subCategory.trim() !== '' ? (
                            <div className="px-3 py-2 text-sm text-gray-500 activity-dropdown-no-match">
                              {t('No matching categories. Press Enter to create "')}{subCategory}".
                            </div>
                          ) : (
                            <div className="px-3 py-2 text-sm text-gray-500 activity-dropdown-no-categories">
                              {t('No categories found')}
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="form-label">{t('Notes')}</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full min-h-[80px]"
                placeholder={t("Add any notes...")}
                disabled={loading}
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
          <Button onClick={handleSubmit} disabled={loading}>
            {activity ? t('Update') : t('Save')}
          </Button>
        </div>
      </FormPageFooter>
    </FormPage>
  );
}
