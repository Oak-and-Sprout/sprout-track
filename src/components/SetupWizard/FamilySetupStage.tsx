import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { styles } from './setup-wizard.styles';
import { FamilySetupStageProps } from './setup-wizard.types';
import { BackupRestore } from '@/src/components/BackupRestore';

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
  const router = useRouter();
  const [slugError, setSlugError] = useState('');
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [generatingSlug, setGeneratingSlug] = useState(false);

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

    // Basic slug validation
    const slugPattern = /^[a-z0-9-]+$/;
    if (!slugPattern.test(slug)) {
      setSlugError('Slug can only contain lowercase letters, numbers, and hyphens');
      return;
    }

    if (slug.length < 3) {
      setSlugError('Slug must be at least 3 characters long');
      return;
    }

    if (slug.length > 50) {
      setSlugError('Slug must be less than 50 characters');
      return;
    }

    setCheckingSlug(true);
    try {
      const response = await fetch(`/api/family/by-slug/${encodeURIComponent(slug)}`);
      const data = await response.json();
      
      if (data.success && data.data) {
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

  // Handle slug field click - auto-generate if empty
  const handleSlugFieldClick = () => {
    if (!familySlug && familyName) {
      const autoSlug = generateSlugFromName(familyName);
      if (autoSlug) {
        setFamilySlug(autoSlug);
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
        {token ? 'Create Your Family' : 'Welcome to Sprout Track!'}
      </h2>
      <p className={cn(styles.stageDescription, "setup-wizard-stage-description")}>
        {token 
          ? 'You\'ve been invited to create a new family. Let\'s get started with some basic information.' 
          : 'Since this is a brand new setup, let\'s get started with some basic information.'
        }
      </p>
      
      <div className={cn(styles.formGroup, "setup-wizard-form-group")}>
        <label 
          className={cn(styles.formLabel, "setup-wizard-form-label")}
          htmlFor="familyName"
        >
          What is your family name?
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
          Family URL
        </label>
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                id="familySlug"
                value={familySlug}
                onChange={(e) => setFamilySlug(e.target.value.toLowerCase())}
                onClick={handleSlugFieldClick}
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
            Your family will be accessible at: <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">
              /{familySlug || 'your-family-url'}
            </span>
          </div>
          
          {/* Validation feedback */}
          <div className="min-h-[20px]">
            {checkingSlug && (
              <div className="flex items-center gap-1 text-blue-600 text-sm">
                <Loader2 className="h-3 w-3 animate-spin" />
                Checking availability...
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
                URL is available
              </div>
            )}
          </div>
        </div>
        
        <p className={cn(styles.formHelperText, "setup-wizard-form-helper-text")}>
          This will be the unique web address for your family. It can only contain lowercase letters, numbers, and hyphens.
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
          />
        </div>
      )}
    </div>
  );
};

export default FamilySetupStage;
