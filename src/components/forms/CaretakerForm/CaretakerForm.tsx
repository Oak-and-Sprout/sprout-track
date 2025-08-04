'use client';

import { Caretaker as PrismaCaretaker, UserRole } from '@prisma/client';
import { useState, useEffect } from 'react';
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
import { caretakerFormStyles } from './caretaker-form.styles';

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
}: CaretakerFormProps) {
  const [formData, setFormData] = useState(defaultFormData);
  const [confirmPin, setConfirmPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isFirstCaretaker, setIsFirstCaretaker] = useState(false);
  const [existingCaretakers, setExistingCaretakers] = useState<string[]>([]);
  const [loginIdError, setLoginIdError] = useState('');

  // Reset form when form opens/closes or caretaker changes
  useEffect(() => {
    if (caretaker && isOpen) {
      setFormData({
        loginId: caretaker.loginId || '',
        name: caretaker.name,
        type: caretaker.type || '',
        role: caretaker.role || 'USER',
        inactive: (caretaker as any).inactive || false,
        securityPin: caretaker.securityPin,
      });
      setConfirmPin(caretaker.securityPin);
      setIsFirstCaretaker(false);
    } else if (!isOpen) {
      setFormData(defaultFormData);
      setConfirmPin('');
      setError('');
      setLoginIdError('');
    }
  }, [caretaker, isOpen]);

  // Validate login ID for duplicates
  useEffect(() => {
    if (formData.loginId && formData.loginId.length === 2) {
      if (existingCaretakers.includes(formData.loginId)) {
        setLoginIdError('This Login ID is already in use. Please choose a different one.');
      } else if (formData.loginId === '00') {
        setLoginIdError('Login ID "00" is reserved for system use. Please choose a different one.');
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
          
          // The backend will automatically scope this to the user's family
          const response = await fetch(`/api/caretaker`, {
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
    if (formData.securityPin.length < 6) {
      setError('PIN must be at least 6 digits');
      return false;
    }
    if (formData.securityPin.length > 10) {
      setError('PIN cannot be longer than 10 digits');
      return false;
    }
    if (formData.securityPin !== confirmPin) {
      setError('PINs do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate form
    if (!formData.loginId.trim()) {
      setError('Login ID is required');
      return;
    }

    if (formData.loginId.length !== 2) {
      setError('Login ID must be exactly 2 digits');
      return;
    }

    if (!/^\d{2}$/.test(formData.loginId)) {
      setError('Login ID must contain only digits');
      return;
    }

    // Check for client-side login ID validation errors
    if (loginIdError) {
      setError(loginIdError);
      return;
    }

    if (!formData.name.trim()) {
      setError('Name is required');
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
      
      const response = await fetch('/api/caretaker', {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          ...formData,
          id: caretaker?.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save caretaker');
      }

      if (onCaretakerChange) {
        onCaretakerChange();
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving caretaker:', error);
      setError(error instanceof Error ? error.message : 'Failed to save caretaker');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormPage 
      isOpen={isOpen} 
      onClose={onClose}
      title={isEditing ? 'Edit Caretaker' : 'Add New Caretaker'}
      description={isEditing 
        ? "Update caretaker information" 
        : "Enter caretaker information to add them to the system"
      }
    >
      <form onSubmit={handleSubmit} className="h-full flex flex-col overflow-hidden">
        <FormPageContent className={caretakerFormStyles.content}>
          <div>
            <label className="form-label">Login ID</label>
            <Input
              value={formData.loginId}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                // Only allow digits up to 2 characters
                if (value.length <= 2) {
                  setFormData({ ...formData, loginId: value });
                }
              }}
              className={`w-full ${loginIdError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              placeholder="Enter 2-digit ID"
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
                Login ID must be exactly 2 digits (currently: {formData.loginId.length}/2)
              </p>
            )}
          </div>
          <div>
            <label className="form-label">Name</label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full"
              placeholder="Enter caretaker name"
              required
            />
          </div>
          <div>
            <label className="form-label">Type (Optional)</label>
            <Input
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value })
              }
              className="w-full"
              placeholder="Parent, Grandparent, Nanny, etc."
            />
          </div>
          <div>
            <label className="form-label">Role</label>
            <Select
              value={formData.role}
              onValueChange={(value) =>
                setFormData({ ...formData, role: value as UserRole })
              }
              disabled={isFirstCaretaker}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">Regular User</SelectItem>
                <SelectItem value="ADMIN">Administrator</SelectItem>
              </SelectContent>
            </Select>
            {isFirstCaretaker ? (
              <p className="text-xs text-amber-600 mt-1">
                The first caretaker must be an administrator to manage the system
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                Administrators have access to system settings and administrative functions
              </p>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="inactive"
              checked={formData.inactive}
              onChange={(e) => setFormData({ ...formData, inactive: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              disabled={isFirstCaretaker}
            />
            <label htmlFor="inactive" className="form-label mb-0">
              Mark as inactive
            </label>
          </div>
          {formData.inactive && (
            <p className="text-xs text-amber-600 mt-1">
              Inactive caretakers cannot log in to the system
            </p>
          )}
          <div>
            <label className="form-label">Security PIN</label>
            <Input
              type="password"
              value={formData.securityPin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                if (value.length <= 10) {
                  setFormData({ ...formData, securityPin: value });
                }
              }}
              className="w-full"
              placeholder="Enter 6-10 digit PIN"
              minLength={6}
              maxLength={10}
              pattern="\d*"
              required
            />
            <p className="text-xs text-gray-500 mt-1">PIN must be between 6 and 10 digits</p>
          </div>
          <div>
            <label className="form-label">Confirm PIN</label>
            <Input
              type="password"
              value={confirmPin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                if (value.length <= 10) {
                  setConfirmPin(value);
                }
              }}
              className="w-full"
              placeholder="Confirm PIN"
              minLength={6}
              maxLength={10}
              pattern="\d*"
              required
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
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-700 hover:to-emerald-700"
              disabled={isSubmitting}
            >
              {isSubmitting 
                ? 'Saving...' 
                : isEditing 
                  ? 'Save Changes' 
                  : 'Add Caretaker'
              }
            </Button>
          </div>
        </FormPageFooter>
      </form>
    </FormPage>
  );
}
