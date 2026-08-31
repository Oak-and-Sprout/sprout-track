/**
 * Props for the BackupRestore component
 */
export interface BackupRestoreProps {
  /** Whether the component is in a loading state */
  isLoading?: boolean;
  
  /** Whether the component is in a saving state */
  isSaving?: boolean;
  
  /** Callback for when backup succeeds */
  onBackupSuccess?: () => void;
  
  /** Callback for when backup fails */
  onBackupError?: (error: string) => void;
  
  /** Callback for when restore succeeds */
  onRestoreSuccess?: () => void;

  /** Callback for when restore fails */
  onRestoreError?: (error: string) => void;

  /** Callback for when admin password reset is detected during restore */
  onAdminPasswordReset?: () => void;

  /**
   * Callback that returns a promise for when restore completes with admin reset.
   * Parent should resolve this promise after user acknowledges the password reset modal.
   * If not provided, the default behavior (immediate redirect/reload) will occur.
   */
  onAdminResetAcknowledged?: () => Promise<void>;

  /** Custom className for the container */
  className?: string;

  /** Whether to show only import/restore functionality (hides backup button) */
  importOnly?: boolean;

  /** Whether this is being used during initial setup (uses different migration API) */
  initialSetup?: boolean;

  /**
   * When provided, the restore button becomes a unified "Import" button: the picked
   * file is inspected first, and a single-family migration export is handed off here
   * (to be run by the migration flow) instead of restored as a database backup.
   */
  onMigrationFile?: (file: File) => void;
}

/**
 * State interface for backup/restore operations
 */
export interface BackupRestoreState {
  /** Whether a restore operation is in progress */
  isRestoring: boolean;

  /** Whether the picked file is being inspected to choose the import path */
  detecting: boolean;

  /** Whether a migration is in progress after restore */
  isMigrating: boolean;

  /** Error message if operation fails */
  error: string | null;

  /** Success message if operation succeeds */
  success: string | null;

  /** Current migration step for progress tracking */
  migrationStep: string | null;

  /** Whether admin password was reset and we're waiting for user acknowledgment */
  awaitingAdminResetAck: boolean;
} 