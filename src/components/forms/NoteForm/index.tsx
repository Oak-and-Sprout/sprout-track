'use client';

import React, { useState, useEffect, useRef } from 'react';
import { NoteResponse } from '@/app/api/types';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { DateTimePicker } from '@/src/components/ui/date-time-picker';
import { 
  FormPage, 
  FormPageContent, 
  FormPageFooter 
} from '@/src/components/ui/form-page';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/src/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { useTimezone } from '@/app/context/timezone';
import { useTheme } from '@/src/context/theme';
import { useToast } from '@/src/components/ui/toast';
import { handleExpirationError } from '@/src/lib/expiration-error-handler';import { useLocalization } from '@/src/context/localization';

import './note-form.css';

interface NoteFormProps {
  isOpen: boolean;
  onClose: () => void;
  babyId: string | undefined;
  initialTime: string;
  activity?: NoteResponse;
  onSuccess?: () => void;
}

export default function NoteForm({
  isOpen,
  onClose,
  babyId,
  initialTime,
  activity,
  onSuccess,
}: NoteFormProps) {
  const { t } = useLocalization();
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
    content: '',
    category: '',
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializedTime, setInitializedTime] = useState<string | null>(null);
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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch existing categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/note?categories=true');
        if (!response.ok) throw new Error('Failed to fetch categories');
        const data = await response.json();
        if (data.success) {
          setCategories(data.data);
          setFilteredCategories(data.data);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  // Filter categories based on input
  useEffect(() => {
    if (formData.category.trim() === '') {
      setFilteredCategories(categories);
      // Close dropdown when input is empty
      setDropdownOpen(false);
    } else {
      const filtered = categories.filter(category => 
        category.toLowerCase().includes(formData.category.toLowerCase())
      );
      setFilteredCategories(filtered);
    }
  }, [formData.category, categories]);

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
          content: activity.content,
          category: activity.category || '',
        });
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
      }
      
      // Mark as initialized
      setIsInitialized(true);
    } else if (!isOpen) {
      // Reset initialization flag and stored time when form closes
      setIsInitialized(false);
      setInitializedTime(null);
    }
  }, [isOpen, activity, initialTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!babyId) return;

    // Validate required fields
    if (!formData.content) {
      console.error('Required fields missing: content');
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
        content: formData.content,
        category: formData.category || null,
      };

      // Get auth token from localStorage
      const authToken = localStorage.getItem('authToken');

      const response = await fetch(`/api/note${activity ? `?id=${activity.id}` : ''}`, {
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
            'saving notes'
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
              message: errorData.error || 'Failed to save note',
              duration: 5000,
            });
            throw new Error(errorData.error || 'Failed to save note');
          }
        }
        
        // Handle other errors
        const errorData = await response.json();
        showToast({
          variant: 'error',
          title: 'Error',
          message: errorData.error || 'Failed to save note',
          duration: 5000,
        });
        throw new Error(errorData.error || 'Failed to save note');
      }

      onClose();
      onSuccess?.();
      
      // Reset form data
      setSelectedDateTime(new Date(initialTime));
      setFormData({
        time: initialTime,
        content: '',
        category: '',
      });
    } catch (error) {
      console.error('Error saving note:', error);
      // Error toast already shown above for non-expiration errors
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (category: string) => {
    setFormData(prev => ({ ...prev, category }));
    setDropdownOpen(false);
    // Remove focus from the input after selection
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const handleCategoryInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, category: value }));
    
    // Reset highlighted index when input changes
    setHighlightedIndex(-1);
    
    // Open dropdown when typing, but let the useEffect handle closing it when empty
    if (value.trim() !== '') {
      setDropdownOpen(true);
    }
  };

  const handleCategoryInputFocus = () => {
    // Only open dropdown if there's already text in the input
    if (formData.category.trim() !== '') {
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
          // Select the highlighted category
          handleCategorySelect(filteredCategories[highlightedIndex]);
        } else if (formData.category.trim() !== '') {
          // Create a new category with the current input value
          handleCategorySelect(formData.category.trim());
        }
        // Blur the input to remove focus
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setDropdownOpen(false);
        // Blur the input to remove focus
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        break;
      default:
        break;
    }
  };

  return (
    <FormPage
      isOpen={isOpen}
      onClose={onClose}
      title={activity ? t('Edit Note') : t('Add Note')}
      description={activity ? t('Update your note about your baby') : t('Record a note about your baby')}
    >
        <FormPageContent>
          <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Time Selection - Full width on all screens */}
            <div>
              <label className="form-label">{t('Time')}</label>
              <DateTimePicker
                value={selectedDateTime}
                onChange={handleDateTimeChange}
                disabled={loading}
                placeholder={t("Select note time...")}
              />
            </div>
            
            {/* Category Selection - Full width on all screens */}
            <div>
              <label className="form-label">{t('Category')}</label>
              <div className="relative">
                <div className="relative w-full">
                  <div className="flex items-center w-full">
                    <Input
                      ref={inputRef}
                      value={formData.category}
                      onChange={handleCategoryInputChange}
                      onFocus={handleCategoryInputFocus}
                      onKeyDown={handleCategoryKeyDown}
                      className="w-full pr-10 note-form-dropdown-trigger"
                      placeholder={t("Enter or select a category")}
                      disabled={loading}
                    />
                    <ChevronDown 
                      className="absolute right-3 h-4 w-4 text-gray-500 note-form-dropdown-icon"
                      onClick={() => {
                        setDropdownOpen(!dropdownOpen);
                        // Remove focus when toggling dropdown with the icon
                        if (document.activeElement instanceof HTMLElement) {
                          document.activeElement.blur();
                        }
                      }}
                    />
                  </div>
                  
                  {dropdownOpen && (
                    <div 
                      ref={dropdownRef}
                      className="absolute z-50 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-auto category-dropdown-container"
                      style={{ width: inputRef.current?.offsetWidth }}
                    >
                      {filteredCategories.length > 0 ? (
                        <div className="py-1">
                          {filteredCategories.map((category, index) => (
                            <div 
                              key={category}
                              className={`px-3 py-2 text-sm cursor-pointer category-dropdown-item ${
                                highlightedIndex === index 
                                  ? 'bg-gray-100 category-dropdown-item-highlighted' 
                                  : 'hover:bg-gray-100'
                              }`}
                              onClick={() => handleCategorySelect(category)}
                              onMouseEnter={() => setHighlightedIndex(index)}
                            >
                              {category}
                            </div>
                          ))}
                        </div>
                      ) : (
                        formData.category.trim() !== '' ? (
                          <div className="px-3 py-2 text-sm text-gray-500 category-dropdown-no-match">
                            {t('No matching categories. Press Enter to create "')}{formData.category}".
                          </div>
                        ) : (
                          <div className="px-3 py-2 text-sm text-gray-500 category-dropdown-no-categories">
                            {t('No categories found')}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div>
              <label className="form-label">{t('Note')}</label>
              <Textarea
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                className="w-full min-h-[150px]"
                placeholder={t("Enter your note")}
                required
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
