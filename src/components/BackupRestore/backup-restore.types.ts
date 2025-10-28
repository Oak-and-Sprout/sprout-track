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
  
  /** Custom className for the container */
  className?: string;

  /** Whether to show only import/restore functionality (hides backup button) */
  importOnly?: boolean;

  /** Whether this is being used during initial setup (uses different migration API) */
  initialSetup?: boolean;
}

/**
 * State interface for backup/restore operations
 */
export interface BackupRestoreState {
  /** Whether a restore operation is in progress */
  isRestoring: boolean;
  
  /** Whether a migration is in progress after restore */
  isMigrating: boolean;
  
  /** Error message if operation fails */
  error: string | null;
  
  /** Success message if operation succeeds */
  success: string | null;
  
  /** Current migration step for progress tracking */
  migrationStep: string | null;
} 