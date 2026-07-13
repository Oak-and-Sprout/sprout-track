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
