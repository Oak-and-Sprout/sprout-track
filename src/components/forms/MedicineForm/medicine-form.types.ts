import { Medicine, MedicineLog } from '@prisma/client';

/**
 * Tab types for the MedicineForm component
 */
export type MedicineFormTab = 'active-doses' | 'manage-medicines' | 'supplements';

/**
 * Props for the MedicineForm component
 */
export interface MedicineFormProps {
  /**
   * Whether the form is open
   */
  isOpen: boolean;
  
  /**
   * Function to call when the form should be closed
   */
  onClose: () => void;
  
  /**
   * The ID of the baby for whom medicine is being administered
   */
  babyId: string | undefined;
  
  /**
   * Initial time for the medicine log entry
   */
  initialTime: string;
  
  /**
   * Optional callback function to call when a medicine log is successfully created or updated
   */
  onSuccess?: () => void;
  
  /**
   * Optional medicine activity for editing
   */
  activity?: any;
}

/**
 * Props for the ActiveDosesTab component
 */
export interface ActiveDosesTabProps {
  /**
   * The ID of the baby for whom to show active doses
   */
  babyId: string | undefined;
  
  /**
   * Function to refresh the active doses data
   */
  refreshData: () => void;
  
  /**
   * Function to open the Give Medicine form
   */
  onGiveMedicine?: () => void;

  /**
   * Function to open the Give Supplement form
   */
  onGiveSupplement?: () => void;

  /**
   * Trigger value that changes when data should be refreshed
   */
  refreshTrigger?: number;
}

/**
 * Props for the GiveMedicineTab component
 */
export interface GiveMedicineTabProps {
  /**
   * The ID of the baby for whom medicine is being administered
   */
  babyId: string | undefined;
  
  /**
   * Initial time for the medicine log entry
   */
  initialTime: string;
  
  /**
   * Optional callback function to call when a medicine log is successfully created or updated
   */
  onSuccess?: () => void;
  
  /**
   * Function to refresh the active doses data
   */
  refreshData: () => void;
  
  /**
   * Function to set the submitting state in the parent component
   */
  setIsSubmitting?: React.Dispatch<React.SetStateAction<boolean>>;

  /**
   * Optional existing medicine log activity for editing
   */
  activity?: any;
}

/**
 * Props for the ManageMedicinesTab component
 */
export interface ManageMedicinesTabProps {
  /**
   * Function to refresh the medicines data
   */
  refreshData: () => void;
}

/**
 * Props for the ManageSupplementsTab component
 */
export interface ManageSupplementsTabProps {
  /**
   * Function to refresh the supplements data
   */
  refreshData: () => void;

  /**
   * Function to open the Give Supplement form
   */
  onGiveSupplement?: () => void;
}

/**
 * Medicine data with related contact information
 */
export interface MedicineWithContacts extends Medicine {
  contacts: {
    contact: {
      id: string;
      name: string;
      role: string;
    };
  }[];
  unit?: {
    unitAbbr: string;
    unitName: string;
  } | null;
}

/**
 * Medicine log data with related medicine information
 */
export interface MedicineLogWithDetails extends MedicineLog {
  medicine: MedicineWithContacts;
  unit?: {
    unitAbbr: string;
    unitName: string;
  } | null;
}

/**
 * Form data for creating or updating a medicine
 */
export interface MedicineFormData {
  id?: string;
  name: string;
  typicalDoseSize?: number;
  unitAbbr?: string;
  doseMinTime?: string;
  notes?: string;
  active?: boolean;
  isSupplement?: boolean;
  contactIds?: string[];
}

/**
 * Form data for creating a medicine log entry
 */
export interface MedicineLogFormData {
  babyId: string;
  medicineId: string;
  time: string;
  doseAmount: number;
  unitAbbr?: string;
  notes?: string;
}

/**
 * Active dose information with countdown status
 */
export interface ActiveDose {
  id: string;
  medicineName: string;
  doseAmount: number;
  unitAbbr?: string;
  time: string;
  nextDoseTime?: string;
  isSafe: boolean;
  minutesRemaining?: number;
  totalIn24Hours: number;
  doseMinTime: string;
}
