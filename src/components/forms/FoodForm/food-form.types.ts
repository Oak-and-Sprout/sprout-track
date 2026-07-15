import { FoodResponse, FoodLogResponse } from '@/app/api/types';

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
}
