'use client';

import React, { useState, useEffect, useRef, useId } from 'react';
import { ChevronDown, Minus, Plus } from 'lucide-react';
import { FoodResponse } from '@/app/api/types';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Label } from '@/src/components/ui/label';
import { Checkbox } from '@/src/components/ui/checkbox';
import { useUnit } from '@/src/hooks/useUnit';
import { useLocalization } from '@/src/context/localization';
import { foodNameKey, isEnterKeyEvent } from '@/src/utils/foodLogUtils';
import { canSaveEntry, type FoodEntry } from '@/src/utils/foodMealComposer';
import { FoodEntryBoxProps } from './food-form.types';
import { foodEntryBox, foodStepperButton } from './food-form.styles';

/**
 * The bordered entry box of the Food Tracker (#271): one food is composed at
 * a time — name (catalog combobox or a new name), amount and unit — and Save
 * hands it to the meal. While a tag is being edited the box holds that food.
 */
const FoodEntryBox: React.FC<FoodEntryBoxProps> = ({
  inputId,
  entry,
  onChange,
  foods,
  excludeNames,
  editingName,
  onSave,
  onCancelEdit,
  disabled,
}) => {
  const { t } = useLocalization();
  const { unitSymbol } = useUnit();
  const uid = useId();
  const amountId = `${uid}-amount`;
  const allergenId = `${uid}-common-allergen`;
  const listId = `${uid}-options`;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const set = (patch: Partial<FoodEntry>) => onChange({ ...entry, ...patch });
  const search = entry.name.trim().toLowerCase();
  const excluded = new Set(excludeNames.map(foodNameKey));
  const options = foods.filter(food => !excluded.has(foodNameKey(food.name)) && food.name.toLowerCase().includes(search));
  const isNewFood = foodNameKey(entry.name) !== '' && !foods.some(food => foodNameKey(food.name) === foodNameKey(entry.name));
  const canSave = canSaveEntry(entry);
  const decimals = entry.unitAbbr === 'G' ? 0 : 1;
  const step = entry.unitAbbr === 'G' ? 5 : 0.5;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!dropdownRef.current?.contains(target) && !inputRef.current?.contains(target)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const closeDropdown = () => {
    setDropdownOpen(false);
    setHighlightedIndex(-1);
  };

  /** Picking a food only fills the name; Save adds it. */
  const selectFood = (food: FoodResponse) => {
    set({ name: food.name });
    closeDropdown();
    inputRef.current?.blur();
  };

  /** Save the box and release focus (the box clears for the next food). */
  const save = () => {
    closeDropdown();
    if (!canSave) return;
    onSave();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };

  const setAmount = (value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) set({ amount: value });
  };

  const stepAmount = (delta: number) => {
    const next = parseFloat(entry.amount || '0') + delta;
    if (next >= 0) set({ amount: next.toFixed(decimals) });
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setDropdownOpen(true);
      return;
    }
    switch (isEnterKeyEvent(e) ? 'Enter' : e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (dropdownOpen && highlightedIndex >= 0 && highlightedIndex < options.length) {
          selectFood(options[highlightedIndex]);
        } else {
          save();
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeDropdown();
        break;
      default:
        break;
    }
  };

  return (
    <div role="group" aria-label={t('Food entry')} className={foodEntryBox({ editing: !!editingName })}>
      {editingName && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-teal-700 food-entry-editing-hint">
            {t('Editing {food}').replace('{food}', editingName)}
          </p>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={onCancelEdit} disabled={disabled}>
            {t('Cancel')}
          </Button>
        </div>
      )}

      <div className="relative">
        <div className="flex items-center w-full">
          <Input
            ref={inputRef}
            id={inputId}
            value={entry.name}
            onChange={(e) => {
              set({ name: e.target.value });
              setHighlightedIndex(-1);
              setDropdownOpen(true);
            }}
            onFocus={() => setDropdownOpen(true)}
            onKeyDown={handleNameKeyDown}
            enterKeyHint="done"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={dropdownOpen && options.length > 0}
            aria-controls={listId}
            aria-activedescendant={dropdownOpen && highlightedIndex >= 0 ? `${listId}-${highlightedIndex}` : undefined}
            className="w-full pr-10 food-form-dropdown-trigger"
            placeholder={t('Search or add foods...')}
            disabled={disabled}
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
          >
            {options.length > 0 ? (
              <div id={listId} role="listbox" aria-label={t('Foods')} className="py-1">
                {options.map((food, index) => (
                  <div
                    key={food.id}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={highlightedIndex === index}
                    className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer food-dropdown-item ${
                      highlightedIndex === index ? 'bg-gray-100 food-dropdown-item-highlighted' : 'hover:bg-gray-100'
                    }`}
                    onClick={() => selectFood(food)}
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
                {isNewFood ? t('New food — it will be added to your list when saved') : t('No foods found')}
              </div>
            )}
          </div>
        )}
      </div>

      {isNewFood && (
        <div>
          <p className="text-xs text-gray-500 food-form-new-food-hint mb-2">
            {t('New food — it will be added to your list when saved')}
          </p>
          <div className="flex items-center gap-2">
            <Checkbox
              id={allergenId}
              checked={entry.commonAllergen}
              onCheckedChange={(checked: boolean) => set({ commonAllergen: checked })}
              disabled={disabled}
            />
            <Label className="form-label !mb-0" htmlFor={allergenId}>{t('Common allergen')}</Label>
          </div>
          <p className="text-xs text-gray-500 mt-1 food-form-helper-text">
            {t('Check this box if the food is a known common allergen (e.g. peanut, egg, milk, tree nuts, soy, wheat, fish, shellfish, sesame).')}
          </p>
        </div>
      )}

      <div>
        <Label className="form-label" htmlFor={amountId}>
          {t('Amount (')}{unitSymbol(entry.unitAbbr)})
        </Label>
        <div className="flex items-center justify-center">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => stepAmount(-step)}
            disabled={disabled}
            className={foodStepperButton}
            aria-label={t('Decrease amount')}
          >
            <Minus className="h-5 w-5 text-white" aria-hidden="true" />
          </Button>
          <Input
            id={amountId}
            type="text"
            value={entry.amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (isEnterKeyEvent(e)) {
                e.preventDefault();
                save();
              }
            }}
            enterKeyHint="done"
            className="w-24 mx-3 text-center"
            placeholder={t('Amount')}
            inputMode="decimal"
            disabled={disabled}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => stepAmount(step)}
            disabled={disabled}
            className={foodStepperButton}
            aria-label={t('Increase amount')}
          >
            <Plus className="h-5 w-5 text-white" aria-hidden="true" />
          </Button>
        </div>
        <div className="mt-3 flex space-x-2">
          {(['TBSP', 'G'] as const).map(unitAbbr => (
            <Button
              key={unitAbbr}
              type="button"
              variant={entry.unitAbbr === unitAbbr ? 'default' : 'outline'}
              className="w-full"
              onClick={() => set({ unitAbbr })}
              disabled={disabled}
              aria-pressed={entry.unitAbbr === unitAbbr}
            >
              {unitAbbr === 'TBSP' ? t('tbsp') : t('g')}
            </Button>
          ))}
        </div>
      </div>

      <Button type="button" className="w-full" onClick={save} disabled={!canSave || disabled}>
        {t('Save')}
      </Button>
    </div>
  );
};

export default FoodEntryBox;
