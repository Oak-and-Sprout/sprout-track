'use client';

import React, { useState, useEffect, useRef, useId } from 'react';
import { LogFoodTabProps } from './food-form.types';
import { FoodResponse, FoodLogCreate, FoodLogItemInput } from '@/app/api/types';
import { DateTimePicker } from '@/src/components/ui/date-time-picker';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Button } from '@/src/components/ui/button';
import { Label } from '@/src/components/ui/label';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Switch } from '@/src/components/ui/switch';
import { PhotoAttachments } from '@/src/components/ui/photo-attachments';
import { uploadPhotos, linkPhoto, unlinkPhoto, fetchPhotos, fetchPhotosEnabled } from '@/src/utils/photoClientApi';
import { ChevronDown, Minus, Plus, TriangleAlert, X } from 'lucide-react';
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
  type MealTagInput,
  FOOD_ENJOYMENT_VALUES,
  FOOD_ENJOYMENT_DISPLAY_ORDER,
  FOOD_ENJOYMENT_LABELS,
  FOOD_ENJOYMENT_ICON_SRC,
  FoodEnjoymentValue,
} from '@/src/utils/foodLogUtils';

/** One selected food chip in the multi-food meal logger (#247). */
interface SelectedFoodTag {
  /** Catalog id when known; undefined for a new name not yet created. */
  foodId?: string;
  name: string;
  commonAllergen: boolean;
  isNew: boolean;
  hadReaction: boolean;
  reactionDescription: string;
}

/**
 * LogFoodTab Component
 *
 * Tab for logging a new food try or editing an existing food log entry.
 * Multi-food meals use a tag selector over the family catalog (#247); amount,
 * enjoyment, notes, and photos are meal-level; reactions are per food.
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
  const amountId = `${uid}-amount`;
  const allergenId = `${uid}-common-allergen`;
  const notesId = `${uid}-notes`;
  const { toUTCString } = useTimezone();
  const { showToast } = useToast();

  const [selectedDateTime, setSelectedDateTime] = useState<Date>(() => {
    const d = new Date(activity ? activity.time : initialTime);
    return isNaN(d.getTime()) ? new Date() : d;
  });
  const [selectedFoods, setSelectedFoods] = useState<SelectedFoodTag[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [commonAllergen, setCommonAllergen] = useState(false);
  const [allergenTouched, setAllergenTouched] = useState(false);
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('TBSP');
  const [enjoyment, setEnjoyment] = useState<FoodEnjoymentValue | null>(null);
  const [hadReaction, setHadReaction] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const [photosEnabled, setPhotosEnabled] = useState(false);
  const [pendingPhotoFiles, setPendingPhotoFiles] = useState<File[]>([]);
  const [attachedPhotos, setAttachedPhotos] = useState<{ id: string; caption: string | null }[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const matchedSearchFood: FoodResponse | undefined = foods.find(
    food => foodNameKey(food.name) === foodNameKey(searchTerm)
  );
  const isNewSearchFood = foodNameKey(searchTerm) !== '' && !matchedSearchFood;

  const filteredFoods = searchTerm.trim() === ''
    ? foods.filter(food => !selectedFoods.some(s => s.foodId === food.id || foodNameKey(s.name) === foodNameKey(food.name)))
    : foods.filter(
        food =>
          food.name.toLowerCase().includes(searchTerm.trim().toLowerCase()) &&
          !selectedFoods.some(s => s.foodId === food.id || foodNameKey(s.name) === foodNameKey(food.name))
      );

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
          setUnit(defaultSolidsUnit);
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

  const tagsFromActivity = (): SelectedFoodTag[] => {
    if (!activity) return [];
    if (activity.foodItems && activity.foodItems.length > 0) {
      return activity.foodItems.map(item => ({
        foodId: item.foodId,
        name: item.name || foods.find(f => f.id === item.foodId)?.name || item.foodId,
        commonAllergen: item.commonAllergen === true,
        isNew: false,
        hadReaction: item.hadReaction === true,
        reactionDescription: item.reactionDescription || '',
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
      }];
    }
    return [];
  };

  useEffect(() => {
    if (isOpen && !isInitialized) {
      if (activity) {
        const tags = tagsFromActivity();
        setSelectedFoods(tags);
        setAmount(activity.amount != null ? activity.amount.toString() : '');
        if (activity.unitAbbr) {
          setUnit(activity.unitAbbr);
        }
        setEnjoyment(
          FOOD_ENJOYMENT_VALUES.includes(activity.enjoyment as FoodEnjoymentValue)
            ? (activity.enjoyment as FoodEnjoymentValue)
            : null
        );
        // Each tag already carries its own description (tagsFromActivity resolves
        // it from foodItems, the foods JSON, or the legacy row-level field).
        setHadReaction(tags.some(tag => tag.hadReaction) || activity.hadReaction === true);
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
      setPendingPhotoFiles([]);
      setRemovedPhotoIds([]);
      setSearchTerm('');
    }
  }, [isOpen, activity, initialTime]);

  useEffect(() => {
    setIsInitialized(false);
  }, [activity?.id]);

  useEffect(() => {
    onFormStateChange({ isSubmitting, canSubmit: selectedFoods.length > 0 });
  }, [isSubmitting, selectedFoods.length, onFormStateChange]);

  useEffect(() => {
    if (isNewSearchFood && !allergenTouched) {
      setCommonAllergen(false);
    }
  }, [isNewSearchFood, allergenTouched]);

  const amountStep = unit === 'G' ? 5 : 0.5;

  const handleAmountChange = (newAmount: string) => {
    if (newAmount === '' || /^\d*\.?\d*$/.test(newAmount)) {
      setAmount(newAmount);
    }
  };

  const incrementAmount = () => {
    const current = parseFloat(amount || '0');
    setAmount((current + amountStep).toFixed(unit === 'G' ? 0 : 1));
  };

  const decrementAmount = () => {
    const current = parseFloat(amount || '0');
    if (current >= amountStep) {
      setAmount((current - amountStep).toFixed(unit === 'G' ? 0 : 1));
    }
  };

  const addFoodTag = (tag: SelectedFoodTag) => {
    setSelectedFoods(prev => {
      if (prev.some(s => foodNameKey(s.name) === foodNameKey(tag.name))) return prev;
      return [...prev, tag];
    });
    setSearchTerm('');
    setDropdownOpen(false);
    setHighlightedIndex(-1);
    setAllergenTouched(false);
    setCommonAllergen(false);
  };

  const handleFoodSelect = (food: FoodResponse) => {
    addFoodTag({
      foodId: food.id,
      name: food.name,
      commonAllergen: food.commonAllergen,
      isNew: false,
      hadReaction: false,
      reactionDescription: '',
    });
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const addNewFoodFromSearch = () => {
    const name = normalizeFoodName(searchTerm);
    if (!name) return;
    if (matchedSearchFood) {
      handleFoodSelect(matchedSearchFood);
      return;
    }
    addFoodTag({
      name,
      commonAllergen,
      isNew: true,
      hadReaction: false,
      reactionDescription: '',
    });
  };

  const removeFoodTag = (index: number) => {
    setSelectedFoods(prev => {
      const next = prev.filter((_, i) => i !== index);
      // Removing the only food that reacted leaves the meal-level switch on with
      // nothing behind it — and, at one food, showing a description box that
      // would be discarded on save. Turn it off so the form states the truth.
      if (!next.some(tag => tag.hadReaction)) setHadReaction(false);
      return next;
    });
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

  const handleFoodInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setHighlightedIndex(-1);
    setDropdownOpen(true);
  };

  const handleFoodKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && searchTerm === '' && selectedFoods.length > 0) {
      removeFoodTag(selectedFoods.length - 1);
      return;
    }

    if (!dropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setDropdownOpen(true);
      e.preventDefault();
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
        } else if (normalizeFoodName(searchTerm)) {
          addNewFoodFromSearch();
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

  const resolveFoodId = async (
    tag: SelectedFoodTag,
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
    if (!babyId || selectedFoods.length === 0) return;

    if (!selectedDateTime || isNaN(selectedDateTime.getTime())) {
      console.error('Required fields missing: valid date time');
      return;
    }

    setIsSubmitting(true);

    try {
      const authToken = localStorage.getItem('authToken');
      let catalog = foods;

      const resolvedTags: MealTagInput[] = [];
      for (const tag of selectedFoods) {
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

      const parsedAmount = parseFloat(amount);
      const hasAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;

      const payload: FoodLogCreate = {
        babyId,
        foods: resolvedItems,
        time: toUTCString(selectedDateTime) || selectedDateTime.toISOString(),
        amount: hasAmount ? parsedAmount : null,
        unitAbbr: hasAmount ? unit : null,
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
        setSearchTerm('');
        setAmount('');
        setEnjoyment(null);
        setHadReaction(false);
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
          <Label className="form-label" htmlFor={foodNameId}>{t('Foods')}</Label>
          {selectedFoods.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedFoods.map((tag, index) => (
                <span
                  key={`${tag.foodId || tag.name}-${index}`}
                  className="inline-flex items-center gap-1 rounded-full bg-teal-100 text-teal-800 px-2.5 py-1 text-sm food-selected-tag"
                >
                  {tag.name}
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
              ))}
            </div>
          )}
          <div className="relative">
            <div className="relative w-full">
              <div className="flex items-center w-full">
                <Input
                  ref={inputRef}
                  id={foodNameId}
                  value={searchTerm}
                  onChange={handleFoodInputChange}
                  onFocus={() => setDropdownOpen(true)}
                  onKeyDown={handleFoodKeyDown}
                  className="w-full pr-10 food-form-dropdown-trigger"
                  placeholder={t('Search or add foods...')}
                  disabled={isSubmitting}
                />
                <ChevronDown
                  aria-hidden="true"
                  className="absolute right-3 h-4 w-4 text-gray-500 food-form-dropdown-icon"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
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
                    <div
                      className="px-3 py-2 text-sm text-gray-500 food-dropdown-no-match cursor-pointer hover:bg-gray-50"
                      onClick={() => normalizeFoodName(searchTerm) && addNewFoodFromSearch()}
                    >
                      {searchTerm.trim() !== ''
                        ? `${t('New food — it will be added to your list when saved')}`
                        : t('No foods found')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {isNewSearchFood && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 food-form-new-food-hint mb-2">
                {t('New food — it will be added to your list when saved')}
              </p>
              <div className="flex items-center gap-2">
                <Checkbox
                  id={allergenId}
                  checked={commonAllergen}
                  onCheckedChange={(checked: boolean) => {
                    setAllergenTouched(true);
                    setCommonAllergen(checked);
                  }}
                  disabled={isSubmitting}
                />
                <Label className="form-label !mb-0" htmlFor={allergenId}>{t('Common allergen')}</Label>
              </div>
              <p className="text-xs text-gray-500 mt-1 food-form-helper-text">
                {t('Check this box if the food is a known common allergen (e.g. peanut, egg, milk, tree nuts, soy, wheat, fish, shellfish, sesame).')}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={addNewFoodFromSearch}
                disabled={isSubmitting}
              >
                {t('Add food')}
              </Button>
            </div>
          )}
        </div>

        <div>
          <Label className="form-label" htmlFor={amountId}>{t('Amount (')}{unitSymbol(unit)})</Label>
          <div className="flex items-center justify-center mb-4">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={decrementAmount}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-teal-600 to-emerald-600 border-0 rounded-full h-14 w-14 flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              aria-label={t('Decrease amount')}
            >
              <Minus className="h-5 w-5 text-white" aria-hidden="true" />
            </Button>
            <Input
              id={amountId}
              type="text"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="w-24 mx-3 text-center"
              placeholder={t("Amount")}
              inputMode="decimal"
              disabled={isSubmitting}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={incrementAmount}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-teal-600 to-emerald-600 border-0 rounded-full h-14 w-14 flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              aria-label={t('Increase amount')}
            >
              <Plus className="h-5 w-5 text-white" aria-hidden="true" />
            </Button>
          </div>
          <div className="mt-2 flex space-x-2">
            <Button
              type="button"
              variant={unit === 'TBSP' ? 'default' : 'outline'}
              className="w-full"
              onClick={() => setUnit('TBSP')}
              disabled={isSubmitting}
            >
              {t('tbsp')}
            </Button>
            <Button
              type="button"
              variant={unit === 'G' ? 'default' : 'outline'}
              className="w-full"
              onClick={() => setUnit('G')}
              disabled={isSubmitting}
            >
              {t('g')}
            </Button>
          </div>
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
