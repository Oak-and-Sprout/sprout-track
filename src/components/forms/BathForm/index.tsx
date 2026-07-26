'use client';

import React, { useState, useEffect, useCallback, useId } from 'react';
import { BathLogResponse } from '@/app/api/types';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Checkbox } from '@/src/components/ui/checkbox';
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
import { useLocalization } from '@/src/context/localization';
import { Settings } from 'lucide-react';
import { PhotoAttachments } from '@/src/components/ui/photo-attachments';
import { uploadPhotos, linkPhoto, unlinkPhoto, fetchPhotos, fetchPhotosEnabled } from '@/src/utils/photoClientApi';

import './bath-form.css';

// Note: DEFAULT_BATH_TYPES are displayed via t() so they can be localized
const DEFAULT_BATH_TYPES = ['Full Bath', 'Sponge Bath', 'Wipe Down'];

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
  const formId = useId();
  const bathTypeId = `${formId}-bath-type`;
  const notesId = `${formId}-notes`;
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
    bathType: '',
    soapUsed: false,
    shampooUsed: false,
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializedTime, setInitializedTime] = useState<string | null>(null);
  const [lastActivityId, setLastActivityId] = useState<string | null>(null);
  const [customBathTypes, setCustomBathTypes] = useState<string[]>([]);
  const [isCustomBathType, setIsCustomBathType] = useState(false);
  const [customBathTypeInput, setCustomBathTypeInput] = useState('');
  const [hiddenBathTypes, setHiddenBathTypes] = useState<string[]>([]);
  const [showBathTypeManager, setShowBathTypeManager] = useState(false);
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
          .filter((p) => p.links.some((l) => l.activityType === 'bath' && l.activityId === activity.id))
          .map((p) => ({ id: p.id, caption: p.caption }))
      ))
      .catch(() => {});
  }, [isOpen, activity?.id, photosEnabled]);

  // Fetch custom bath types and hidden bath type settings when form opens
  useEffect(() => {
    if (isOpen) {
      const authToken = localStorage.getItem('authToken');
      const headers = { 'Authorization': authToken ? `Bearer ${authToken}` : '' };

      const fetchCustomBathTypes = async () => {
        try {
          const response = await fetch('/api/bath-log?bathTypes=true', { headers });
          if (!response.ok) return;
          const data = await response.json();
          if (data.success) {
            setCustomBathTypes(data.data);
          }
        } catch (error) {
          console.error('Error fetching custom bath types:', error);
        }
      };

      const fetchHiddenBathTypes = async () => {
        try {
          const response = await fetch('/api/bath-type-settings', { headers });
          if (!response.ok) return;
          const data = await response.json();
          if (data.success && data.data) {
            setHiddenBathTypes(data.data.hiddenBathTypes || []);
          }
        } catch (error) {
          console.error('Error fetching bath type settings:', error);
        }
      };

      fetchCustomBathTypes();
      fetchHiddenBathTypes();
    } else {
      setShowBathTypeManager(false);
    }
  }, [isOpen]);

  const saveHiddenBathTypes = useCallback(async (newHidden: string[]) => {
    setHiddenBathTypes(newHidden);
    try {
      const authToken = localStorage.getItem('authToken');
      await fetch('/api/bath-type-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : '',
        },
        body: JSON.stringify({ hiddenBathTypes: newHidden }),
      });
    } catch (error) {
      console.error('Error saving bath type settings:', error);
    }
  }, []);

  const toggleBathTypeVisibility = useCallback((bathType: string) => {
    const newHidden = hiddenBathTypes.includes(bathType)
      ? hiddenBathTypes.filter(bt => bt !== bathType)
      : [...hiddenBathTypes, bathType];
    saveHiddenBathTypes(newHidden);
  }, [hiddenBathTypes, saveHiddenBathTypes]);

  // Compute visible default bath types, preserving the activity's current type if editing
  const visibleDefaultBathTypes = DEFAULT_BATH_TYPES.filter(bt => {
    if (hiddenBathTypes.includes(bt)) {
      // Still show it if it's the current activity's bath type (editing mode)
      return activity?.bathType === bt;
    }
    return true;
  });

  // Compute visible custom bath types, same logic as defaults
  const visibleCustomBathTypes = customBathTypes.filter(bt => {
    if (hiddenBathTypes.includes(bt)) {
      return activity?.bathType === bt;
    }
    return true;
  });

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
          const activityBathType = activity.bathType || '';
          const isDefaultBathType = !!activityBathType && DEFAULT_BATH_TYPES.includes(activityBathType);
          setFormData({
            bathType: isDefaultBathType ? activityBathType : (activityBathType ? 'Custom' : ''),
            soapUsed: activity.soapUsed || false,
            shampooUsed: activity.shampooUsed || false,
            notes: activity.notes || '',
          });
          setIsCustomBathType(!!activityBathType && !isDefaultBathType);
          setCustomBathTypeInput(!isDefaultBathType ? activityBathType : '');

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
          setFormData(prev => ({ ...prev, bathType: '' }));
          setIsCustomBathType(false);
          setCustomBathTypeInput('');
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
      setPendingPhotoFiles([]);
      setAttachedPhotos([]);
      setRemovedPhotoIds([]);
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

    // Validate custom bath type if Custom is selected
    if (isCustomBathType && !customBathTypeInput.trim()) {
      showToast({
        variant: 'error',
        title: t('Error'),
        message: t('Please enter a custom bath type'),
        duration: 5000,
      });
      return;
    }

    // Determine the bath type value to use
    const bathTypeValue = isCustomBathType ? customBathTypeInput.trim() : (formData.bathType || null);

    setLoading(true);

    try {
      // Convert local time to UTC ISO string
      const utcTimeString = toUTCString(selectedDateTime);

      console.log('Original time (local):', selectedDateTime.toISOString());
      console.log('Converted time (UTC):', utcTimeString);

      const payload = {
        babyId,
        time: utcTimeString, // Send the UTC ISO string instead of local time
        bathType: bathTypeValue,
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
        const savedActivityId = activity?.id || data.data?.id;

        if (photosEnabled && savedActivityId) {
          try {
            for (const photoId of removedPhotoIds) {
              await unlinkPhoto(photoId, 'bath', savedActivityId);
            }
            if (pendingPhotoFiles.length > 0) {
              const result = await uploadPhotos(pendingPhotoFiles, { babyId });
              for (const photo of result.photos) {
                await linkPhoto(photo.id, 'bath', savedActivityId);
              }
            }
          } catch (photoError) {
            console.error('Photo attachment failed:', photoError);
            showToast({
              variant: 'warning',
              title: t('Warning'),
              message: t('Bath saved, but one or more photos failed to attach.'),
              duration: 5000,
            });
          }
        }

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
            
            {/* Bath Type */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={bathTypeId}>{t('Bath Type')}</Label>
                <button
                  type="button"
                  onClick={() => setShowBathTypeManager(!showBathTypeManager)}
                  className="bath-settings-button p-1 text-muted-foreground hover:text-foreground transition-colors"
                  title={t('Manage visible bath types')}
                >
                  <Settings className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {showBathTypeManager && (
                <div className="bath-type-manager mb-2 p-3 border border-gray-300 rounded-md bg-muted/50 space-y-1">
                  <p className="text-xs text-muted-foreground mb-2">{t('Toggle bath types to show or hide them')}</p>
                  {DEFAULT_BATH_TYPES.map((bathType) => (
                    <label key={bathType} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        variant="primary"
                        size="sm"
                        checked={!hiddenBathTypes.includes(bathType)}
                        onCheckedChange={() => toggleBathTypeVisibility(bathType)}
                      />
                      {t(bathType)}
                    </label>
                  ))}
                  {customBathTypes.length > 0 && (
                    <>
                      <hr className="my-2 border-border" />
                      <p className="text-xs text-muted-foreground mb-1">{t('Custom Bath Types')}</p>
                      {customBathTypes.map((bathType) => (
                        <label key={bathType} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            variant="primary"
                            size="sm"
                            checked={!hiddenBathTypes.includes(bathType)}
                            onCheckedChange={() => toggleBathTypeVisibility(bathType)}
                          />
                          {bathType}
                        </label>
                      ))}
                    </>
                  )}
                </div>
              )}
              <Select
                value={formData.bathType}
                onValueChange={(value: string) => {
                  if (value === 'Custom') {
                    setIsCustomBathType(true);
                    setFormData(prev => ({ ...prev, bathType: 'Custom' }));
                  } else {
                    setIsCustomBathType(false);
                    setCustomBathTypeInput('');
                    setFormData(prev => ({ ...prev, bathType: value }));
                  }
                }}
                disabled={loading}
              >
                <SelectTrigger id={bathTypeId} className="w-full">
                  <SelectValue placeholder={t("Select bath type")} />
                </SelectTrigger>
                <SelectContent>
                  {visibleDefaultBathTypes.map((bathType) => (
                    <SelectItem key={bathType} value={bathType}>
                      {t(bathType)}
                    </SelectItem>
                  ))}
                  <SelectItem value="Custom">{t('Custom')}</SelectItem>
                  {visibleCustomBathTypes.map((bathType) => (
                    <SelectItem key={bathType} value={bathType}>
                      {bathType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isCustomBathType && (
                <div className="mt-2">
                  <Input
                    type="text"
                    value={customBathTypeInput}
                    onChange={(e) => setCustomBathTypeInput(e.target.value)}
                    placeholder={t("Enter custom bath type")}
                    disabled={loading}
                  />
                </div>
              )}
            </div>

            {/* Bath Options */}
            <div className="space-y-2">
              <Label>{t('Bath Options')}</Label>
              <div className="flex flex-col space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox
                    checked={formData.soapUsed}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange('soapUsed', checked as boolean)
                    }
                    variant="success"
                  />
                  <span className="form-label text-sm">{t('Soap Used')}</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox
                    checked={formData.shampooUsed}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange('shampooUsed', checked as boolean)
                    }
                    variant="success"
                  />
                  <span className="form-label text-sm">{t('Shampoo Used')}</span>
                </label>
              </div>
            </div>
            

            
            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor={notesId}>{t('Notes')}</Label>
              <Textarea
                id={notesId}
                name="notes"
                placeholder={t("Enter any notes about the bath")}
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
              />
            </div>

            {photosEnabled && (
              <div className="space-y-2">
                <Label>{t('Photos')}</Label>
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
