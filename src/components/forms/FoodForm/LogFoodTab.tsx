'use client';

import React, { useState, useEffect, useId } from 'react';
import { LogFoodTabProps } from './food-form.types';
import { foodTagVariants, foodTagEditButton, foodMealTotal } from './food-form.styles';
import FoodEntryBox from './FoodEntryBox';
import { FoodResponse, FoodLogCreate, FoodLogItemInput } from '@/app/api/types';
import { DateTimePicker } from '@/src/components/ui/date-time-picker';
import { Textarea } from '@/src/components/ui/textarea';
import { Button } from '@/src/components/ui/button';
import { Label } from '@/src/components/ui/label';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Switch } from '@/src/components/ui/switch';
import { PhotoAttachments } from '@/src/components/ui/photo-attachments';
import { uploadPhotos, linkPhoto, unlinkPhoto, fetchPhotos, fetchPhotosEnabled } from '@/src/utils/photoClientApi';
import { TriangleAlert, X } from 'lucide-react';
import { useUnit } from '@/src/hooks/useUnit';
import { useTimezone } from '@/app/context/timezone';
import { useToast } from '@/src/components/ui/toast';
import { handleExpirationError } from '@/src/lib/expiration-error-handler';
import { useLocalization } from '@/src/context/localization';
import {
  normalizeFoodName,
  foodNameKey,
  expandFoodItems,
  buildMealItems,
  mealHasAnyReaction,
  isValidEnjoyment,
  type MealTagInput,
  FOOD_ENJOYMENT_VALUES,
  FOOD_ENJOYMENT_DISPLAY_ORDER,
  FOOD_ENJOYMENT_LABELS,
  FOOD_ENJOYMENT_ICON_SRC,
  FoodEnjoymentValue,
} from '@/src/utils/foodLogUtils';
import {
  formatFoodTagAmount,
  formatMealTotal,
  canSaveEntry,
  clearEntry,
  loadEntry,
  commitEntry,
  removeFood,
  editingAfterRemove,
  seedMealAmounts,
  mealRowAmount,
  withSingleFoodReaction,
  type FoodAmountDraft,
  type FoodEntry,
  type MealFood,
} from '@/src/utils/foodMealComposer';

/**
 * LogFoodTab Component
 *
 * Tab for logging a new food try or editing an existing food log entry.
 * Foods are composed one at a time in the entry box (#271) and saved as tags
 * above it; tapping a tag loads it back into the box for editing. Enjoyment,
 * notes and photos are meal-level; reactions are per food.
 */
const LogFoodTab: React.FC<LogFoodTabProps> = ({
  isOpen,
  babyId,
  initialTime,
  onSuccess,
  refreshData,
  activity,
  foods,
  onFoodsUpdated,
  formId,
  onFormStateChange,
}) => {
  const { t } = useLocalization();
  const { unitSymbol } = useUnit();
  const uid = useId();
  const foodNameId = `${uid}-food-name`;
  const notesId = `${uid}-notes`;
  const { toUTCString } = useTimezone();
  const { showToast } = useToast();

  const [selectedDateTime, setSelectedDateTime] = useState<Date>(() => {
    const d = new Date(activity ? activity.time : initialTime);
    return isNaN(d.getTime()) ? new Date() : d;
  });
  const [selectedFoods, setSelectedFoods] = useState<MealFood[]>([]);
  /** The entry box, and the tag it is editing (null while adding a food). */
  const [entry, setEntry] = useState<FoodEntry>({ name: '', amount: '', unitAbbr: 'TBSP', commonAllergen: false });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  /** A pre-#271 multi-food entry's single meal amount (no food has its own). */
  const [sharedAmount, setSharedAmount] = useState<FoodAmountDraft | null>(null);
  const [enjoyment, setEnjoyment] = useState<FoodEnjoymentValue | null>(null);
  const [hadReaction, setHadReaction] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const [photosEnabled, setPhotosEnabled] = useState(false);
  const [pendingPhotoFiles, setPendingPhotoFiles] = useState<File[]>([]);
  const [attachedPhotos, setAttachedPhotos] = useState<{ id: string; caption: string | null }[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);

  useEffect(() => { fetchPhotosEnabled().then(setPhotosEnabled); }, []);

  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    fetch('/api/settings', {
      cache: 'no-store',
      headers: { 'Authorization': authToken ? `Bearer ${authToken}` : '' },
    })
      .then(response => (response.ok ? response.json() : null))
      .then(data => {
        const defaultSolidsUnit = data?.success && data.data?.defaultSolidsUnit ? data.data.defaultSolidsUnit : 'TBSP';
        if (!activity?.unitAbbr) {
          setEntry(prev => ({ ...prev, unitAbbr: defaultSolidsUnit }));
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /** Form-state details for a stored item; a food without its own unit starts on the box's. */
  const itemDetailsFrom = (item: { amount?: number | null; unitAbbr?: string | null; enjoyment?: string | null }) => ({
    amount: item.amount != null ? String(item.amount) : '',
    unitAbbr: item.unitAbbr || entry.unitAbbr,
    enjoyment: isValidEnjoyment(item.enjoyment) ? item.enjoyment : null,
  });

  const tagsFromActivity = (): MealFood[] => {
    if (!activity) return [];
    if (activity.foodItems && activity.foodItems.length > 0) {
      return activity.foodItems.map(item => ({
        foodId: item.foodId,
        name: item.name || foods.find(f => f.id === item.foodId)?.name || item.foodId,
        commonAllergen: item.commonAllergen === true,
        isNew: false,
        hadReaction: item.hadReaction === true,
        reactionDescription: item.reactionDescription || '',
        ...itemDetailsFrom(item),
      }));
    }
    const items = expandFoodItems(activity);
    if (items.length > 0) {
      return items.map(item => ({
        foodId: item.foodId,
        name:
          (activity.food?.id === item.foodId ? activity.food.name : undefined) ||
          foods.find(f => f.id === item.foodId)?.name ||
          item.foodId,
        commonAllergen: activity.food?.id === item.foodId ? activity.food.commonAllergen : false,
        isNew: false,
        hadReaction: item.hadReaction === true,
        reactionDescription: item.reactionDescription || '',
        ...itemDetailsFrom(item),
      }));
    }
    if (activity.food) {
      return [{
        foodId: activity.food.id,
        name: activity.food.name,
        commonAllergen: activity.food.commonAllergen,
        isNew: false,
        hadReaction: activity.hadReaction === true,
        reactionDescription: activity.reactionDescription || '',
        ...itemDetailsFrom({}),
      }];
    }
    return [];
  };

  /** Box back to empty, nothing being edited. */
  const resetEntry = () => {
    setEntry(clearEntry);
    setEditingIndex(null);
  };

  useEffect(() => {
    if (isOpen && !isInitialized) {
      if (activity) {
        // The box starts empty; a single food's row amount moves onto its tag
        const { meal, shared } = seedMealAmounts(tagsFromActivity(), {
          amount: activity.amount != null ? activity.amount.toString() : '',
          unitAbbr: activity.unitAbbr || entry.unitAbbr,
        });
        setSelectedFoods(meal);
        setSharedAmount(shared);
        if (activity.unitAbbr) {
          setEntry(prev => ({ ...prev, unitAbbr: activity.unitAbbr as string }));
        }
        setEnjoyment(
          FOOD_ENJOYMENT_VALUES.includes(activity.enjoyment as FoodEnjoymentValue)
            ? (activity.enjoyment as FoodEnjoymentValue)
            : null
        );
        // Each tag already carries its own description (tagsFromActivity resolves
        // it from foodItems, the foods JSON, or the legacy row-level field).
        setHadReaction(meal.some(tag => tag.hadReaction) || activity.hadReaction === true);
        setNotes(activity.notes || '');
        const d = new Date(activity.time);
        if (!isNaN(d.getTime())) {
          setSelectedDateTime(d);
        }
      } else {
        try {
          const date = new Date(initialTime);
          if (!isNaN(date.getTime())) {
            setSelectedDateTime(date);
          }
        } catch (error) {
          console.error('Error parsing initialTime:', error);
        }
      }

      setIsInitialized(true);
    } else if (!isOpen) {
      setIsInitialized(false);
      resetEntry();
      setPendingPhotoFiles([]);
      setRemovedPhotoIds([]);
    }
  }, [isOpen, activity, initialTime]);

  useEffect(() => {
    setIsInitialized(false);
  }, [activity?.id]);

  useEffect(() => {
    onFormStateChange({ isSubmitting, canSubmit: selectedFoods.length > 0 || canSaveEntry(entry) });
  }, [isSubmitting, selectedFoods.length, entry, onFormStateChange]);

  // Shown next to the Foods label; a pre-#271 meal's shared amount when no food has its own
  const mealTotal = formatMealTotal(selectedFoods) ||
    (selectedFoods.length > 1 && sharedAmount ? formatFoodTagAmount(sharedAmount, unitSymbol) : '');

  /** The meal with the box saved into it (unchanged when the box is empty). */
  const mealWithEntry = () => withSingleFoodReaction(commitEntry(selectedFoods, entry, editingIndex, foods), hadReaction);

  const saveEntry = () => {
    setSelectedFoods(mealWithEntry());
    resetEntry();
  };

  /** Load a tag into the box; tapping the tag being edited again cancels. */
  const editFoodTag = (index: number) => {
    if (index === editingIndex) return resetEntry();
    setEntry(loadEntry(selectedFoods, index));
    setEditingIndex(index);
  };

  const removeFoodTag = (index: number) => {
    const { meal: next, shared } = removeFood(selectedFoods, index, sharedAmount);
    // Removing the only food that reacted leaves the meal-level switch on with
    // nothing behind it — and, at one food, showing a description box that
    // would be discarded on save. Turn it off so the form states the truth.
    if (!next.some(tag => tag.hadReaction)) setHadReaction(false);
    // Back to one food: a single-food entry stores enjoyment on the meal
    if (next.length === 1 && next[0].enjoyment) setEnjoyment(next[0].enjoyment);
    setSelectedFoods(next);
    setSharedAmount(shared);
    if (index === editingIndex) resetEntry();
    else setEditingIndex(editingAfterRemove(editingIndex, index));
  };

  const toggleFoodReaction = (index: number, checked: boolean) => {
    setSelectedFoods(prev =>
      prev.map((tag, i) => (i === index ? { ...tag, hadReaction: checked } : tag))
    );
  };

  const setFoodReactionDescription = (index: number, value: string) => {
    setSelectedFoods(prev =>
      prev.map((tag, i) => (i === index ? { ...tag, reactionDescription: value } : tag))
    );
  };

  const resolveFoodId = async (
    tag: MealFood,
    authToken: string | null,
    catalog: FoodResponse[]
  ): Promise<{ foodId: string; catalog: FoodResponse[] } | null> => {
    if (tag.foodId) return { foodId: tag.foodId, catalog };
    const name = normalizeFoodName(tag.name);
    if (!name) return null;

    const existing = catalog.find(food => foodNameKey(food.name) === foodNameKey(name));
    if (existing) return { foodId: existing.id, catalog };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': authToken ? `Bearer ${authToken}` : '',
    };

    const createResponse = await fetch('/api/food', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, commonAllergen: tag.commonAllergen }),
    });

    if (createResponse.ok) {
      const result = await createResponse.json();
      if (result.success && result.data) {
        const nextCatalog = [...catalog, result.data];
        return { foodId: result.data.id, catalog: nextCatalog };
      }
    }

    const listResponse = await fetch('/api/food', { headers });
    if (listResponse.ok) {
      const result = await listResponse.json();
      if (result.success && Array.isArray(result.data)) {
        const found = (result.data as FoodResponse[]).find(
          food => foodNameKey(food.name) === foodNameKey(name)
        );
        if (found) return { foodId: found.id, catalog: result.data };
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // A food still in the box is saved too, so nothing typed is silently lost
    const tagsToSave = mealWithEntry();
    if (!babyId || tagsToSave.length === 0) return;

    if (!selectedDateTime || isNaN(selectedDateTime.getTime())) {
      console.error('Required fields missing: valid date time');
      return;
    }

    setIsSubmitting(true);

    try {
      const authToken = localStorage.getItem('authToken');
      let catalog = foods;

      setSelectedFoods(tagsToSave);
      resetEntry();
      const resolvedTags: MealTagInput[] = [];
      for (const tag of tagsToSave) {
        const resolved = await resolveFoodId(tag, authToken, catalog);
        if (!resolved) {
          showToast({
            variant: 'error',
            title: t('Error'),
            message: t('Failed to save food record'),
            duration: 5000,
          });
          return;
        }
        catalog = resolved.catalog;
        resolvedTags.push({
          foodId: resolved.foodId,
          hadReaction: tag.hadReaction,
          reactionDescription: tag.reactionDescription,
          amount: parseFloat(tag.amount),
          unitAbbr: tag.unitAbbr,
          enjoyment: tag.enjoyment,
        });
      }

      // Each food carries its own reaction; the meal-level switch can only
      // suppress, never invent one (see buildMealItems).
      const resolvedItems: FoodLogItemInput[] = buildMealItems({
        tags: resolvedTags,
        mealReaction: hadReaction,
      });
      // The switch was left on without flagging a food — clear it so the form
      // reflects what was actually saved.
      if (hadReaction && !mealHasAnyReaction(resolvedItems)) setHadReaction(false);

      onFoodsUpdated(catalog);

      // One food: its own amount; several: derived server-side from the per-food amounts
      const rowAmount = mealRowAmount(tagsToSave, sharedAmount);

      const payload: FoodLogCreate = {
        babyId,
        foods: resolvedItems,
        time: toUTCString(selectedDateTime) || selectedDateTime.toISOString(),
        amount: rowAmount?.amount ?? null,
        unitAbbr: rowAmount?.unitAbbr ?? null,
        enjoyment: enjoyment as FoodLogCreate['enjoyment'],
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

      if (!activity) {
        setSelectedFoods([]);
        setSharedAmount(null);
        setEnjoyment(null);
        setHadReaction(false);
        setNotes('');
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
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label className="form-label">{t('Date & Time')}</Label>
          <DateTimePicker
            value={selectedDateTime}
            onChange={setSelectedDateTime}
            disabled={isSubmitting}
            placeholder={t("Select food time...")}
          />
        </div>

        <div>
          <Label className="form-label" htmlFor={foodNameId}>
            {t('Foods')}
            {mealTotal && <span className={foodMealTotal}> · {t('{total} total').replace('{total}', mealTotal)}</span>}
          </Label>
          {selectedFoods.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedFoods.map((tag, index) => {
                  const isEditing = index === editingIndex;
                  const tagAmount = formatFoodTagAmount(tag, unitSymbol);
                  return (
                    <span key={`${tag.foodId || tag.name}-${index}`} className={foodTagVariants({ selected: isEditing })}>
                      <button
                        type="button"
                        onClick={() => editFoodTag(index)}
                        className={foodTagEditButton}
                        aria-pressed={isEditing}
                        aria-label={`${t('Edit')} ${tag.name}${tagAmount ? `, ${tagAmount}` : ''}`}
                        disabled={isSubmitting}
                      >
                        {tag.name}
                        {tagAmount && <span className="font-medium">{tagAmount}</span>}
                      </button>
                      {tag.commonAllergen && (
                        <span className="text-amber-700 text-xs food-selected-tag-allergen">({t('Allergen')})</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFoodTag(index)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-teal-200 food-selected-tag-remove"
                        aria-label={`${t('Remove')} ${tag.name}`}
                        disabled={isSubmitting}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </span>
                  );
                })}
              </div>
              {editingIndex === null && (
                <p className="text-xs text-gray-500 mb-2 food-form-helper-text">{t('Tap a food to edit it')}</p>
              )}
            </>
          )}
          <FoodEntryBox
            inputId={foodNameId}
            entry={entry}
            onChange={setEntry}
            foods={foods}
            excludeNames={selectedFoods.filter((_, i) => i !== editingIndex).map(tag => tag.name)}
            editingName={editingIndex !== null ? selectedFoods[editingIndex]?.name : undefined}
            onSave={saveEntry}
            onCancelEdit={resetEntry}
            disabled={isSubmitting}
          />
        </div>

        <div>
          <Label className="form-label">{t('Enjoyment')}</Label>
          <div className="grid grid-cols-5 gap-1" role="group" aria-label={t('Enjoyment')}>
            {FOOD_ENJOYMENT_DISPLAY_ORDER.map((value) => (
              <Button
                key={value}
                type="button"
                variant="ghost"
                className={`group px-1 py-1 h-16 ${enjoyment === value ? 'bg-teal-100 food-enjoyment-selected' : ''}`}
                onClick={() => setEnjoyment(prev => (prev === value ? null : value))}
                disabled={isSubmitting}
                aria-pressed={enjoyment === value}
                aria-label={t(FOOD_ENJOYMENT_LABELS[value])}
                title={t(FOOD_ENJOYMENT_LABELS[value])}
              >
                <img
                  src={FOOD_ENJOYMENT_ICON_SRC[value]}
                  alt=""
                  aria-hidden="true"
                  className="h-14 w-14 transition-all duration-200 group-hover:scale-110 group-hover:drop-shadow-lg"
                />
              </Button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label className="form-label !mb-0 flex items-center gap-1.5">
              <TriangleAlert aria-hidden="true" className="h-4 w-4 text-amber-500" />
              {t('Reaction occurred')}
            </Label>
            <Switch
              checked={hadReaction}
              onCheckedChange={(checked) => {
                setHadReaction(checked);
                if (!checked) {
                  setSelectedFoods(prev =>
                    prev.map(tag => ({ ...tag, hadReaction: false, reactionDescription: '' }))
                  );
                } else if (selectedFoods.length === 1) {
                  setSelectedFoods(prev =>
                    prev.map(tag => ({ ...tag, hadReaction: true }))
                  );
                }
              }}
              disabled={isSubmitting}
              aria-label={t('Reaction occurred')}
            />
          </div>
          {/* Single food: the meal-level textarea is that food's own input surface,
              so it writes straight through to the tag — the tag stays the only
              source of truth for what gets saved. */}
          {hadReaction && selectedFoods.length === 1 && (
            <div className="mt-2">
              <Label className="form-label" htmlFor={`${uid}-reaction-description`}>{t('Describe the reaction')}</Label>
              <Textarea
                id={`${uid}-reaction-description`}
                value={selectedFoods[0].reactionDescription}
                onChange={(e) => setFoodReactionDescription(0, e.target.value)}
                className="w-full min-h-[60px]"
                placeholder={t("Redness, swelling, hives...")}
                disabled={isSubmitting}
              />
            </div>
          )}
          {hadReaction && selectedFoods.length > 1 && (
            <div className="mt-3">
              <p className="text-xs text-gray-500 food-form-helper-text">{t('Select which food(s) caused a reaction')}</p>
              {selectedFoods.map((tag, index) => (
                <div key={`${tag.foodId || tag.name}-reaction-${index}`} className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`${uid}-react-${index}`}
                      checked={tag.hadReaction}
                      onCheckedChange={(checked: boolean) => toggleFoodReaction(index, checked)}
                      disabled={isSubmitting}
                    />
                    <Label className="form-label !mb-0" htmlFor={`${uid}-react-${index}`}>{tag.name}</Label>
                  </div>
                  {tag.hadReaction && (
                    <Textarea
                      value={tag.reactionDescription}
                      onChange={(e) => setFoodReactionDescription(index, e.target.value)}
                      className="w-full min-h-[60px]"
                      placeholder={t("Redness, swelling, hives...")}
                      disabled={isSubmitting}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

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
      </form>
    </div>
  );
};

export default LogFoodTab;
