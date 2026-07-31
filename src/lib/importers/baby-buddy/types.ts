export interface BabyBuddyPreviewChild {
  readonly sourceId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly birthDate?: string;
  readonly birthTime?: string;
  readonly activityOnly?: boolean;
}

export type BabyBuddyUnitRequirementType =
  | 'feeding'
  | 'pumping'
  | 'height'
  | 'weight'
  | 'head-circumference'
  | 'temperature';

export interface BabyBuddyUnitRequirement {
  readonly entityType: BabyBuddyUnitRequirementType;
  readonly populatedRows: number;
  readonly allowedUnits: readonly string[];
  readonly optional: boolean;
}

export interface BabyBuddyPreviewDetails {
  readonly children: readonly BabyBuddyPreviewChild[];
  readonly unitRequirements: readonly BabyBuddyUnitRequirement[];
}

export type BabyBuddyWarningCode =
  | 'birth-time-unsupported'
  | 'tags-unsupported'
  | 'bmi-unsupported'
  | 'both-breasts-without-side'
  | 'wet-diaper-colour-unsupported'
  | 'breast-feed-amount-unsupported'
  | 'diaper-amount-unsupported'
  | 'pumping-defaults-to-stored'
  | 'medication-dosage-missing'
  | 'feeding-combination-unsupported';

export interface BabyBuddyImportWarning {
  readonly code: BabyBuddyWarningCode;
  readonly entityType: string;
  readonly affectedRows: number;
}

export interface BabyBuddyExecutionConfiguration {
  readonly feedingUnit?: 'ML' | 'OZ' | 'SKIP';
  readonly pumpingUnit?: 'ML' | 'OZ';
  readonly heightUnit?: 'cm' | 'in';
  readonly weightUnit?: 'kg' | 'lb';
  readonly headCircumferenceUnit?: 'cm' | 'in';
  readonly temperatureUnit?: '°C' | '°F';
}
