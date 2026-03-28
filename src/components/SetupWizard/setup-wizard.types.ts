import type { Dispatch, SetStateAction } from 'react';
import { Gender } from '@prisma/client';

/**
 * Types for the SetupWizard component
 */

/**
 * Props for the SetupWizard component
 */
export interface SetupWizardProps {
  /**
   * Function to call when setup is complete
   */
  onComplete: (family: { id: string; name: string; slug: string }) => void;

  /**
   * Optional token for invitation-based setup
   */
  token?: string;

  /**
   * Whether this is initial setup of a blank database
   */
  initialSetup?: boolean;

  /**
   * Stage to resume from (2 or 3) when resuming an incomplete setup
   */
  resumeStage?: number;

  /**
   * Pre-existing family data for resuming setup
   */
  familyData?: {
    id: string;
    name: string;
    slug: string;
    authType: string | null;
    securityPin: string | null;
    caretakers: Array<{
      loginId: string;
      name: string;
      type: string;
      role: 'ADMIN' | 'USER';
      securityPin: string;
    }>;
  };
}

/**
 * Props for the FamilySetupStage component
 */
export interface FamilySetupStageProps {
  /**
   * Family name value
   */
  familyName: string;
  
  /**
   * Function to update family name
   */
  setFamilyName: (value: string) => void;

  /**
   * Family slug value
   */
  familySlug: string;
  
  /**
   * Function to update family slug
   */
  setFamilySlug: (value: string) => void;

  /**
   * Optional token for invitation-based setup
   */
  token?: string;

  /**
   * Whether this is initial setup of a blank database
   */
  initialSetup?: boolean;
}

/**
 * Represents the data for a caretaker during the setup process.
 */
export type CaretakerData = {
  loginId: string;
  name: string;
  type: string;
  role: 'ADMIN' | 'USER';
  securityPin: string;
};


/**
 * Props for the SecuritySetupStage component
 */
export interface SecuritySetupStageProps {
  /**
   * Whether to use system-wide PIN
   */
  useSystemPin: boolean;
  
  /**
   * Function to update useSystemPin
   */
  setUseSystemPin: (value: boolean) => void;
  
  /**
   * System PIN value
   */
  systemPin: string;
  
  /**
   * Function to update system PIN
   */
  setSystemPin: (value: string) => void;
  
  /**
   * Confirm system PIN value
   */
  confirmSystemPin: string;
  
  /**
   * Function to update confirm system PIN
   */
  setConfirmSystemPin: (value: string) => void;
  
  /**
   * List of caretakers
   */
  caretakers: CaretakerData[];
  
  /**
   * Function to update caretakers
   */
  setCaretakers: (caretakers: CaretakerData[]) => void;
  
  /**
   * New caretaker data
   */
  newCaretaker: CaretakerData;
  
  /**
   * Function to update new caretaker data
   */
  setNewCaretaker: Dispatch<SetStateAction<CaretakerData>>;
  
  /**
   * Function to add a caretaker
   */
  addCaretaker: () => void;
  
  /**
   * Function to remove a caretaker
   */
  removeCaretaker: (index: number) => void;
}

/**
 * Props for the BabySetupStage component
 */
export interface BabySetupStageProps {
  /**
   * Baby's first name
   */
  babyFirstName: string;
  
  /**
   * Function to update baby's first name
   */
  setBabyFirstName: (value: string) => void;
  
  /**
   * Baby's last name
   */
  babyLastName: string;
  
  /**
   * Function to update baby's last name
   */
  setBabyLastName: (value: string) => void;
  
  /**
   * Baby's birth date
   */
  babyBirthDate: Date | null;
  
  /**
   * Function to update baby's birth date
   */
  setBabyBirthDate: (value: Date | null) => void;
  
  /**
   * Baby's gender
   */
  babyGender: Gender | '';
  
  /**
   * Function to update baby's gender
   */
  setBabyGender: (value: Gender | '') => void;
  
  /**
   * Feed warning time
   */
  feedWarningTime: string;
  
  /**
   * Function to update feed warning time
   */
  setFeedWarningTime: (value: string) => void;
  
  /**
   * Diaper warning time
   */
  diaperWarningTime: string;
  
  /**
   * Function to update diaper warning time
   */
  setDiaperWarningTime: (value: string) => void;
}
