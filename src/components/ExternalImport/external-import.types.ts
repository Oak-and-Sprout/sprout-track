import {
  ExternalImportPreview,
  ExternalImportExecutionResult,
} from '@/src/types/external-import';
import type {
  BabyBuddyImportWarning,
  BabyBuddyPreviewDetails,
  BabyBuddyUnitRequirementType,
} from '@/src/lib/importers/baby-buddy';

export interface ExternalImportProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export type ExternalImportStep =
  | 'select'
  | 'configure'
  | 'review'
  | 'result';

export interface ExternalImportPreviewResponse {
  readonly preview: ExternalImportPreview;
  readonly details: BabyBuddyPreviewDetails;
  readonly warnings: readonly BabyBuddyImportWarning[];
}

export interface ExistingBaby {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly birthDate: string;
  readonly inactive: boolean;
}

export type ChildDestinationState =
  | {
      readonly mode: 'new';
      readonly gender: '' | 'MALE' | 'FEMALE';
    }
  | {
      readonly mode: 'existing';
      readonly targetBabyId: string;
    };

export type UnitSelectionState = Partial<
  Record<BabyBuddyUnitRequirementType, string>
>;

export interface ExternalImportUiConfiguration {
  readonly sourceTimezone: string;
  readonly childDestinations: Readonly<
    Record<string, ChildDestinationState>
  >;
  readonly units: UnitSelectionState;
}

export interface ExternalImportCompletedResult {
  readonly execution: ExternalImportExecutionResult;
}
