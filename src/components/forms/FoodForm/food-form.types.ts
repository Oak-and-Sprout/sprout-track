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

/**
 * Props for the LogFoodTab component
 */
export interface LogFoodTabProps {
  babyId: string | undefined;
  initialTime: string;
  onSuccess?: () => void;
  onClose: () => void;
  refreshData: () => void;
  activity?: FoodLogResponse;
  /** Family food catalog, fetched by the parent form */
  foods: FoodResponse[];
  onFoodsUpdated: (foods: FoodResponse[]) => void;
}

/**
 * Props for the ProgressTab component
 */
export interface ProgressTabProps {
  babyId: string | undefined;
  refreshTrigger: number;
}
