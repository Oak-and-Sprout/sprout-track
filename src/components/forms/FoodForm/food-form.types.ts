import { FoodResponse, FoodLogResponse } from '@/app/api/types';
import { FoodEntry } from '@/src/utils/foodMealComposer';

/**
 * Tab types for the FoodForm component
 */
export type FoodFormTab = 'log' | 'progress';

/**
 * Props for the FoodForm component
 */
export interface FoodFormProps {
  isOpen: boolean;
  onClose: () => void;
  babyId: string | undefined;
  initialTime: string;
  onSuccess?: () => void;
  /** Existing food log to edit; omit to log a new food try */
  activity?: FoodLogResponse;
}

/** Submit-related state LogFoodTab reports up for the FormPage footer buttons */
export interface LogFoodFormState {
  isSubmitting: boolean;
  canSubmit: boolean;
}

/**
 * Props for the LogFoodTab component
 */
export interface LogFoodTabProps {
  isOpen: boolean;
  babyId: string | undefined;
  initialTime: string;
  onSuccess?: () => void;
  refreshData: () => void;
  activity?: FoodLogResponse;
  /** Family food catalog, fetched by the parent form */
  foods: FoodResponse[];
  onFoodsUpdated: (foods: FoodResponse[]) => void;
  /** DOM id for the form element so the footer Save button can target it */
  formId: string;
  /** Reports submit state so the footer can disable its buttons */
  onFormStateChange: (state: LogFoodFormState) => void;
}

/**
 * Props for the ProgressTab component
 */
export interface ProgressTabProps {
  babyId: string | undefined;
  refreshTrigger: number;
  /** Called when a "View in log" link is followed, so the form can close. */
  onNavigate?: () => void;
}

/** Props for the entry box where one food is composed or a tag edited (#271). */
export interface FoodEntryBoxProps {
  /** Id for the name input, so the "Foods" label can target it */
  inputId: string;
  entry: FoodEntry;
  onChange: (entry: FoodEntry) => void;
  /** Family food catalog */
  foods: FoodResponse[];
  /** The meal's other foods, left out of the dropdown */
  excludeNames: string[];
  /** Name of the tag being edited; undefined while adding */
  editingName?: string;
  onSave: () => void;
  onCancelEdit: () => void;
  disabled: boolean;
}
