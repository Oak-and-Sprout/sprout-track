import { Caretaker as PrismaCaretaker, UserRole } from '@prisma/client';

// Extended type to include the new loginId field
interface Caretaker extends PrismaCaretaker {
  loginId: string;
}
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { useState, useEffect } from 'react';
import { useLocalization } from '@/src/context/localization';

interface CaretakerModalProps {
  open: boolean;
  onClose: () => void;
  isEditing: boolean;
  caretaker: (PrismaCaretaker & { loginId?: string }) | null;
}

const defaultFormData = {
  loginId: '',
  name: '',
  type: '',
  role: 'USER' as UserRole,
  securityPin: '',
};

export default function CaretakerModal({
  open,
  onClose,
  isEditing,
  caretaker,
}: CaretakerModalProps) {
  const { t } = useLocalization();
  const [formData, setFormData] = useState(defaultFormData);
  const [confirmPin, setConfirmPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isFirstCaretaker, setIsFirstCaretaker] = useState(false);

  // Reset form when modal opens/closes or caretaker changes
  useEffect(() => {
    if (caretaker && open) {
      setFormData({
        loginId: caretaker.loginId || '',
        name: caretaker.name,
        type: caretaker.type || '',
        role: caretaker.role || 'USER',
        securityPin: caretaker.securityPin,
      });
      setConfirmPin(caretaker.securityPin);
      setIsFirstCaretaker(false);
    } else if (!open) {
      setFormData(defaultFormData);
      setConfirmPin('');
      setError('');
    }
  }, [caretaker, open]);

  // Check if this is the first caretaker in the system
  useEffect(() => {
    if (!isEditing && open) {
      const checkFirstCaretaker = async () => {
        try {
          const response = await fetch('/api/caretaker');
          if (response.ok) {
            const data = await response.json();
            const isFirst = !data.data || data.data.length === 0;
            setIsFirstCaretaker(isFirst);
            
            // If this is the first caretaker, set role to ADMIN
            if (isFirst) {
              setFormData(prev => ({ ...prev, role: 'ADMIN' }));
            }
          }
        } catch (error) {
          console.error('Error checking caretakers:', error);
        }
      };
      
      checkFirstCaretaker();
    }
  }, [isEditing, open]);

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
      setError('Login ID must be exactly 2 characters');
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
      
      const response = await fetch('/api/caretaker', {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          id: caretaker?.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save caretaker');
      }

      onClose();
    } catch (error) {
      console.error('Error saving caretaker:', error);
      setError(error instanceof Error ? error.message : 'Failed to save caretaker');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData(defaultFormData);
    setConfirmPin('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="dialog-content !p-4 sm:!p-6">
        <DialogHeader className="dialog-header">
          <DialogTitle className="dialog-title">
            {isEditing ? 'Edit Caretaker' : 'Add New Caretaker'}
          </DialogTitle>
          <DialogDescription className="dialog-description">
            {isEditing 
              ? "Update caretaker information" 
              : "Enter caretaker information to add them to the system"
            }
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">{t('Login ID')}</label>
            <Input
              value={formData.loginId}
              onChange={(e) => {
                const value = e.target.value;
                // Allow any input up to 2 characters
                setFormData({ ...formData, loginId: value });
              }}
              className="w-full"
              placeholder="Enter 2-digit login ID"
              maxLength={2}
              required
              autoComplete="off"
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('Login ID must be exactly 2 digits or characters (currently:')} {formData.loginId.length}/2)
            </p>
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
            <label className="form-label">{t('Type (Optional)')}</label>
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
            <label className="form-label">{t('Role')}</label>
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
          <div>
            <label className="form-label">{t('Security PIN')}</label>
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
            <p className="text-xs text-gray-500 mt-1">{t('PIN must be between 6 and 10 digits')}</p>
          </div>
          <div>
            <label className="form-label">{t('Confirm PIN')}</label>
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
          
          <div className="grid grid-cols-2 sm:flex sm:justify-end gap-3 mt-6">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              className="hover:bg-slate-50"
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
                ? 'Saving...' 
                : isEditing 
                  ? 'Save Changes' 
                  : 'Add Caretaker'
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
