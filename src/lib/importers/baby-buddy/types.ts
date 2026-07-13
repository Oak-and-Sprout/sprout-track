export interface BabyBuddyPreviewChild {
  readonly sourceId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly birthDate: string;
  readonly birthTime?: string;
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
  | 'sleep-notes-unsupported'
  | 'diaper-notes-unsupported'
  | 'diaper-amount-unsupported'
  | 'pumping-defaults-to-stored';

export interface BabyBuddyImportWarning {
  readonly code: BabyBuddyWarningCode;
  readonly entityType: string;
  readonly affectedRows: number;
}
