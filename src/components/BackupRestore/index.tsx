'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/src/components/ui/button';
import { Label } from '@/src/components/ui/label';
import { Settings, Download, Upload, X, Save } from 'lucide-react';
import { useTheme } from '@/src/context/theme';
import { cn } from '@/src/lib/utils';
import { detectImportFileKind } from '@/src/utils/import-file-detect';

// Import component-specific files
import './backup-restore.css';
import { backupRestoreStyles } from './backup-restore.styles';
import { BackupRestoreProps, BackupRestoreState } from './backup-restore.types';
import { useLocalization } from '@/src/context/localization';

export const BackupRestore: React.FC<BackupRestoreProps> = ({
  isLoading = false,
  isSaving = false,
  onBackupSuccess,
  onBackupError,
  onRestoreSuccess,
  onRestoreError,
  onAdminPasswordReset,
  onAdminResetAcknowledged,
  className,
  importOnly = false,
  initialSetup = false,
  onMigrationFile
}) => {
  const { theme } = useTheme();
  const { t } = useLocalization();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const adminResetDetectedRef = useRef<boolean>(false);

  const [state, setState] = useState<BackupRestoreState>({
    isRestoring: false,
    detecting: false,
    isMigrating: false,
    error: null,
    success: null,
    migrationStep: null,
    awaitingAdminResetAck: false
  });

  // Clear messages helper
  const clearMessages = () => {
    setState(prev => ({ ...prev, error: null, success: null, migrationStep: null }));
  };

  // Handle post-restore migrations
  const runPostRestoreMigrations = async () => {
    try {
      setState(prev => ({
        ...prev,
        isMigrating: true,
        migrationStep: 'Preparing database migration...',
        error: null
      }));

      // Add a small delay to show the initial step
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 1: Run pre-migration check
      setState(prev => ({
        ...prev,
        migrationStep: 'Checking database version and compatibility...'
      }));

      const authToken = localStorage.getItem('authToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      };

      const preMigrationEndpoint = initialSetup
        ? '/api/database/pre-migration-check-initial'
        : '/api/database/pre-migration-check';

      const preMigrationResponse = await fetch(preMigrationEndpoint, {
        method: 'POST',
        headers
      });

      if (!preMigrationResponse.ok) {
        console.warn('Pre-migration check failed, continuing with migration...');
      } else {
        const preMigrationResult = await preMigrationResponse.json();
        if (preMigrationResult.success && preMigrationResult.data?.adminResetRequired) {
          console.log('Admin password reset was required and has been completed');
          // Track that admin reset was detected
          adminResetDetectedRef.current = true;
          // Notify parent component that admin password was reset
          onAdminPasswordReset?.();
          setState(prev => ({
            ...prev,
            migrationStep: 'Database compatibility check complete. Running migrations...'
          }));
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      setState(prev => ({
        ...prev,
        migrationStep: 'Running schema migrations and updates...'
      }));

      const migrationEndpoint = initialSetup ? '/api/database/migrate-initial' : '/api/database/migrate';
      const response = await fetch(migrationEndpoint, {
        method: 'POST',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle authentication/authorization errors specifically
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in as a system administrator to perform database migrations.');
        } else if (response.status === 403) {
          throw new Error('System administrator access required. Only system administrators can perform database migrations.');
        }
        
        const suggestion = errorData.data?.suggestion ? ` ${errorData.data.suggestion}` : '';
        throw new Error(`${errorData.error || 'Migration failed'}${suggestion}`);
      }

      const result = await response.json();
      
      // Check if admin reset occurred and we should wait for acknowledgment
      const shouldWaitForAck = adminResetDetectedRef.current && onAdminResetAcknowledged;

      if (shouldWaitForAck) {
        // Admin reset occurred - wait for user to acknowledge before proceeding
        setState(prev => ({
          ...prev,
          migrationStep: 'Migration completed! Please acknowledge the password reset notification.'
        }));

        // Wait briefly to show the message, then set awaiting state
        setTimeout(() => {
          setState(prev => ({
            ...prev,
            isMigrating: false,
            migrationStep: null,
            success: initialSetup
              ? 'Database imported and migrated successfully.'
              : 'Database restored and migrated successfully.',
            awaitingAdminResetAck: true
          }));
        }, 1000);

        // Wait for acknowledgment, then proceed with redirect/reload
        await onAdminResetAcknowledged();

        // Reset the awaiting state
        setState(prev => ({
          ...prev,
          awaitingAdminResetAck: false
        }));

        // Now proceed with redirect/reload
        if (!initialSetup) {
          window.location.reload();
        } else {
          onRestoreSuccess?.();
        }
      } else {
        // No admin reset or no callback - proceed with normal flow
        setState(prev => ({
          ...prev,
          migrationStep: 'Migration completed! Reloading application...'
        }));

        // Show completion message briefly before reload/redirect
        setTimeout(() => {
          setState(prev => ({
            ...prev,
            isMigrating: false,
            migrationStep: null,
            success: initialSetup
              ? 'Database imported and migrated successfully. Redirecting...'
              : 'Database restored and migrated successfully. Application is reloading...'
          }));

          if (!initialSetup) {
            // Refresh the page after successful migration (normal mode)
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } else {
            // For initial setup, call the success callback after showing the message
            setTimeout(() => {
              onRestoreSuccess?.();
            }, 1000);
          }
        }, 1000);
      }
      
    } catch (error) {
      console.error('Migration error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to migrate database';
      setState(prev => ({ 
        ...prev, 
        isMigrating: false,
        migrationStep: null,
        error: `Database restore succeeded, but migration failed: ${errorMessage}` 
      }));
    }
  };

  // Handle backup
  const handleBackup = async () => {
    try {
      clearMessages();
      
      const authToken = localStorage.getItem('authToken');
      const headers: HeadersInit = authToken ? {
        'Authorization': `Bearer ${authToken}`
      } : {};

      const response = await fetch('/api/database', { headers });
      if (!response.ok) throw new Error('Backup failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1].replace(/"/g, '') || 'baby-tracker-backup.db';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setState(prev => ({ ...prev, success: 'Backup created successfully' }));
      onBackupSuccess?.();
    } catch (error) {
      console.error('Backup error:', error);
      const errorMessage = 'Failed to create backup';
      setState(prev => ({ ...prev, error: errorMessage }));
      onBackupError?.(errorMessage);
    }
  };

  // Handle a picked file. When `onMigrationFile` is wired, this is a unified import
  // button: inspect the file first and hand a single-family migration export off to
  // the migration flow; only a real database backup falls through to restore.
  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset the input so re-picking the same file fires onChange again.
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    if (onMigrationFile) {
      setState(prev => ({ ...prev, detecting: true, error: null, success: null }));
      const kind = await detectImportFileKind(file);
      setState(prev => ({ ...prev, detecting: false }));
      if (kind === 'migration') {
        onMigrationFile(file);
        return;
      }
      if (kind === 'unknown') {
        setState(prev => ({
          ...prev,
          error: t('Unrecognized import file. Choose a Sprout Track database backup or a family export.'),
        }));
        return;
      }
      // kind === 'backup' → continue into the restore flow below.
    }

    await restoreFile(file);
  };

  // Restore a database backup file.
  const restoreFile = async (file: File) => {
    try {
      setState(prev => ({ ...prev, isRestoring: true, error: null, success: null }));

      const formData = new FormData();
      formData.append('file', file);

      const authToken = localStorage.getItem('authToken');
      const headers: HeadersInit = authToken ? {
        'Authorization': `Bearer ${authToken}`
      } : {};

      const restoreEndpoint = initialSetup ? '/api/database/restore-initial' : '/api/database';
      const response = await fetch(restoreEndpoint, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Restore failed');
      }

      setState(prev => ({ 
        ...prev, 
        success: 'Database restored successfully. Running migrations...' 
      }));
      
      // Run post-restore migrations
      await runPostRestoreMigrations();
    } catch (error) {
      console.error('Restore error:', error);
      const errorMessage = 'Failed to restore backup';
      setState(prev => ({ ...prev, error: errorMessage }));
      onRestoreError?.(errorMessage);
    } finally {
      setState(prev => ({ ...prev, isRestoring: false }));
    }
  };

  return (
    <div className={cn(backupRestoreStyles.container, className)}>
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".db,.zip"
        onChange={handleFileSelected}
        style={{ display: 'none' }}
      />
      
      {/* Section Header */}
      <div className={backupRestoreStyles.header.container}>
        <Settings className={backupRestoreStyles.header.icon} aria-hidden="true" />
        <Label className={backupRestoreStyles.header.title}>
          {importOnly ? 'Import Previous Data' : 'Database Management'}
        </Label>
      </div>

      {/* Action Buttons */}
      <div className={backupRestoreStyles.buttonContainer}>
        {!importOnly && (
          <Button
            type="button"
            variant="outline"
            onClick={handleBackup}
            className={backupRestoreStyles.button.backup}
            disabled={isLoading || isSaving || state.isRestoring || state.isMigrating}
          >
            <Download className={backupRestoreStyles.icon} aria-hidden="true" />
            {t('Backup Database')}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            backupRestoreStyles.button.restore,
            importOnly && "w-full"
          )}
          disabled={isLoading || isSaving || state.detecting || state.isRestoring || state.isMigrating}
        >
          <Upload className={backupRestoreStyles.icon} aria-hidden="true" />
          {state.detecting
            ? t('Reading file...')
            : state.isRestoring
              ? t('Importing...')
              : state.isMigrating
                ? t('Migrating...')
                : onMigrationFile
                  ? t('Import')
                  : importOnly
                    ? t('Import Database')
                    : t('Restore Database')}
        </Button>
      </div>
      
      {/* Help Text */}
      <p className={backupRestoreStyles.helpText}>
        {onMigrationFile
          ? importOnly
            ? t('Import a full Sprout Track database backup or a single-family export — the right path is chosen automatically. Or skip this step to create a new family from scratch.')
            : t('Import a full Sprout Track database backup or a single-family export — the right path is chosen automatically. Restoring a backup replaces all current data and runs necessary migrations.')
          : importOnly
            ? t('Import data from a previous Sprout Track database backup to start with existing family data, or skip this step to create a new family from scratch.')
            : t('Create backups of your database or restore from a previous backup. Restoring will replace all current data and run necessary migrations.')
        }
      </p>

      {/* Migration Progress */}
      {state.isMigrating && state.migrationStep && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md migration-progress-container">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
            <span className="text-sm text-blue-700 migration-progress-text">{state.migrationStep}</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {state.error && (
        <div className={backupRestoreStyles.error.container}>
          <div className={backupRestoreStyles.error.content}>
            <X className={backupRestoreStyles.error.icon} aria-hidden="true" />
            <span className={backupRestoreStyles.error.text}>{state.error}</span>
          </div>
        </div>
      )}

      {/* Success Message */}
      {state.success && (
        <div className={backupRestoreStyles.success.container}>
          <div className={backupRestoreStyles.success.content}>
            <Save className={backupRestoreStyles.success.icon} aria-hidden="true" />
            <span className={backupRestoreStyles.success.text}>{state.success}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupRestore; 