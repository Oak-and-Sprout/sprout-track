import { VaccineLogResponse } from '@/app/api/types';

/**
 * Tab types for the VaccineForm component
 */
export type VaccineFormTab = 'record' | 'history';

/**
 * Props for the VaccineForm component
 */
export interface VaccineFormProps {
  isOpen: boolean;
  onClose: () => void;
  babyId: string | undefined;
  initialTime: string;
  onSuccess?: () => void;
  activity?: VaccineLogResponse;
}

/**
 * Props for the RecordVaccineTab component
 */
export interface RecordVaccineTabProps {
  babyId: string | undefined;
  initialTime: string;
  onSuccess?: () => void;
  onClose: () => void;
  refreshData: () => void;
  activity?: VaccineLogResponse;
}

/**
 * Props for the VaccineHistoryTab component
 */
export interface VaccineHistoryTabProps {
  babyId: string | undefined;
  refreshTrigger: number;
}
