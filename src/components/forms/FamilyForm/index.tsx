'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Gender } from '@prisma/client';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Calendar } from 'lucide-react';
import { Calendar as CalendarComponent } from '@/src/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { 
  FormPage, 
  FormPageContent, 
  FormPageFooter 
} from '@/src/components/ui/form-page';
import { ShareButton } from '@/src/components/ui/share-button';
import { format } from 'date-fns';
import { cn } from '@/src/lib/utils';
import { useToast } from '@/src/components/ui/toast';
import { handleExpirationError } from '@/src/lib/expiration-error-handler';
import './FamilyForm.css';

interface FamilyData {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FamilyFormProps {
  isOpen: boolean;
  onClose: () => void;
  isEditing: boolean;
  family: FamilyData | null;
  onFamilyChange: () => void;
}

type SetupMode = 'manual' | 'token';

interface CaretakerData {
  loginId: string;
  name: string;
  type: string;
  role: 'ADMIN' | 'USER';
  securityPin: string;
}

export default function FamilyForm({ 
  isOpen, 
  onClose,
  isEditing,
  family,
  onFamilyChange,
}: FamilyFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [appConfig, setAppConfig] = useState<{ rootDomain: string; enableHttps: boolean } | null>(null);

  // Setup mode selection
  const [setupMode, setSetupMode] = useState<SetupMode>('manual');

  // Family data
  const [familyName, setFamilyName] = useState('');
  const [familySlug, setFamilySlug] = useState('');
  const [slugError, setSlugError] = useState('');
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [slugValidated, setSlugValidated] = useState(false);

  // Token mode data
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [tokenPassword, setTokenPassword] = useState('');
  const [confirmTokenPassword, setConfirmTokenPassword] = useState('');

  // Manual mode - Security setup
  const [useSystemPin, setUseSystemPin] = useState(true);
  const [systemPin, setSystemPin] = useState('');
  const [confirmSystemPin, setConfirmSystemPin] = useState('');
  const [caretakers, setCaretakers] = useState<CaretakerData[]>([]);
  const [newCaretaker, setNewCaretaker] = useState<CaretakerData>({
    loginId: '',
    name: '',
    type: '',
    role: 'ADMIN',
    securityPin: '',
  });

  // Manual mode - Baby setup
  const [babyFirstName, setBabyFirstName] = useState('');
  const [babyLastName, setBabyLastName] = useState('');
  const [babyBirthDate, setBabyBirthDate] = useState<Date | null>(null);
  const [babyGender, setBabyGender] = useState<Gender | ''>('');
  const [feedWarningTime, setFeedWarningTime] = useState('02:00');
  const [diaperWarningTime, setDiaperWarningTime] = useState('03:00');

  // Error handling
  const [error, setError] = useState('');

  // Fetch app config for ShareButton
  useEffect(() => {
    const fetchAppConfig = async () => {
      try {
        const response = await fetch('/api/app-config/public');
        const data = await response.json();
        if (data.success) {
          setAppConfig(data.data);
        }
      } catch (error) {
        console.error('Error fetching app config:', error);
      }
    };

    if (isOpen) {
      fetchAppConfig();
    }
  }, [isOpen]);

  // Reset form when opening/closing
  useEffect(() => {
    if (isOpen) {
      if (isEditing && family) {
        // For editing existing family (not implementing family editing in this form)
        setFamilyName(family.name);
        setFamilySlug(family.slug);
      } else {
        // Reset for new family
        setSetupMode('manual');
        setFamilyName('');
        setFamilySlug('');
        setSlugError('');
        setSlugValidated(false);
        setGeneratedToken(null);
        setTokenPassword('');
        setConfirmTokenPassword('');
        setUseSystemPin(true);
        setSystemPin('');
        setConfirmSystemPin('');
        setCaretakers([]);
        setNewCaretaker({
          loginId: '',
          name: '',
          type: '',
          role: 'ADMIN',
          securityPin: '',
        });
        setBabyFirstName('');
        setBabyLastName('');
        setBabyBirthDate(null);
        setBabyGender('');
        setFeedWarningTime('02:00');
        setDiaperWarningTime('03:00');
        setError('');
      }
    }
  }, [isOpen, isEditing, family]);

  // Get auth headers for API calls
  const getAuthHeaders = () => {
    const authToken = localStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
    };
  };

  // Generate a unique slug
  const generateSlug = async () => {
    try {
      const response = await fetch('/api/family/generate-slug', {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      
      if (data.success && data.data.slug) {
        setFamilySlug(data.data.slug);
        setSlugError('');
        setSlugValidated(false); // Reset validation state for new slug
      } else {
        setSlugError('Failed to generate unique URL');
      }
    } catch (error) {
      console.error('Error generating slug:', error);
      setSlugError('Error generating URL');
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

  // Check slug uniqueness
  const checkSlugUniqueness = useCallback(async (slug: string) => {
    if (!slug || slug.trim() === '') {
      setSlugError('');
      setSlugValidated(false);
      return;
    }

    // Basic slug validation
    const slugPattern = /^[a-z0-9-]+$/;
    if (!slugPattern.test(slug)) {
      setSlugError('Slug can only contain lowercase letters, numbers, and hyphens');
      setSlugValidated(false);
      return;
    }

    if (slug.length < 3) {
      setSlugError('Slug must be at least 3 characters long');
      setSlugValidated(false);
      return;
    }

    if (slug.length > 50) {
      setSlugError('Slug must be less than 50 characters');
      setSlugValidated(false);
      return;
    }

    setCheckingSlug(true);
    setSlugValidated(false);
    try {
      const response = await fetch(`/api/family/by-slug/${encodeURIComponent(slug)}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      
      if (data.success && data.data) {
        setSlugError('This URL is already taken');
        setSlugValidated(false);
      } else {
        setSlugError('');
        setSlugValidated(true);
      }
    } catch (error) {
      console.error('Error checking slug:', error);
      setSlugError('Error checking URL availability');
      setSlugValidated(false);
    } finally {
      setCheckingSlug(false);
    }
  }, []);

  // Debounced slug check
  useEffect(() => {
    if (familySlug) {
      const timeoutId = setTimeout(() => {
        checkSlugUniqueness(familySlug);
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [familySlug, checkSlugUniqueness]);

  // Add caretaker to list
  const addCaretaker = () => {
    // Validate caretaker
    if (newCaretaker.loginId.length !== 2) {
      setError('Login ID must be exactly 2 digits');
      return;
    }
    
    if (!/^\d+$/.test(newCaretaker.loginId)) {
      setError('Login ID must contain only digits');
      return;
    }
    
    if (newCaretaker.loginId === '00') {
      setError('Login ID "00" is reserved for system use');
      return;
    }
    
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
    
    setCaretakers([...caretakers, { ...newCaretaker }]);
    setNewCaretaker({
      loginId: '',
      name: '',
      type: '',
      role: 'USER',
      securityPin: '',
    });
    setError('');
  };

  // Remove caretaker from list
  const removeCaretaker = (index: number) => {
    const updatedCaretakers = [...caretakers];
    updatedCaretakers.splice(index, 1);
    setCaretakers(updatedCaretakers);
  };

  // Generate setup token (simplified - no family details required)
  const handleGenerateToken = async () => {
    setError('');
    
    // Validate password
    if (!tokenPassword.trim()) {
      setError('Please enter a setup password');
      return;
    }
    
    if (tokenPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    if (tokenPassword !== confirmTokenPassword) {
      setError('Passwords do not match');
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await fetch('/api/family/create-setup-link', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          password: tokenPassword,
        }),
      });

      if (!response.ok) {
        // Check if this is an account expiration error
        if (response.status === 403) {
          const { isExpirationError, errorData } = await handleExpirationError(
            response, 
            showToast, 
            'creating setup invitations'
          );
          if (isExpirationError) {
            // Don't close the form, let user see the error
            return;
          }
          // If it's a 403 but not an expiration error, use the errorData we got
          if (errorData) {
            setError(errorData.error || 'Failed to generate setup token');
            return;
          }
        }
        
        // For other errors, parse and show error
        const errorData = await response.json();
        setError(errorData.error || 'Failed to generate setup token');
        return;
      }

      const data = await response.json();
      
      if (data.success) {
        setGeneratedToken(data.data.setupUrl);
        onFamilyChange();
      } else {
        setError(data.error || 'Failed to generate setup token');
      }
    } catch (error) {
      console.error('Error generating setup token:', error);
      setError('Failed to generate setup token. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle manual family creation
  const handleManualSave = async () => {
    setError('');
    
    // Validate family data
    if (!familyName.trim()) {
      setError('Please enter a family name');
      return;
    }

    if (!familySlug.trim()) {
      setError('Please enter a family URL');
      return;
    }

    // Force slug validation before proceeding
    if (familySlug) {
      await checkSlugUniqueness(familySlug);
    }

    if (slugError) {
      setError('Please fix the URL error before proceeding');
      return;
    }

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
    } else {
      if (caretakers.length === 0) {
        setError('Please add at least one caretaker');
        return;
      }
    }

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

      // Create family using the setup/start endpoint with isNewFamily flag
      const familyResponse = await fetch('/api/setup/start', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: familyName,
          slug: familySlug,
          isNewFamily: true, // This tells the API to create a new family instead of updating the default one
        }),
      });

      if (!familyResponse.ok) {
        // Check if this is an account expiration error
        if (familyResponse.status === 403) {
          const { isExpirationError, errorData } = await handleExpirationError(
            familyResponse, 
            showToast, 
            'creating families'
          );
          if (isExpirationError) {
            // Don't close the form, let user see the error
            return;
          }
          // If it's a 403 but not an expiration error, use the errorData we got
          if (errorData) {
            throw new Error(errorData.error || 'Failed to create family');
          }
          // Fallback if errorData is somehow missing
          throw new Error('Failed to create family');
        }
        
        // For other errors, parse and throw
        const errorData = await familyResponse.json();
        throw new Error(errorData.error || 'Failed to create family');
      }

      const familyData = await familyResponse.json();
      
      if (!familyData.success) {
        throw new Error(familyData.error || 'Failed to create family');
      }

      const createdFamilyId = familyData.data.id;

      // Save security settings
      if (useSystemPin) {
        const settingsResponse = await fetch(`/api/settings?familyId=${createdFamilyId}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            familyName: familyName, // Set the actual family name
            securityPin: systemPin,
          }),
        });
        
        if (!settingsResponse.ok) {
          // Check if this is an account expiration error
          if (settingsResponse.status === 403) {
            const { isExpirationError } = await handleExpirationError(
              settingsResponse, 
              showToast, 
              'saving security settings'
            );
            if (isExpirationError) {
              return;
            }
          }
          throw new Error('Failed to save security PIN');
        }
      } else {
        // Save caretakers
        for (const caretaker of caretakers) {
          const caretakerResponse = await fetch('/api/caretaker', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              ...caretaker,
              familyId: createdFamilyId,
            }),
          });
          
          if (!caretakerResponse.ok) {
            // Check if this is an account expiration error
            if (caretakerResponse.status === 403) {
              const { isExpirationError } = await handleExpirationError(
                caretakerResponse, 
                showToast, 
                'adding caretakers'
              );
              if (isExpirationError) {
                return;
              }
            }
            throw new Error(`Failed to save caretaker: ${caretaker.name}`);
          }
        }

        // Update settings with the actual family name (when using individual caretakers)
        const settingsResponse = await fetch(`/api/settings?familyId=${createdFamilyId}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            familyName: familyName, // Set the actual family name
          }),
        });
        
        if (!settingsResponse.ok) {
          // Check if this is an account expiration error
          if (settingsResponse.status === 403) {
            const { isExpirationError } = await handleExpirationError(
              settingsResponse, 
              showToast, 
              'saving security settings'
            );
            if (isExpirationError) {
              return;
            }
          }
          throw new Error('Failed to update family name in settings');
        }
      }

      // Save baby information
      const babyResponse = await fetch('/api/baby/create', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          firstName: babyFirstName,
          lastName: babyLastName,
          birthDate: babyBirthDate.toISOString(),
          gender: babyGender,
          feedWarningTime,
          diaperWarningTime,
          familyId: createdFamilyId,
        }),
      });
      
      if (!babyResponse.ok) {
        // Check if this is an account expiration error
        if (babyResponse.status === 403) {
          const { isExpirationError } = await handleExpirationError(
            babyResponse, 
            showToast, 
            'adding baby information'
          );
          if (isExpirationError) {
            return;
          }
        }
        throw new Error('Failed to save baby information');
      }

      // Success - close form and refresh
      onFamilyChange();
      onClose();
    } catch (error) {
      console.error('Error creating family:', error);
      setError(error instanceof Error ? error.message : 'Failed to create family. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormPage
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Family' : 'Add New Family'}
      description={isEditing ? 'Edit family information' : 'Create a new family by choosing your preferred setup method'}
    >
      <FormPageContent>
        <div className="space-y-6">
          {/* Setup Mode Selection (only for new families) */}
          {!isEditing && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 family-form-heading">Setup Method</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="manual"
                    checked={setupMode === 'manual'}
                    onChange={() => setSetupMode('manual')}
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500"
                  />
                  <label htmlFor="manual" className="text-sm font-medium text-gray-700 family-form-radio-label">
                    Add family manually (complete setup now)
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="token"
                    checked={setupMode === 'token'}
                    onChange={() => setSetupMode('token')}
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500"
                  />
                  <label htmlFor="token" className="text-sm font-medium text-gray-700 family-form-radio-label">
                    Generate setup invitation (let family complete their own setup)
                  </label>
                </div>
              </div>
              <p className="text-sm text-gray-500 family-form-text-muted">
                {setupMode === 'manual' 
                  ? 'You will configure all family details, security, and add the first baby now.'
                  : 'You will create a secure invitation link that the family can use to set up their own name, PIN, caretakers, and baby information.'
                }
              </p>
            </div>
          )}

          {/* Token Mode - Simple Token Generation */}
          {!isEditing && setupMode === 'token' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 family-form-heading">Generate Setup Invitation</h3>
              
              <p className="text-sm text-gray-600 family-form-text-secondary">
                Create a setup invitation link that families can use to configure their own:
              </p>
              <ul className="text-sm text-gray-600 family-form-text-secondary list-disc list-inside ml-4 space-y-1">
                <li>Family name and URL</li>
                <li>Security PIN or individual caretaker accounts</li>
                <li>Baby information</li>
              </ul>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700 family-form-text mb-1">Setup Password</Label>
                  <Input
                    type="password"
                    value={tokenPassword}
                    onChange={(e) => setTokenPassword(e.target.value)}
                    placeholder="Enter password for setup access"
                    disabled={loading}
                    minLength={6}
                  />
                  <p className="text-xs text-gray-500 family-form-text-muted mt-1">
                    This password will be required to access the setup invitation
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 family-form-text mb-1">Confirm Password</Label>
                  <Input
                    type="password"
                    value={confirmTokenPassword}
                    onChange={(e) => setConfirmTokenPassword(e.target.value)}
                    placeholder="Confirm setup password"
                    disabled={loading}
                    minLength={6}
                  />
                </div>
              </div>

              {generatedToken && (
                <div className="space-y-4 p-4 bg-green-50 family-form-success-bg border border-green-200 family-form-success-border rounded-lg">
                  <h4 className="text-md font-semibold text-green-800 family-form-success-heading">Setup Invitation Generated!</h4>
                  <p className="text-sm text-green-700 family-form-success-text">
                    Share this link with the family to let them complete their setup:
                  </p>
                  <div className="flex items-center gap-2">
                    <ShareButton
                      familySlug={generatedToken.replace(/^\//, '')} // Remove leading slash
                      familyName="Family Setup Invitation"
                      appConfig={appConfig || undefined}
                      urlSuffix="" // Don't add /login to setup URLs
                      variant="outline"
                      size="sm"
                      showText={true}
                    />
                  </div>
                  <p className="text-xs text-green-600 family-form-success-text-muted">
                    This setup link will expire in 7 days and can only be used once.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Manual Mode - Family Information Section */}
          {!isEditing && setupMode === 'manual' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 family-form-heading">Family Information</h3>
              
              <div>
                <Label className="text-sm font-medium text-gray-700 family-form-text mb-1">Family Name</Label>
                <Input
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="Enter family name"
                  disabled={loading}
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 family-form-text mb-1">Family URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={familySlug}
                    onChange={(e) => setFamilySlug(e.target.value.toLowerCase())}
                    onClick={handleSlugFieldClick}
                    placeholder="family-url"
                    className={cn(
                      slugError ? 'border-red-500' : '',
                      checkingSlug ? 'border-blue-400' : '',
                      !slugError && familySlug && !checkingSlug ? 'border-green-500' : ''
                    )}
                    disabled={loading || checkingSlug}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateSlug}
                    disabled={loading || checkingSlug}
                  >
                    Generate
                  </Button>
                </div>
                {slugError && (
                  <p className="text-red-600 text-sm mt-1">{slugError}</p>
                )}
                {checkingSlug && (
                  <p className="text-blue-600 text-sm mt-1">Checking availability...</p>
                )}
                {!slugError && familySlug && !checkingSlug && slugValidated && (
                  <p className="text-green-600 text-sm mt-1">URL is available</p>
                )}
                <p className="text-sm text-gray-500 family-form-text-muted mt-1">
                  Your family will be accessible at: /{familySlug || 'your-family-url'}
                </p>
              </div>
            </div>
          )}

          {/* Manual Mode - Security Setup */}
          {!isEditing && setupMode === 'manual' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 family-form-heading">Security Setup</h3>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="systemPin"
                    checked={useSystemPin}
                    onChange={() => setUseSystemPin(true)}
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500"
                  />
                  <label htmlFor="systemPin" className="text-sm font-medium text-gray-700 family-form-radio-label">
                    Use system-wide PIN
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="caretakers"
                    checked={!useSystemPin}
                    onChange={() => setUseSystemPin(false)}
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500"
                  />
                  <label htmlFor="caretakers" className="text-sm font-medium text-gray-700 family-form-radio-label">
                    Add caretakers with individual PINs
                  </label>
                </div>
              </div>

              {useSystemPin ? (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700 family-form-text mb-1">System PIN (6-10 digits)</Label>
                    <Input
                      type="password"
                      value={systemPin}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 10) {
                          setSystemPin(value);
                        }
                      }}
                      placeholder="Enter PIN"
                      disabled={loading}
                      minLength={6}
                      maxLength={10}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700 family-form-text mb-1">Confirm PIN</Label>
                    <Input
                      type="password"
                      value={confirmSystemPin}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 10) {
                          setConfirmSystemPin(value);
                        }
                      }}
                      placeholder="Confirm PIN"
                      disabled={loading}
                      minLength={6}
                      maxLength={10}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-4 p-4 border border-gray-200 family-form-border rounded-lg">
                    <h4 className="text-md font-semibold text-gray-800 family-form-heading">Add Caretaker</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm font-medium text-gray-700 family-form-text mb-1">Login ID (2 digits)</Label>
                        <Input
                          value={newCaretaker.loginId}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');
                            if (value.length <= 2) {
                              setNewCaretaker({ ...newCaretaker, loginId: value });
                            }
                          }}
                          placeholder="e.g., 01, 12, 99"
                          disabled={loading}
                          maxLength={2}
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700 family-form-text mb-1">Role</Label>
                        <Select
                          value={newCaretaker.role}
                          onValueChange={(value) => 
                            setNewCaretaker({ 
                              ...newCaretaker, 
                              role: value as 'ADMIN' | 'USER' 
                            })
                          }
                          disabled={loading || caretakers.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                            <SelectItem value="USER">User</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700 family-form-text mb-1">Name</Label>
                      <Input
                        value={newCaretaker.name}
                        onChange={(e) => 
                          setNewCaretaker({ ...newCaretaker, name: e.target.value })
                        }
                        placeholder="Full name"
                        disabled={loading}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm font-medium text-gray-700 family-form-text mb-1">Type (Optional)</Label>
                        <Input
                          value={newCaretaker.type}
                          onChange={(e) => 
                            setNewCaretaker({ ...newCaretaker, type: e.target.value })
                          }
                          placeholder="Parent, Nanny, etc."
                          disabled={loading}
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700 family-form-text mb-1">PIN (6-10 digits)</Label>
                        <Input
                          type="password"
                          value={newCaretaker.securityPin}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');
                            if (value.length <= 10) {
                              setNewCaretaker({ ...newCaretaker, securityPin: value });
                            }
                          }}
                          placeholder="PIN"
                          disabled={loading}
                          minLength={6}
                          maxLength={10}
                        />
                      </div>
                    </div>
                    <Button 
                      onClick={addCaretaker}
                      disabled={loading}
                      className="w-full"
                    >
                      Add Caretaker
                    </Button>
                      </div>
                  
                  {caretakers.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-md font-semibold text-gray-800 family-form-heading">Caretakers</h4>
                      <ul className="space-y-2">
                        {caretakers.map((caretaker, index) => (
                          <li 
                            key={index} 
                            className="flex justify-between items-center bg-gray-50 family-form-caretaker-item p-2 rounded"
                          >
                            <div>
                              <span className="font-medium">{caretaker.name}</span>
                              <span className="text-xs text-gray-500 family-form-caretaker-text-muted ml-2">
                                ({caretaker.loginId}) - {caretaker.role}
                              </span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => removeCaretaker(index)}
                              disabled={loading}
                            >
                              Remove
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Manual Mode - Baby Setup */}
          {!isEditing && setupMode === 'manual' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 family-form-heading">Baby Information</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-gray-700 family-form-text mb-1">First Name</Label>
                  <Input
                    value={babyFirstName}
                    onChange={(e) => setBabyFirstName(e.target.value)}
                    placeholder="First name"
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 family-form-text mb-1">Last Name</Label>
                  <Input
                    value={babyLastName}
                    onChange={(e) => setBabyLastName(e.target.value)}
                    placeholder="Last name"
                    disabled={loading}
                  />
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-700 family-form-text mb-1">Birth Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="input"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !babyBirthDate && "text-gray-400"
                      )}
                      disabled={loading}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {babyBirthDate ? format(babyBirthDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[200]" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={babyBirthDate || undefined}
                      onSelect={(date: Date | undefined) => {
                        if (date) setBabyBirthDate(date);
                      }}
                      maxDate={new Date()}
                      initialFocus
                      className="rounded-md border"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-700 family-form-text mb-1">Gender</Label>
                <Select
                  value={babyGender}
                  onValueChange={(value) => setBabyGender(value as Gender)}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-gray-700 family-form-text mb-1">Feed Warning Time</Label>
                  <Input
                    type="text"
                    pattern="[0-9]{2}:[0-9]{2}"
                    value={feedWarningTime}
                    onChange={(e) => setFeedWarningTime(e.target.value)}
                    placeholder="02:00"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 family-form-text-muted mt-1">Format: hh:mm</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 family-form-text mb-1">Diaper Warning Time</Label>
                  <Input
                    type="text"
                    pattern="[0-9]{2}:[0-9]{2}"
                    value={diaperWarningTime}
                    onChange={(e) => setDiaperWarningTime(e.target.value)}
                    placeholder="03:00"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 family-form-text-muted mt-1">Format: hh:mm</p>
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="p-4 bg-red-50 family-form-error-bg border border-red-200 family-form-error-border rounded text-red-600 family-form-error-text text-sm">
              {error}
            </div>
          )}
        </div>
      </FormPageContent>
      
      <FormPageFooter>
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        {!isEditing && setupMode === 'token' ? (
          <Button 
            onClick={handleGenerateToken} 
            disabled={loading || !tokenPassword || !confirmTokenPassword || tokenPassword !== confirmTokenPassword}
          >
            {loading ? 'Generating...' : 'Generate Setup Invitation'}
          </Button>
        ) : (
          <Button 
            onClick={handleManualSave} 
            disabled={loading || !familyName || !familySlug || !!slugError}
          >
            {loading ? 'Saving...' : 'Save Family'}
          </Button>
        )}
      </FormPageFooter>
    </FormPage>
  );
}
