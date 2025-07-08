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
  caretakers: Array<{
    loginId: string;
    name: string;
    type: string;
    role: 'ADMIN' | 'USER';
    securityPin: string;
  }>;
  
  /**
   * Function to update caretakers
   */
  setCaretakers: (caretakers: Array<{
    loginId: string;
    name: string;
    type: string;
    role: 'ADMIN' | 'USER';
    securityPin: string;
  }>) => void;
  
  /**
   * New caretaker data
   */
  newCaretaker: {
    loginId: string;
    name: string;
    type: string;
    role: 'ADMIN' | 'USER';
    securityPin: string;
  };
  
  /**
   * Function to update new caretaker data
   */
  setNewCaretaker: (caretaker: {
    loginId: string;
    name: string;
    type: string;
    role: 'ADMIN' | 'USER';
    securityPin: string;
  }) => void;
  
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
