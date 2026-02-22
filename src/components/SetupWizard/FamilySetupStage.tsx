import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { styles } from './setup-wizard.styles';
import { FamilySetupStageProps } from './setup-wizard.types';
import { BackupRestore } from '@/src/components/BackupRestore';
import { AdminPasswordResetModal } from '@/src/components/BackupRestore/AdminPasswordResetModal';
import { useLocalization } from '@/src/context/localization';

/**
 * FamilySetupStage Component
 * 
 * First stage of the setup wizard that collects the family name and slug
 */
const FamilySetupStage: React.FC<FamilySetupStageProps> = ({
  familyName,
  setFamilyName,
  familySlug,
  setFamilySlug,
  token,
  initialSetup = false
}) => {

  const { t } = useLocalization();
  const router = useRouter();
  const [slugError, setSlugError] = useState('');
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [generatingSlug, setGeneratingSlug] = useState(false);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const adminResetResolverRef = React.useRef<(() => void) | null>(null);

  // Handle admin password reset notification
  const handleAdminPasswordReset = useCallback(() => {
    console.log('Admin password was reset to default during import');
    setShowPasswordResetModal(true);
  }, []);

  // Handle modal confirmation
  const handlePasswordResetConfirm = useCallback(() => {
    console.log('User acknowledged password reset notification');
    // Resolve the promise to allow BackupRestore to proceed
    if (adminResetResolverRef.current) {
      adminResetResolverRef.current();
      adminResetResolverRef.current = null;
    }
  }, []);

  // Promise that resolves when user acknowledges the password reset
  const handleAdminResetAcknowledged = useCallback(() => {
    return new Promise<void>((resolve) => {
      adminResetResolverRef.current = resolve;
    });
  }, []);

  // Handle post-import logout and redirect
  const handleImportSuccess = useCallback(() => {
    console.log('Database imported successfully during setup');

    // Clear all authentication data
    localStorage.removeItem('authToken');
    localStorage.removeItem('unlockTime');
    localStorage.removeItem('caretakerId');

    // Redirect to home page - user will need to login with imported data
    router.push('/');
  }, [router]);

  // Check slug uniqueness
  const checkSlugUniqueness = useCallback(async (slug: string) => {
    if (!slug || slug.trim() === '') {
      setSlugError('');
      return;
    }

    setCheckingSlug(true);
    try {
      const response = await fetch(`/api/family/by-slug/${encodeURIComponent(slug)}`);
      const data = await response.json();
      
      if (response.status === 400) {
        // Validation error (format or reserved word)
        setSlugError(data.error || 'Invalid slug format');
      } else if (data.success && data.data) {
        setSlugError('This URL is already taken');
      } else {
        setSlugError('');
      }
    } catch (error) {
      console.error('Error checking slug:', error);
      setSlugError('Error checking URL availability');
    } finally {
      setCheckingSlug(false);
    }
  }, []);

  // Generate a unique slug
  const generateSlug = async () => {
    setGeneratingSlug(true);
    try {
      const response = await fetch('/api/family/generate-slug');
      const data = await response.json();
      
      if (data.success && data.data.slug) {
        setFamilySlug(data.data.slug);
        setSlugError('');
      } else {
        setSlugError('Failed to generate unique URL');
      }
    } catch (error) {
      console.error('Error generating slug:', error);
      setSlugError('Error generating URL');
    } finally {
      setGeneratingSlug(false);
    }
  };

  // Auto-generate slug from family name
  const generateSlugFromName = (name: string) => {  

    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .trim()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  };

  // Handle slug field focus - auto-generate if empty and set cursor to end
  const handleSlugFieldFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!familySlug && familyName) {
      const autoSlug = generateSlugFromName(familyName);
      if (autoSlug) {
        setFamilySlug(autoSlug);
        // Use setTimeout to ensure the value is set before moving cursor
        setTimeout(() => {
          const input = e.target as HTMLInputElement;
          input.setSelectionRange(input.value.length, input.value.length);
        }, 0);
      }
    }
  };

  // Debounced slug validation
  useEffect(() => {
    if (familySlug) {
      const timeoutId = setTimeout(() => {
        checkSlugUniqueness(familySlug);
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [familySlug, checkSlugUniqueness]);

  return (
    <div className={cn(styles.stageContainer, "setup-wizard-stage-container")}>
      <h2 className={cn(styles.stageTitle, "setup-wizard-stage-title")}>
        {token ? 'Create Your Family' : 'Create Your Family'}
      </h2>
      <p className={cn(styles.stageDescription, "setup-wizard-stage-description")}>
        {token 
          ? 'You\'ve been invited to create a new family. Let\'s get started with some basic information.' 
          : 'Let\'s get started with some basic information.'
        }
      </p>
      
      <div className={cn(styles.formGroup, "setup-wizard-form-group")}>
        <label 
          className={cn(styles.formLabel, "setup-wizard-form-label")}
          htmlFor="familyName"
        >
          {t('What is your family name?')}
        </label>
        <Input
          id="familyName"
          value={familyName}
          onChange={(e) => setFamilyName(e.target.value)}
          placeholder="Enter family name"
          className={cn(styles.formInput, "setup-wizard-form-input")}
        />
      </div>

      <div className={cn(styles.formGroup, "setup-wizard-form-group")}>
        <label 
          className={cn(styles.formLabel, "setup-wizard-form-label")}
          htmlFor="familySlug"
        >
          {t('Family URL')}
        </label>
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                id="familySlug"
                value={familySlug}
                onChange={(e) => setFamilySlug(e.target.value.toLowerCase())}
                onFocus={handleSlugFieldFocus}
                placeholder="family-url"
                className={cn(
                  styles.formInput,
                  "setup-wizard-form-input",
                  slugError ? 'border-red-500' : ''
                )}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={generateSlug}
              disabled={generatingSlug}
              className="px-3"
              title="Generate random URL"
            >
              {generatingSlug ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {/* URL Preview */}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {t('Your family will be accessible at:')} <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">
              /{familySlug || 'your-family-url'}
            </span>
          </div>
          
          {/* Validation feedback */}
          <div className="min-h-[20px]">
            {checkingSlug && (
              <div className="flex items-center gap-1 text-blue-600 text-sm">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('Checking availability...')}
              </div>
            )}
            {slugError && (
              <div className="flex items-center gap-1 text-red-600 text-sm">
                <AlertCircle className="h-3 w-3" />
                {slugError}
              </div>
            )}
            {!checkingSlug && !slugError && familySlug && (
              <div className="flex items-center gap-1 text-green-600 text-sm">
                <span className="h-3 w-3 rounded-full bg-green-600"></span>
                {t('URL is available')}
              </div>
            )}
          </div>
        </div>
        
        <p className={cn(styles.formHelperText, "setup-wizard-form-helper-text")}>
          {t('This will be the unique web address for your family. It can only contain lowercase letters, numbers, and hyphens.')}
        </p>
      </div>

      {/* Import Section - only show during initial setup */}
      {initialSetup && (
        <div className={cn(styles.formGroup, "setup-wizard-form-group", "mt-6", "pt-6", "border-t", "border-gray-200", "dark:border-gray-700")}>
          <BackupRestore
            importOnly={true}
            initialSetup={true}
            onRestoreSuccess={handleImportSuccess}
            onRestoreError={(error) => {
              console.error('Database import failed during setup:', error);
              // Error handling is managed by the BackupRestore component
            }}
            onAdminPasswordReset={handleAdminPasswordReset}
            onAdminResetAcknowledged={handleAdminResetAcknowledged}
          />
        </div>
      )}

      {/* Admin Password Reset Modal */}
      <AdminPasswordResetModal
        open={showPasswordResetModal}
        onOpenChange={setShowPasswordResetModal}
        onConfirm={handlePasswordResetConfirm}
      />
    </div>
  );
};

export default FamilySetupStage;
