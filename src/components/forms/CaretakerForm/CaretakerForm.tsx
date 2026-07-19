'use client';

import { Caretaker as PrismaCaretaker, UserRole } from '@prisma/client';
import { useState, useEffect, useId } from 'react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
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
import { StorybookDrawer } from '@/src/components/ui/storybook-drawer';
import { caretakerFormStyles } from './caretaker-form.styles';
import { useToast } from '@/src/components/ui/toast';
import { handleExpirationError } from '@/src/lib/expiration-error-handler';
import { useLocalization } from '@/src/context/localization';

// Extended type to include the loginId field
interface Caretaker extends PrismaCaretaker {
  loginId: string;
}

interface CaretakerFormProps {
  isOpen: boolean;
  onClose: () => void;
  isEditing: boolean;
  caretaker: (PrismaCaretaker & { loginId?: string }) | null;
  onCaretakerChange?: () => void;
  /** 'storybook' renders the stacked storybook drawer (account manager); default is the classic FormPage. */
  appearance?: 'default' | 'storybook';
}

const defaultFormData = {
  loginId: '',
  name: '',
  type: '',
  role: 'USER' as UserRole,
  inactive: false,
  securityPin: '',
};

export default function CaretakerForm({
  isOpen,
  onClose,
  isEditing,
  caretaker,
  onCaretakerChange,
  appearance = 'default',
}: CaretakerFormProps) {
  const { t } = useLocalization();
  const { showToast } = useToast();
  const formId = useId();
  const [formData, setFormData] = useState(defaultFormData);
  const [confirmPin, setConfirmPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isFirstCaretaker, setIsFirstCaretaker] = useState(false);
  const [existingCaretakers, setExistingCaretakers] = useState<string[]>([]);
  const [loginIdError, setLoginIdError] = useState('');

  // Reset form when form opens/closes or caretaker changes
  useEffect(() => {
    if (caretaker && isOpen && !isSubmitting) {
      setFormData({
        loginId: caretaker.loginId || '',
        name: caretaker.name,
        type: caretaker.type || '',
        role: caretaker.role || 'USER',
        inactive: caretaker.inactive || false,
        securityPin: '', // never pre-filled — PINs are not returned by the API; blank means "keep current"
      });
      setConfirmPin('');
      setIsFirstCaretaker(false);
    } else if (!isOpen && !isSubmitting) {
      setFormData(defaultFormData);
      setConfirmPin('');
      setError('');
      setLoginIdError('');
    }
  }, [caretaker?.id, isOpen, isSubmitting]); // Use caretaker.id instead of full caretaker object to prevent unnecessary resets

  // Validate login ID for duplicates
  useEffect(() => {
    if (formData.loginId && formData.loginId.length === 2) {
      if (existingCaretakers.includes(formData.loginId)) {
        setLoginIdError(t('This Login ID is already in use. Please choose a different one.'));
      } else if (formData.loginId === '00') {
        setLoginIdError(t('Login ID "00" is reserved for system use. Please choose a different one.'));
      } else {
        setLoginIdError('');
      }
    } else {
      setLoginIdError('');
    }
  }, [formData.loginId, existingCaretakers]);

  // Check if this is the first caretaker in the system and fetch existing caretakers for validation
  useEffect(() => {
    if (isOpen) {
      const fetchCaretakers = async () => {
        try {
          // Get the JWT token from localStorage
          const token = localStorage.getItem('authToken');

          // Check if user is a system administrator and get family context
          let isSysAdmin = false;
          let familyId = null;

          if (token) {
            try {
              const payload = token.split('.')[1];
              const decodedPayload = JSON.parse(atob(payload));
              isSysAdmin = decodedPayload.isSysAdmin || false;

              // For sysadmins, get the family context from session storage
              if (isSysAdmin) {
                const familyContext = sessionStorage.getItem('sysadmin-family-context');
                if (familyContext) {
                  const family = JSON.parse(familyContext);
                  familyId = family.id;
                }
              }
            } catch (error) {
              console.error('Error parsing JWT token:', error);
            }
          }

          // Build URL with family context for sysadmins
          let url = '/api/caretaker';
          if (isSysAdmin && familyId) {
            url += `?familyId=${familyId}`;
          }

          const response = await fetch(url, {
            headers: {
              'Authorization': token ? `Bearer ${token}` : '',
            },
          });
          if (response.ok) {
            const data = await response.json();
            const isFirst = !data.data || data.data.length === 0;
            setIsFirstCaretaker(isFirst && !isEditing);
            
            // Store existing login IDs for validation (excluding current caretaker if editing)
            const existingLoginIds = data.data ? data.data
              .filter((c: any) => !isEditing || c.id !== caretaker?.id)
              .map((c: any) => c.loginId) : [];
            setExistingCaretakers(existingLoginIds);
            
            // If this is the first caretaker and we're creating, set role to ADMIN
            if (isFirst && !isEditing) {
              setFormData(prev => ({ ...prev, role: 'ADMIN' }));
            }
          }
        } catch (error) {
          console.error('Error fetching caretakers:', error);
        }
      };
      
      fetchCaretakers();
    }
  }, [isEditing, isOpen, caretaker?.id]);

  const validatePIN = () => {
    // When editing, a blank PIN means "keep the current PIN" (the PIN is never sent
    // back from the server), so skip validation and leave it unchanged.
    if (isEditing && !formData.securityPin) {
      return true;
    }
    if (formData.securityPin.length < 6) {
      setError(t('PIN must be at least 6 digits'));
      return false;
    }
    if (formData.securityPin.length > 10) {
      setError(t('PIN cannot be longer than 10 digits'));
      return false;
    }
    if (formData.securityPin !== confirmPin) {
      setError(t('PINs do not match'));
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate form
    if (!formData.loginId.trim()) {
      setError(t('Login ID is required'));
      return;
    }

    if (formData.loginId.length !== 2) {
      setError(t('Login ID must be exactly 2 digits'));
      return;
    }

    if (!/^\d{2}$/.test(formData.loginId)) {
      setError(t('Login ID must contain only digits'));
      return;
    }

    // Check for client-side login ID validation errors
    if (loginIdError) {
      setError(loginIdError);
      return;
    }

    if (!formData.name.trim()) {
      setError(t('Name is required'));
      return;
    }

    if (!validatePIN()) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      // Get the JWT token from localStorage
      const token = localStorage.getItem('authToken');

      // Check if user is a system administrator and get family context
      let isSysAdmin = false;
      let familyId = null;

      if (token) {
        try {
          const payload = token.split('.')[1];
          const decodedPayload = JSON.parse(atob(payload));
          isSysAdmin = decodedPayload.isSysAdmin || false;

          // For sysadmins, get the family context from session storage
          if (isSysAdmin) {
            const familyContext = sessionStorage.getItem('sysadmin-family-context');
            if (familyContext) {
              const family = JSON.parse(familyContext);
              familyId = family.id;
            }
          }
        } catch (error) {
          console.error('Error parsing JWT token:', error);
        }
      }

      // Prepare request body with family context for sysadmins
      const requestBody: any = {
        ...formData,
        id: caretaker?.id,
        ...(isSysAdmin && familyId && { familyId })
      };

      // When editing, only send securityPin if a new one was entered; a blank field
      // means "keep the existing PIN" (and the server ignores a blank PIN anyway).
      if (isEditing && !formData.securityPin) {
        delete requestBody.securityPin;
      }

      const response = await fetch('/api/caretaker', {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        // Check if this is an account expiration error
        if (response.status === 403) {
          const { isExpirationError, errorData } = await handleExpirationError(
            response, 
            showToast, 
            'managing caretakers'
          );
          if (isExpirationError) {
            // Don't close the form, let user see the error
            setError('');
            return;
          }
          // If it's a 403 but not an expiration error, use the errorData we got
          if (errorData) {
            showToast({
              variant: 'error',
              title: 'Error',
              message: errorData.error || 'Failed to save caretaker',
              duration: 5000,
            });
            throw new Error(errorData.error || 'Failed to save caretaker');
          }
        }
        
        // For other errors, parse and show toast
        const errorData = await response.json();
        showToast({
          variant: 'error',
          title: 'Error',
          message: errorData.error || 'Failed to save caretaker',
          duration: 5000,
        });
        throw new Error(errorData.error || 'Failed to save caretaker');
      }

      if (onCaretakerChange) {
        onCaretakerChange();
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving caretaker:', error);
      // Only set local error if it's not an expiration error (already handled above)
      if (!(error instanceof Error && error.message.includes('Account Expired'))) {
        setError(error instanceof Error ? error.message : 'Failed to save caretaker');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (appearance === 'storybook') {
    return (
      <StorybookDrawer
        open={isOpen}
        onClose={onClose}
        onBack={onClose}
        title={isEditing ? t('Edit caretaker') : t('Add a caretaker')}
        subtitle={t('Anyone who helps — parents, grandparents, the nanny.')}
        footer={
          <>
            <button type="button" className="sb-btn sb-ghost" onClick={onClose}>{t('Cancel')}</button>
            <button type="submit" form="sb-caretaker-form" className="sb-btn" disabled={isSubmitting}>
              {isSubmitting ? t('Saving…') : isEditing ? t('Save changes') : t('Add caretaker')}
            </button>
          </>
        }
      >
        <form id="sb-caretaker-form" onSubmit={handleSubmit} className="sb-f-grid">
          <div className="sb-f2">
            <div>
              <label className="sb-fl" htmlFor="sbCtName">{t('Name')}</label>
              <input id="sbCtName" className="sb-fi" value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div>
              <label className="sb-fl" htmlFor="sbCtType">
                {t('Relationship')} <span className="sb-fl-opt">({t('optional')})</span>
              </label>
              <input id="sbCtType" className="sb-fi" placeholder={t('Grandma, nanny, dad…')}
                value={formData.type || ''}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="sb-fl" htmlFor="sbCtRole">{t('Role')}</label>
            <select id="sbCtRole" className="sb-fi" value={formData.role} disabled={isFirstCaretaker}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}>
              <option value="USER">{t('Regular user')}</option>
              <option value="ADMIN">{t('Administrator')}</option>
            </select>
            <p className="sb-fh">{t('Admins can edit family settings and people.')}</p>
          </div>
          <div className="sb-fgroup">
            <b>{t('How they sign in')}</b>
            <p className="sb-fh">{t("A 2-digit ID and a PIN — easy enough for grandma's phone.")}</p>
            <div className="sb-f2">
              <div>
                <label className="sb-fl" htmlFor="sbCtId">{t('Login ID')}</label>
                <input id="sbCtId" className="sb-fi" maxLength={2} inputMode="numeric" required
                  value={formData.loginId}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    // Only allow digits up to 2 characters
                    if (value.length <= 2) {
                      setFormData({ ...formData, loginId: value });
                    }
                  }} />
                {loginIdError && <p className="sb-form-error">{loginIdError}</p>}
              </div>
              <div>
                <label className="sb-fl" htmlFor="sbCtPin">
                  {t('PIN')} <span className="sb-fl-opt">({t('6–10 digits')})</span>
                </label>
                <input id="sbCtPin" className="sb-fi" type="password" maxLength={10} inputMode="numeric"
                  required={!isEditing} placeholder="••••••"
                  value={formData.securityPin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 10) {
                      setFormData({ ...formData, securityPin: value });
                    }
                  }} />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <label className="sb-fl" htmlFor="sbCtPin2">{t('Confirm PIN')}</label>
              <input id="sbCtPin2" className="sb-fi" type="password" maxLength={10} inputMode="numeric"
                required={!isEditing} placeholder={t('Same PIN again')}
                value={confirmPin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 10) {
                    setConfirmPin(value);
                  }
                }} />
            </div>
          </div>
          <label className="sb-fcheck">
            <input type="checkbox" checked={formData.inactive} disabled={isFirstCaretaker}
              onChange={(e) => setFormData({ ...formData, inactive: e.target.checked })} />
            <span>{t("Mark as inactive — they keep their history but can't sign in.")}</span>
          </label>
          {error && <p className="sb-form-error">{error}</p>}
        </form>
      </StorybookDrawer>
    );
  }

  return (
    <FormPage 
      isOpen={isOpen} 
      onClose={onClose}
      title={isEditing ? t('Edit Caretaker') : t('Add New Caretaker')}
      description={isEditing 
        ? t("Update caretaker information") 
        : t("Enter caretaker information to add them to the system")
      }
    >
      <form onSubmit={handleSubmit} className="h-full flex flex-col overflow-hidden">
        <FormPageContent className={caretakerFormStyles.content}>
          <div>
            <label htmlFor={`${formId}-loginId`} className="form-label">{t('Login ID')}</label>
            <Input
              id={`${formId}-loginId`}
              value={formData.loginId}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                // Only allow digits up to 2 characters
                if (value.length <= 2) {
                  setFormData({ ...formData, loginId: value });
                }
              }}
              className={`w-full ${loginIdError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              placeholder={t("Enter 2-digit ID")}
              maxLength={2}
              required
              autoComplete="off"
              inputMode="numeric"
              pattern="\d*"
            />
            {loginIdError ? (
              <p className="text-xs text-red-500 mt-1">{loginIdError}</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                {t('Login ID must be exactly 2 digits (currently:')} {formData.loginId.length}/2)
              </p>
            )}
          </div>
          <div>
            <label htmlFor={`${formId}-name`} className="form-label">{t('Name')}</label>
            <Input
              id={`${formId}-name`}
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full"
              placeholder={t("Enter caretaker name")}
              required
            />
          </div>
          <div>
            <label htmlFor={`${formId}-type`} className="form-label">{t('Type (Optional)')}</label>
            <Input
              id={`${formId}-type`}
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value })
              }
              className="w-full"
              placeholder={t("Parent, Grandparent, Nanny, etc.")}
            />
          </div>
          <div>
            <label htmlFor={`${formId}-role`} className="form-label">{t('Role')}</label>
            <Select
              value={formData.role}
              onValueChange={(value) =>
                setFormData({ ...formData, role: value as UserRole })
              }
              disabled={isFirstCaretaker}
            >
              <SelectTrigger id={`${formId}-role`} className="w-full">
                <SelectValue placeholder={t("Select a role")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">{t('Regular User')}</SelectItem>
                <SelectItem value="ADMIN">{t('Administrator')}</SelectItem>
              </SelectContent>
            </Select>
            {isFirstCaretaker ? (
              <p className="text-xs text-amber-600 mt-1">
                {t('The first caretaker must be an administrator to manage the system')}
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                {t('Administrators have access to system settings and administrative functions')}
              </p>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={`${formId}-inactive`}
              checked={formData.inactive}
              onChange={(e) => setFormData({ ...formData, inactive: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              disabled={isFirstCaretaker}
            />
            <label htmlFor={`${formId}-inactive`} className="form-label mb-0">
              {t('Mark as inactive')}
            </label>
          </div>
          {formData.inactive && (
            <p className="text-xs text-amber-600 mt-1">
              {t('Inactive caretakers cannot log in to the system')}
            </p>
          )}
          <div>
            <label htmlFor={`${formId}-securityPin`} className="form-label">{t('Security PIN')}</label>
            <Input
              id={`${formId}-securityPin`}
              type="password"
              value={formData.securityPin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                if (value.length <= 10) {
                  setFormData({ ...formData, securityPin: value });
                }
              }}
              className="w-full"
              placeholder={isEditing ? t("Leave blank to keep current PIN") : t("Enter 6-10 digit PIN")}
              minLength={6}
              maxLength={10}
              pattern="\d*"
              required={!isEditing}
            />
            <p className="text-xs text-gray-500 mt-1">{isEditing ? t('Leave blank to keep the current PIN, or enter a new 6-10 digit PIN') : t('PIN must be between 6 and 10 digits')}</p>
          </div>
          <div>
            <label htmlFor={`${formId}-confirmPin`} className="form-label">{t('Confirm PIN')}</label>
            <Input
              id={`${formId}-confirmPin`}
              type="password"
              value={confirmPin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                if (value.length <= 10) {
                  setConfirmPin(value);
                }
              }}
              className="w-full"
              placeholder={t("Confirm PIN")}
              minLength={6}
              maxLength={10}
              pattern="\d*"
              required={!isEditing}
            />
          </div>

          {error && (
            <div className="text-sm text-red-500 font-medium">{error}</div>
          )}
        </FormPageContent>
        
        <FormPageFooter>
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('Cancel')}
            </Button>
            <Button
              type="submit"
              className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-700 hover:to-emerald-700"
              disabled={isSubmitting}
            >
              {isSubmitting 
                ? t('Saving...') 
                : isEditing 
                  ? t('Save Changes') 
                  : t('Add Caretaker')
              }
            </Button>
          </div>
        </FormPageFooter>
      </form>
    </FormPage>
  );
}
