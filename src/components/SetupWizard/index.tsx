'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';
import { styles } from './setup-wizard.styles';
import { SetupWizardProps } from './setup-wizard.types';
import FamilySetupStage from './FamilySetupStage';
import SecuritySetupStage from './SecuritySetupStage';
import BabySetupStage from './BabySetupStage';
import { Gender } from '@prisma/client';
import './setup-wizard.css';

/**
 * SetupWizard Component
 * 
 * A multi-stage wizard component that guides users through the initial setup process
 * for the Sprout Track application.
 * 
 * @example
 * ```tsx
 * <SetupWizard onComplete={(family) => console.log('Setup complete!', family)} />
 * ```
 */
const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete, token, initialSetup = false }) => {
  const [stage, setStage] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Stage 1: Family setup
  const [familyName, setFamilyName] = useState('');
  const [familySlug, setFamilySlug] = useState('');
  const [createdFamily, setCreatedFamily] = useState<{ id: string; name: string; slug: string } | null>(null);
  
  // Stage 2: Security setup
  const [useSystemPin, setUseSystemPin] = useState(true);
  const [systemPin, setSystemPin] = useState('');
  const [confirmSystemPin, setConfirmSystemPin] = useState('');
  const [caretakers, setCaretakers] = useState<Array<{
    loginId: string;
    name: string;
    type: string;
    role: 'ADMIN' | 'USER';
    securityPin: string;
  }>>([]);
  const [newCaretaker, setNewCaretaker] = useState({
    loginId: '',
    name: '',
    type: '',
    role: 'ADMIN' as 'ADMIN' | 'USER', // Default to ADMIN for first caretaker
    securityPin: '',
  });
  
  // Stage 3: Baby setup
  const [babyFirstName, setBabyFirstName] = useState('');
  const [babyLastName, setBabyLastName] = useState('');
  const [babyBirthDate, setBabyBirthDate] = useState<Date | null>(null);
  const [babyGender, setBabyGender] = useState<Gender | ''>('');
  const [feedWarningTime, setFeedWarningTime] = useState('02:00');
  const [diaperWarningTime, setDiaperWarningTime] = useState('03:00');
  
  // Error handling
  const [error, setError] = useState('');

  // Get auth headers for API calls
  const getAuthHeaders = () => {
    const authToken = localStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
    };
  };

  // Check if this is account-based authentication
  const isAccountAuth = () => {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) return false;
    
    try {
      // Decode token to check if it's account auth (without verifying signature)
      const base64Url = authToken.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const decoded = JSON.parse(jsonPayload);
      return decoded.isAccountAuth === true;
    } catch (error) {
      console.error('Error checking account auth:', error);
      return false;
    }
  };

  const handleNext = async () => {
    setError('');
    
    if (stage === 1) {
      // Validate family name and slug
      if (!familyName.trim()) {
        setError('Please enter a family name');
        return;
      }

      if (!familySlug.trim()) {
        setError('Please enter a family URL');
        return;
      }

      // Basic slug validation
      const slugPattern = /^[a-z0-9-]+$/;
      if (!slugPattern.test(familySlug)) {
        setError('Family URL can only contain lowercase letters, numbers, and hyphens');
        return;
      }

      if (familySlug.length < 3) {
        setError('Family URL must be at least 3 characters long');
        return;
      }
      
      try {
        setLoading(true);
        // Create family using the setup/start endpoint
        const response = await fetch('/api/setup/start', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            name: familyName,
            slug: familySlug,
            token: token, // Include token if this is invitation-based setup
          }),
        });
        
        const data = await response.json();
        
        if (data.success) {
          // Store the created family for later use
          setCreatedFamily(data.data);
          setStage(2);
        } else {
          setError(data.error || 'Failed to create family');
        }
      } catch (error) {
        console.error('Error creating family:', error);
        setError('Failed to create family. Please try again.');
      } finally {
        setLoading(false);
      }
    } else if (stage === 2) {
      // Validate security setup
      if (useSystemPin) {
        if (systemPin.length < 6 || systemPin.length > 10) {
          setError('PIN must be between 6 and 10 digits');
          return;
        }
        
        if (systemPin !== confirmSystemPin) {
          setError('PINs do not match');
          return;
        }
        
        // For token-based setup or account-based setup, defer system PIN saving until final stage
        // to avoid authentication conflicts
        if (token || isAccountAuth()) {
          setStage(3);
          return;
        }
        
        try {
          setLoading(true);
          
          // Save system PIN to settings (this will also update system caretaker automatically)
          const settingsResponse = await fetch(`/api/settings?familyId=${createdFamily?.id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              securityPin: systemPin,
            }),
          });
          
          if (!settingsResponse.ok) {
            throw new Error('Failed to save security PIN to settings');
          }
          
          // For non-token auth, update system caretaker if we have a caretaker ID
          const caretakerId = localStorage.getItem('caretakerId');
          if (caretakerId) {
            const caretakerResponse = await fetch('/api/caretaker', {
              method: 'PUT',
              headers: getAuthHeaders(),
              body: JSON.stringify({
                id: caretakerId,
                securityPin: systemPin,
              }),
            });
            
            if (!caretakerResponse.ok) {
              console.warn('Failed to update system caretaker PIN (non-fatal)');
            }
          }
          
          setStage(3);
        } catch (error) {
          console.error('Error saving security PIN:', error);
          setError('Failed to save security PIN. Please try again.');
        } finally {
          setLoading(false);
        }
      } else {
        // Validate caretakers
        if (caretakers.length === 0) {
          setError('Please add at least one caretaker');
          return;
        }
        
        // For token-based setup or account-based setup, defer caretaker creation until final stage
        // to avoid authentication conflicts
        if (token || isAccountAuth()) {
          setStage(3);
          return;
        }
        
        try {
          setLoading(true);
          // Save caretakers for the created family (non-token setup only)
          for (const caretaker of caretakers) {
            const response = await fetch('/api/caretaker', {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({
                ...caretaker,
                familyId: createdFamily?.id,
              }),
            });
            
            if (!response.ok) {
              throw new Error(`Failed to save caretaker: ${caretaker.name}`);
            }
          }
          
          setStage(3);
        } catch (error) {
          console.error('Error saving caretakers:', error);
          setError('Failed to save caretakers. Please try again.');
        } finally {
          setLoading(false);
        }
      }
    } else if (stage === 3) {
      // Validate baby information
      if (!babyFirstName.trim()) {
        setError('Please enter baby\'s first name');
        return;
      }
      
      if (!babyLastName.trim()) {
        setError('Please enter baby\'s last name');
        return;
      }
      
      if (!babyBirthDate) {
        setError('Please enter baby\'s birth date');
        return;
      }
      
      if (!babyGender) {
        setError('Please select baby\'s gender');
        return;
      }
      
      try {
        setLoading(true);
        
        // For token-based setup or account-based setup, save baby first, then security settings/caretakers
        // This avoids authentication conflicts where creating caretakers disables token access
        if (token || isAccountAuth()) {
          // Step 1: Save baby information first
          const babyResponse = await fetch('/api/baby', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              firstName: babyFirstName,
              lastName: babyLastName,
              birthDate: new Date(babyBirthDate),
              gender: babyGender,
              feedWarningTime,
              diaperWarningTime,
              familyId: createdFamily?.id,
            }),
          });
          
          if (!babyResponse.ok) {
            throw new Error('Failed to save baby information');
          }
          
          // Step 2: Save security settings/caretakers after baby is created
          if (useSystemPin) {
            // Save system PIN to settings
            const settingsResponse = await fetch(`/api/settings?familyId=${createdFamily?.id}`, {
              method: 'PUT',
              headers: getAuthHeaders(),
              body: JSON.stringify({
                securityPin: systemPin,
              }),
            });
            
            if (!settingsResponse.ok) {
              throw new Error('Failed to save security PIN to settings');
            }
            
            // For account authentication, link to the system caretaker
            if (isAccountAuth()) {
              try {
                // Get the system caretaker (loginId '00') for this family
                const systemCaretakerResponse = await fetch(`/api/caretaker/system?familyId=${createdFamily?.id}`, {
                  headers: getAuthHeaders(),
                });
                
                if (systemCaretakerResponse.ok) {
                  const systemCaretakerData = await systemCaretakerResponse.json();
                  if (systemCaretakerData.success && systemCaretakerData.data?.id) {
                    // Link the account to the system caretaker
                    const linkResponse = await fetch('/api/accounts/link-caretaker', {
                      method: 'POST',
                      headers: getAuthHeaders(),
                      body: JSON.stringify({
                        caretakerId: systemCaretakerData.data.id,
                      }),
                    });
                    
                    if (!linkResponse.ok) {
                      console.error('Failed to link account to system caretaker');
                    } else {
                      console.log('Successfully linked account to system caretaker');
                    }
                  }
                } else {
                  console.error('Failed to fetch system caretaker for linking');
                }
              } catch (error) {
                console.error('Error linking account to system caretaker:', error);
                // Don't throw error here as the main setup is complete
              }
            }
          } else {
            // Save caretakers
            let accountCaretakerId: string | null = null;
            
            for (const caretaker of caretakers) {
              const caretakerResponse = await fetch('/api/caretaker', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                  ...caretaker,
                  familyId: createdFamily?.id,
                }),
              });
              
              if (!caretakerResponse.ok) {
                throw new Error(`Failed to save caretaker: ${caretaker.name}`);
              }
              
              // For account authentication, link the first (and only) caretaker to the account
              if (isAccountAuth() && !accountCaretakerId) {
                const caretakerData = await caretakerResponse.json();
                if (caretakerData.success && caretakerData.data?.id) {
                  accountCaretakerId = caretakerData.data.id;
                }
              }
            }
            
            // Link the caretaker to the account
            if (isAccountAuth() && accountCaretakerId) {
              try {
                const linkResponse = await fetch('/api/accounts/link-caretaker', {
                  method: 'POST',
                  headers: getAuthHeaders(),
                  body: JSON.stringify({
                    caretakerId: accountCaretakerId,
                  }),
                });
                
                if (!linkResponse.ok) {
                  console.error('Failed to link caretaker to account, but continuing setup');
                  // Don't throw error here as the main setup is complete
                }
              } catch (error) {
                console.error('Error linking caretaker to account:', error);
                // Don't throw error here as the main setup is complete
              }
            }
          }
        } else {
          // For non-token setup, just save baby (security was already handled in stage 2)
          const babyResponse = await fetch('/api/baby', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              firstName: babyFirstName,
              lastName: babyLastName,
              birthDate: new Date(babyBirthDate),
              gender: babyGender,
              feedWarningTime,
              diaperWarningTime,
              familyId: createdFamily?.id,
            }),
          });
          
          if (!babyResponse.ok) {
            throw new Error('Failed to save baby information');
          }
        }
        
        // Setup complete - pass the family data to the callback
        if (createdFamily) {
          const accountAuth = isAccountAuth();

          console.log('Setup completion - account auth check:', accountAuth);

          // For account authentication, refresh the token to include family info
          if (accountAuth) {
            console.log('Refreshing token for account auth with family info');
            try {
              const refreshResponse = await fetch('/api/auth/refresh-token', {
                method: 'POST',
                headers: getAuthHeaders(),
              });

              if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json();
                if (refreshData.success && refreshData.data?.token) {
                  // Update the token in localStorage
                  localStorage.setItem('authToken', refreshData.data.token);
                  console.log('Token refreshed successfully with family info');
                } else {
                  console.error('Failed to refresh token:', refreshData.error);
                }
              } else {
                console.error('Token refresh request failed:', refreshResponse.status);
              }
            } catch (error) {
              console.error('Error refreshing token:', error);
            }
          } else {
            // For non-account authentication, clear tokens to force re-login with new family context
            console.log('Clearing tokens for non-account auth');
            localStorage.removeItem('authToken');
            localStorage.removeItem('unlockTime');
            localStorage.removeItem('caretakerId');
          }

          onComplete(createdFamily);
        }
      } catch (error) {
        console.error('Error completing setup:', error);
        setError(error instanceof Error ? error.message : 'Failed to complete setup. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePrevious = () => {
    if (stage > 1) {
      setStage(stage - 1);
      setError('');
    }
  };

  const addCaretaker = () => {
    // Validate caretaker
    if (newCaretaker.loginId.length !== 2) {
      setError('Login ID must be exactly 2 digits');
      return;
    }
    
    // Check if login ID contains only digits
    if (!/^\d+$/.test(newCaretaker.loginId)) {
      setError('Login ID must contain only digits');
      return;
    }
    
    // Check if login ID is "00" (reserved)
    if (newCaretaker.loginId === '00') {
      setError('Login ID "00" is reserved for system use');
      return;
    }
    
    // Check if login ID is already taken
    if (caretakers.some(c => c.loginId === newCaretaker.loginId)) {
      setError('This Login ID is already taken');
      return;
    }
    
    if (!newCaretaker.name.trim()) {
      setError('Please enter caretaker name');
      return;
    }
    
    if (newCaretaker.securityPin.length < 6 || newCaretaker.securityPin.length > 10) {
      setError('PIN must be between 6 and 10 digits');
      return;
    }
    
    // Add caretaker to list
    setCaretakers([...caretakers, { ...newCaretaker }]);
    
    // Reset form
    setNewCaretaker({
      loginId: '',
      name: '',
      type: '',
      role: 'USER',
      securityPin: '',
    });
    
    setError('');
  };

  const removeCaretaker = (index: number) => {
    const updatedCaretakers = [...caretakers];
    updatedCaretakers.splice(index, 1);
    setCaretakers(updatedCaretakers);
  };

  return (
    <div className={cn(styles.container, "setup-wizard-container")}>
      <div className={cn(styles.formContainer, "setup-wizard-form-container")}>
        {/* Stage-specific image and Header */}
        <div className={cn(styles.headerContainer, "setup-wizard-header-container")}>
          <Image
            src={
              stage === 1 
                ? "/SetupFamily-1024.png" 
                : stage === 2 
                  ? "/SetupSecurity-1024.png" 
                  : "/SetupBaby-1024.png"
            }
            alt={
              stage === 1 
                ? "Family Setup" 
                : stage === 2 
                  ? "Security Setup" 
                  : "Baby Setup"
            }
            width={128}
            height={128}
            className={cn(styles.stageImage, "setup-wizard-stage-image")}
          />
          <h1 className={cn(styles.title, "setup-wizard-title")}>Sprout Track</h1>
          <div className={cn(styles.progressBar, "setup-wizard-progress-bar")}>
            <div 
              className={cn(styles.progressIndicator, "setup-wizard-progress-indicator")}
              style={{ width: `${(stage / 3) * 100}%` }}
            ></div>
          </div>
          <p className={cn(styles.stepIndicator, "setup-wizard-step-indicator")}>
            Step {stage} of 3
          </p>
        </div>

        {/* Stage 1: Family Setup */}
        {stage === 1 && (
          <FamilySetupStage
            familyName={familyName}
            setFamilyName={setFamilyName}
            familySlug={familySlug}
            setFamilySlug={setFamilySlug}
            token={token}
            initialSetup={initialSetup}
          />
        )}

        {/* Stage 2: Security Setup */}
        {stage === 2 && (
          <SecuritySetupStage
            useSystemPin={useSystemPin}
            setUseSystemPin={setUseSystemPin}
            systemPin={systemPin}
            setSystemPin={setSystemPin}
            confirmSystemPin={confirmSystemPin}
            setConfirmSystemPin={setConfirmSystemPin}
            caretakers={caretakers}
            setCaretakers={setCaretakers}
            newCaretaker={newCaretaker}
            setNewCaretaker={setNewCaretaker}
            addCaretaker={addCaretaker}
            removeCaretaker={removeCaretaker}
          />
        )}

        {/* Stage 3: Baby Setup */}
        {stage === 3 && (
          <BabySetupStage
            babyFirstName={babyFirstName}
            setBabyFirstName={setBabyFirstName}
            babyLastName={babyLastName}
            setBabyLastName={setBabyLastName}
            babyBirthDate={babyBirthDate}
            setBabyBirthDate={setBabyBirthDate}
            babyGender={babyGender}
            setBabyGender={setBabyGender}
            feedWarningTime={feedWarningTime}
            setFeedWarningTime={setFeedWarningTime}
            diaperWarningTime={diaperWarningTime}
            setDiaperWarningTime={setDiaperWarningTime}
          />
        )}

        {/* Error message */}
        {error && (
          <div className={cn(styles.errorContainer, "setup-wizard-error-container")}>
            {error}
          </div>
        )}

        {/* Navigation buttons */}
        <div className={cn(styles.navigationContainer, "setup-wizard-navigation-container")}>
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={stage === 1 || loading}
            className={cn(styles.previousButton, "setup-wizard-previous-button")}
          >
            {stage === 1 ? 'Cancel' : 'Previous'}
          </Button>
          <Button
            onClick={handleNext}
            disabled={loading}
            className={cn(styles.nextButton, "setup-wizard-next-button")}
          >
            {loading ? 'Processing...' : stage === 3 ? 'Complete Setup' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SetupWizard;
