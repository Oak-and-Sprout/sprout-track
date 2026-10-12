import {
  ExternalImportPreview,
  ExternalImportExecutionResult,
} from '@/src/types/external-import';
export interface ExternalImportPreviewChild {
  readonly sourceId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly birthDate?: string;
  readonly birthTime?: string;
  readonly activityOnly?: boolean;
}

export interface ExternalImportUnitRequirement {
  readonly entityType: string;
  readonly populatedRows: number;
  readonly allowedUnits: readonly string[];
  readonly optional: boolean;
}

export interface ExternalImportPreviewDetails {
  readonly children: readonly ExternalImportPreviewChild[];
  readonly unitRequirements: readonly ExternalImportUnitRequirement[];
}

export interface ExternalImportWarning {
  readonly code: string;
  readonly entityType: string;
  readonly affectedRows: number;
}

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
  readonly details: ExternalImportPreviewDetails;
  readonly warnings: readonly ExternalImportWarning[];
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
  Record<string, string>
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
