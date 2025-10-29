/**
 * Types for the AccountManager component
 */

/**
 * Props for the AccountManager component
 */
export interface AccountManagerProps {
  /**
   * Whether the form is open
   */
  isOpen: boolean;
  
  /**
   * Function to call when the form should be closed
   */
  onClose: () => void;
}

/**
 * Account status data structure
 */
export interface AccountStatus {
  accountId: string;
  email: string;
  firstName: string;
  lastName?: string;
  verified: boolean;
  hasFamily: boolean;
  familySlug?: string;
  familyName?: string;
  betaparticipant: boolean;
  closed: boolean;
  closedAt?: string;
  planType?: string;
  planExpires?: string;
  trialEnds?: string;
  subscriptionActive: boolean;
  accountStatus: 'active' | 'inactive' | 'trial' | 'expired' | 'closed' | 'no_family';
}

/**
 * Family data structure
 */
export interface FamilyData {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Props for the AccountSettingsTab component
 */
export interface AccountSettingsTabProps {
  /**
   * Account status data
   */
  accountStatus: AccountStatus;
  
  /**
   * Family data (optional - may be null if no family exists)
   */
  familyData: FamilyData | null;
  
  /**
   * Function to call when data needs to be refreshed
   */
  onDataRefresh: () => void;
}

/**
 * Props for the FamilyPeopleTab component
 */
export interface FamilyPeopleTabProps {
  /**
   * Family data
   */
  familyData: FamilyData;
  
  /**
   * Function to call when data needs to be refreshed
   */
  onDataRefresh: () => void;
}

/**
 * Baby data structure for display
 */
export interface BabyData {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender?: string;
  inactive: boolean;
  feedWarningTime: string;
  diaperWarningTime: string;
  age?: string;
}

/**
 * Caretaker data structure for display
 */
export interface CaretakerData {
  id: string;
  loginId: string;
  name: string;
  type?: string;
  role: string;
  inactive: boolean;
  securityPin?: string;
}

/**
 * Contact data structure for display
 */
export interface ContactData {
  id: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}
