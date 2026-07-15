import { Baby } from '@prisma/client';
import { BabyAllergenResponse, FoodProgressResponse } from '@/app/api/types';

/**
 * Types for the BabyQuickInfo component
 */

/**
 * Tab types
 */
export type Tab = 'notifications' | 'contacts' | 'allergens' | 'stats';

/**
 * Props for the BabyQuickInfo component
 */
export interface BabyQuickInfoProps {
  /**
   * Whether the form is open
   */
  isOpen: boolean;
  
  /**
   * Function to call when the form should be closed
   */
  onClose: () => void;
  
  /**
   * The currently selected baby
   */
  selectedBaby: Baby | null;
  
  /**
   * Function to calculate the age of a baby
   */
  calculateAge?: (birthDate: Date) => string;
}

/**
 * Props for the NotificationsTab component
 */
export interface NotificationsTabProps {
  /**
   * Last activities data for the baby
   */
  lastActivities: any;
  
  /**
   * Upcoming events data for the baby
   */
  upcomingEvents: any[];
  
  /**
   * The currently selected baby
   */
  selectedBaby: Baby;
}

/**
 * Props for the ContactsTab component
 */
export interface ContactsTabProps {
  /**
   * Contacts data
   */
  contacts: any[];
  
  /**
   * The currently selected baby
   */
  selectedBaby: Baby;
}

/**
 * Props for the AllergensTab component
 */
export interface AllergensTabProps {
  /**
   * The currently selected baby
   */
  selectedBaby: Baby;

  /**
   * Allergens derived from reaction-flagged food logs (progress endpoint)
   */
  derivedAllergens: FoodProgressResponse['allergens'];

  /**
   * Allergens derived from reaction-flagged feed logs (progress endpoint)
   */
  feedAllergens: FoodProgressResponse['feedAllergens'];

  /**
   * Manually recorded allergens (baby-allergen endpoint)
   */
  manualAllergens: BabyAllergenResponse[];

  /**
   * Called after a manual allergen is added or deleted so the parent refetches
   */
  onAllergensChanged: () => void;

  /**
   * Called when the user follows a "View in log" link so the parent can close
   * the modal (navigation may target the page already underneath it)
   */
  onNavigate?: () => void;
}

/**
 * Props for the StatsTab component
 */
export interface StatsTabProps {
  /**
   * Activities data for the baby
   */
  activities: any[];
  
  /**
   * The currently selected baby
   */
  selectedBaby: Baby;
  
  /**
   * Function to calculate the age of a baby
   */
  calculateAge?: (birthDate: Date) => string;
}

/**
 * Last activities data structure
 */
export interface LastActivitiesData {
  lastDiaper: {
    id: string;
    time: string;
    type: string;
    condition: string;
    caretakerName?: string;
  } | null;
  
  lastBath: {
    id: string;
    time: string;
    soapUsed: boolean;
    caretakerName?: string;
  } | null;
  
  lastMeasurements: {
    height: {
      id: string;
      date: string;
      value: number;
      unit: string;
      caretakerName?: string;
    } | null;
    
    weight: {
      id: string;
      date: string;
      value: number;
      unit: string;
      caretakerName?: string;
    } | null;
    
    headCircumference: {
      id: string;
      date: string;
      value: number;
      unit: string;
      caretakerName?: string;
    } | null;
  };
  
  lastNote: {
    id: string;
    time: string;
    content: string;
    caretakerName?: string;
  } | null;
}
