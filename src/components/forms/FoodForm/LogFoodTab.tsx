'use client';

import React, { useState, useEffect, useRef, useId } from 'react';
import { LogFoodTabProps } from './food-form.types';
import { FoodResponse, FoodLogCreate } from '@/app/api/types';
import { DateTimePicker } from '@/src/components/ui/date-time-picker';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Button } from '@/src/components/ui/button';
import { Label } from '@/src/components/ui/label';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Switch } from '@/src/components/ui/switch';
import { PhotoAttachments } from '@/src/components/ui/photo-attachments';
import { uploadPhotos, linkPhoto, unlinkPhoto, fetchPhotos, fetchPhotosEnabled } from '@/src/utils/photoClientApi';
import { Loader2, ChevronDown, TriangleAlert } from 'lucide-react';
import { useTimezone } from '@/app/context/timezone';
import { useToast } from '@/src/components/ui/toast';
import { handleExpirationError } from '@/src/lib/expiration-error-handler';
import { useLocalization } from '@/src/context/localization';
import {
  normalizeFoodName,
  foodNameKey,
  isLikelyCommonAllergen,
  FOOD_ENJOYMENT_VALUES,
  FOOD_ENJOYMENT_LABELS,
  FoodEnjoymentValue,
} from '@/src/utils/foodLogUtils';

/**
 * LogFoodTab Component
 *
 * Tab for logging a new food try or editing an existing food log entry.
 * Includes a food combobox over the family catalog (with inline "add new
 * food" and common-allergen pre-suggestion), enjoyment picker, reaction
 * toggle with description, notes, and photo attachments.
 */
const LogFoodTab: React.FC<LogFoodTabProps> = ({
  babyId,
  initialTime,
  onSuccess,
  onClose,
  refreshData,
  activity,
  foods,
  onFoodsUpdated,
}) => {
  const { t } = useLocalization();
  const uid = useId();
  const foodNameId = `${uid}-food-name`;
  const allergenId = `${uid}-common-allergen`;
  const reactionDescriptionId = `${uid}-reaction-description`;
  const notesId = `${uid}-notes`;
  const { toUTCString } = useTimezone();
  const { showToast } = useToast();

  // Form state
  const [selectedDateTime, setSelectedDateTime] = useState<Date>(() => {
    const d = new Date(activity ? activity.time : initialTime);
    return isNaN(d.getTime()) ? new Date() : d;
  });
  const [foodName, setFoodName] = useState(activity?.food?.name || '');
  const [commonAllergen, setCommonAllergen] = useState(false);
  const [allergenTouched, setAllergenTouched] = useState(false);
  const [enjoyment, setEnjoyment] = useState<FoodEnjoymentValue | null>(null);
  const [hadReaction, setHadReaction] = useState(false);
  const [reactionDescription, setReactionDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Photos state
  const [photosEnabled, setPhotosEnabled] = useState(false);
  const [pendingPhotoFiles, setPendingPhotoFiles] = useState<File[]>([]);
  const [attachedPhotos, setAttachedPhotos] = useState<{ id: string; caption: string | null }[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);

  // Food combobox state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // The catalog food the typed name resolves to (case-insensitive), if any
  const matchedFood: FoodResponse | undefined = foods.find(
    food => foodNameKey(food.name) === foodNameKey(foodName)
  );
  const isNewFood = foodNameKey(foodName) !== '' && !matchedFood;

  const filteredFoods = foodName.trim() === ''
    ? foods
    : foods.filter(food => food.name.toLowerCase().includes(foodName.trim().toLowerCase()));

  useEffect(() => { fetchPhotosEnabled().then(setPhotosEnabled); }, []);

  // Load photos already attached to the edited log
  useEffect(() => {
    if (!activity?.id || !photosEnabled) return;
    fetchPhotos({ babyId })
      .then((data) => setAttachedPhotos(
        data.photos
          .filter((p) => p.links.some((l) => l.activityType === 'foodLog' && l.activityId === activity.id))
          .map((p) => ({ id: p.id, caption: p.caption }))
      ))
      .catch(() => {});
  }, [activity?.id, photosEnabled, babyId]);

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

  // Initialize form when editing
  useEffect(() => {
    if (activity && !isInitialized) {
      setFoodName(activity.food?.name || '');
      setEnjoyment(
        FOOD_ENJOYMENT_VALUES.includes(activity.enjoyment as FoodEnjoymentValue)
          ? (activity.enjoyment as FoodEnjoymentValue)
          : null
      );
      setHadReaction(activity.hadReaction === true);
      setReactionDescription(activity.reactionDescription || '');
      setNotes(activity.notes || '');
      const d = new Date(activity.time);
      if (!isNaN(d.getTime())) {
        setSelectedDateTime(d);
      }
      setIsInitialized(true);
    } else if (!activity && !isInitialized) {
      setIsInitialized(true);
    }
  }, [activity, isInitialized]);

  // Reset initialized flag when the edited activity changes
  useEffect(() => {
    setIsInitialized(false);
  }, [activity?.id]);

  // Pre-suggest the common-allergen flag for new foods (big-9 keyword match)
  // until the user explicitly toggles the checkbox
  useEffect(() => {
    if (matchedFood) {
      setCommonAllergen(matchedFood.commonAllergen);
    } else if (!allergenTouched) {
      setCommonAllergen(isLikelyCommonAllergen(foodName));
    }
  }, [foodName, matchedFood, allergenTouched]);

  const handleFoodSelect = (food: FoodResponse) => {
    setFoodName(food.name);
    setDropdownOpen(false);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const handleFoodInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFoodName(e.target.value);
    setHighlightedIndex(-1);
    if (e.target.value.trim() !== '') {
      setDropdownOpen(true);
    }
  };

  const handleFoodInputFocus = () => {
    if (foodName.trim() !== '') {
      setDropdownOpen(true);
    }
  };

  const handleFoodKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
        setHighlightedIndex(prev => (prev < filteredFoods.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredFoods.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredFoods.length) {
          handleFoodSelect(filteredFoods[highlightedIndex]);
        } else {
          setDropdownOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setDropdownOpen(false);
        break;
      default:
        break;
    }
  };

  /**
   * Resolve the typed food name to a catalog foodId, creating the catalog
   * entry when it's new. Tolerates a duplicate-name race by refetching.
   */
  const resolveFoodId = async (authToken: string | null): Promise<string | null> => {
    const name = normalizeFoodName(foodName);
    if (!name) return null;
    if (matchedFood) return matchedFood.id;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': authToken ? `Bearer ${authToken}` : '',
    };

    const createResponse = await fetch('/api/food', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, commonAllergen }),
    });

    if (createResponse.ok) {
      const result = await createResponse.json();
      if (result.success && result.data) {
        onFoodsUpdated([...foods, result.data]);
        return result.data.id;
      }
    }

    // A concurrent create may have won the duplicate-name race — refetch and match
    const listResponse = await fetch('/api/food', { headers });
    if (listResponse.ok) {
      const result = await listResponse.json();
      if (result.success && Array.isArray(result.data)) {
        onFoodsUpdated(result.data);
        const existing = (result.data as FoodResponse[]).find(
          food => foodNameKey(food.name) === foodNameKey(name)
        );
        if (existing) return existing.id;
      }
    }
    return null;
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!babyId || !normalizeFoodName(foodName)) return;

    if (!selectedDateTime || isNaN(selectedDateTime.getTime())) {
      console.error('Required fields missing: valid date time');
      return;
    }

    setIsSubmitting(true);

    try {
      const authToken = localStorage.getItem('authToken');

      const foodId = await resolveFoodId(authToken);
      if (!foodId) {
        showToast({
          variant: 'error',
          title: t('Error'),
          message: t('Failed to save food record'),
          duration: 5000,
        });
        return;
      }

      const payload: FoodLogCreate = {
        babyId,
        foodId,
        time: toUTCString(selectedDateTime) || selectedDateTime.toISOString(),
        enjoyment: enjoyment as FoodLogCreate['enjoyment'],
        hadReaction,
        reactionDescription: hadReaction && reactionDescription.trim() ? reactionDescription.trim() : undefined,
        notes: notes.trim() ? notes.trim() : undefined,
      };

      const url = activity ? `/api/food-log?id=${activity.id}` : '/api/food-log';
      const response = await fetch(url, {
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
            'saving food record'
          );
          if (isExpirationError) return;
          if (errorData) {
            showToast({
              variant: 'error',
              title: t('Error'),
              message: errorData.error || t('Failed to save food record'),
              duration: 5000,
            });
            throw new Error(errorData.error || 'Failed to save food record');
          }
        }

        const errorData = await response.json();
        showToast({
          variant: 'error',
          title: t('Error'),
          message: errorData.error || t('Failed to save food record'),
          duration: 5000,
        });
        throw new Error(errorData.error || 'Failed to save food record');
      }

      const result = await response.json();
      const savedLogId = activity?.id || result.data?.id;

      // Attach/detach photos (best effort — the log itself is already saved)
      if (photosEnabled && savedLogId) {
        try {
          for (const photoId of removedPhotoIds) {
            await unlinkPhoto(photoId, 'foodLog', savedLogId);
          }
          if (pendingPhotoFiles.length > 0) {
            const uploadResult = await uploadPhotos(pendingPhotoFiles, { babyId });
            for (const photo of uploadResult.photos) {
              await linkPhoto(photo.id, 'foodLog', savedLogId);
            }
          }
        } catch (photoError) {
          console.error('Photo attachment failed:', photoError);
          showToast({
            variant: 'warning',
            title: t('Warning'),
            message: t('Food saved, but one or more photos failed to attach.'),
            duration: 5000,
          });
        }
      }

      showToast({
        variant: 'success',
        title: t('Success'),
        message: activity
          ? t('Food record updated successfully')
          : t('Food record saved successfully'),
        duration: 3000,
      });

      // Reset form if not editing
      if (!activity) {
        setFoodName('');
        setEnjoyment(null);
        setHadReaction(false);
        setReactionDescription('');
        setNotes('');
        setCommonAllergen(false);
        setAllergenTouched(false);
        setSelectedDateTime(new Date());
      }
      setPendingPhotoFiles([]);
      setRemovedPhotoIds([]);

      refreshData();
      onSuccess?.();
    } catch (error) {
      console.error('Error saving food record:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="food-form-tab-content">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Date/Time Picker */}
        <div>
          <Label className="form-label">{t('Date & Time')}</Label>
          <DateTimePicker
            value={selectedDateTime}
            onChange={setSelectedDateTime}
            disabled={isSubmitting}
            placeholder={t("Select food time...")}
          />
        </div>

        {/* Food Combobox */}
        <div>
          <Label className="form-label" htmlFor={foodNameId}>{t('Food')}</Label>
          <div className="relative">
            <div className="relative w-full">
              <div className="flex items-center w-full">
                <Input
                  ref={inputRef}
                  id={foodNameId}
                  value={foodName}
                  onChange={handleFoodInputChange}
                  onFocus={handleFoodInputFocus}
                  onKeyDown={handleFoodKeyDown}
                  className="w-full pr-10 food-form-dropdown-trigger"
                  placeholder={t("Enter or select a food")}
                  disabled={isSubmitting}
                  required
                />
                <ChevronDown
                  aria-hidden="true"
                  className="absolute right-3 h-4 w-4 text-gray-500 food-form-dropdown-icon"
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
                  className="absolute z-50 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-auto food-dropdown-container"
                  style={{ width: inputRef.current?.offsetWidth }}
                >
                  {filteredFoods.length > 0 ? (
                    <div className="py-1">
                      {filteredFoods.map((food, index) => (
                        <div
                          key={food.id}
                          className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer food-dropdown-item ${
                            highlightedIndex === index
                              ? 'bg-gray-100 food-dropdown-item-highlighted'
                              : 'hover:bg-gray-100'
                          }`}
                          onClick={() => handleFoodSelect(food)}
                          onMouseEnter={() => setHighlightedIndex(index)}
                        >
                          <span>{food.name}</span>
                          {food.commonAllergen && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 food-allergen-badge">
                              {t('Common allergen')}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-500 food-dropdown-no-match">
                      {foodName.trim() !== ''
                        ? `${t('New food — it will be added to your list when saved')}`
                        : t('No foods found')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {isNewFood && (
            <p className="mt-1 text-xs text-gray-500 food-form-new-food-hint">
              {t('New food — it will be added to your list when saved')}
            </p>
          )}
        </div>

        {/* Common Allergen */}
        <div className="flex items-center gap-2">
          <Checkbox
            id={allergenId}
            checked={commonAllergen}
            onCheckedChange={(checked: boolean) => {
              setAllergenTouched(true);
              setCommonAllergen(checked);
            }}
            disabled={isSubmitting || !!matchedFood}
          />
          <Label className="form-label !mb-0" htmlFor={allergenId}>{t('Common allergen')}</Label>
        </div>

        {/* Enjoyment Picker */}
        <div>
          <Label className="form-label">{t('Enjoyment')}</Label>
          <div className="grid grid-cols-5 gap-1" role="group" aria-label={t('Enjoyment')}>
            {FOOD_ENJOYMENT_VALUES.map((value) => (
              <Button
                key={value}
                type="button"
                variant={enjoyment === value ? 'default' : 'outline'}
                className="px-1 py-1 h-auto text-xs"
                onClick={() => setEnjoyment(prev => (prev === value ? null : value))}
                disabled={isSubmitting}
                aria-pressed={enjoyment === value}
              >
                {t(FOOD_ENJOYMENT_LABELS[value])}
              </Button>
            ))}
          </div>
        </div>

        {/* Reaction Toggle */}
        <div>
          <div className="flex items-center justify-between">
            <Label className="form-label !mb-0 flex items-center gap-1.5">
              <TriangleAlert aria-hidden="true" className="h-4 w-4 text-amber-500" />
              {t('Reaction occurred')}
            </Label>
            <Switch
              checked={hadReaction}
              onCheckedChange={setHadReaction}
              disabled={isSubmitting}
              aria-label={t('Reaction occurred')}
            />
          </div>
          {hadReaction && (
            <div className="mt-2">
              <Label className="form-label" htmlFor={reactionDescriptionId}>{t('Describe the reaction')}</Label>
              <Textarea
                id={reactionDescriptionId}
                value={reactionDescription}
                onChange={(e) => setReactionDescription(e.target.value)}
                className="w-full min-h-[60px]"
                placeholder={t("Redness, swelling, hives...")}
                disabled={isSubmitting}
              />
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <Label className="form-label" htmlFor={notesId}>{t('Notes')}</Label>
          <Textarea
            id={notesId}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full min-h-[80px]"
            placeholder={t("Optional notes about this food...")}
            disabled={isSubmitting}
          />
        </div>

        {/* Photos */}
        {photosEnabled && (
          <div>
            <Label className="form-label">{t('Photos')}</Label>
            <PhotoAttachments
              pendingFiles={pendingPhotoFiles}
              onPendingFilesChange={setPendingPhotoFiles}
              existingPhotos={attachedPhotos}
              onRemoveExisting={(photoId) => {
                setAttachedPhotos((prev) => prev.filter((p) => p.id !== photoId));
                setRemovedPhotoIds((prev) => [...prev, photoId]);
              }}
              disabled={isSubmitting}
            />
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end space-x-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {t('Cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting || !normalizeFoodName(foodName)}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
            ) : null}
            {activity ? t('Update') : t('Save')}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default LogFoodTab;
