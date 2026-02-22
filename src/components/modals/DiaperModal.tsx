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
import { DiaperType } from '@prisma/client';
import { DiaperLogResponse } from '@/app/api/types';
import { useLocalization } from '@/src/context/localization';

interface DiaperModalProps {
  open: boolean;
  onClose: () => void;
  babyId: string | undefined;
  initialTime: string;
  activity?: DiaperLogResponse;
  /**
   * Optional variant to control the modal styling
   */
  variant?: 'diaper' | 'default';
}

export default function DiaperModal({

  open,
  onClose,
  babyId,
  initialTime,
  activity,
  variant = 'default',
}: DiaperModalProps) {
  const { t } = useLocalization();
  const [formData, setFormData] = useState({
    time: initialTime,
    type: '' as DiaperType | '',
    condition: '',
    color: '',
  });

  // Format date string to be compatible with datetime-local input
  const formatDateForInput = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    
    // Format as YYYY-MM-DDThh:mm in local time
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  useEffect(() => {
    if (open) {
      if (activity) {
        // Editing mode - populate with activity data
        setFormData({
          time: formatDateForInput(initialTime),
          type: activity.type,
          condition: activity.condition || '',
          color: activity.color || '',
        });
      } else {
        // New entry mode
        setFormData(prev => ({
          ...prev,
          time: formatDateForInput(initialTime)
        }));
      }
    }
  }, [open, initialTime, activity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!babyId) return;

    // Validate required fields
    if (!formData.type || !formData.time) {
      console.error('Required fields missing');
      return;
    }

    try {
      const payload = {
        babyId,
        time: formData.time,
        type: formData.type,
        condition: formData.condition || null,
        color: formData.color || null,
      };

      const response = await fetch(`/api/diaper-log${activity ? `?id=${activity.id}` : ''}`, {
        method: activity ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to save diaper log');
      }

      onClose();
      
      // Reset form data
      setFormData({
        time: initialTime,
        type: '' as DiaperType | '',
        condition: '',
        color: '',
      });
    } catch (error) {
      console.error('Error saving diaper log:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="dialog-content !p-4 sm:!p-6">
        <DialogHeader className="dialog-header">
          <DialogTitle className="dialog-title">
            {activity ? 'Edit Diaper Change' : 'Log Diaper Change'}
          </DialogTitle>
          <DialogDescription className="dialog-description">
            {activity ? 'Update details about your baby\'s diaper change' : 'Record details about your baby\'s diaper change'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label">{t('Time')}</label>
              <Input
                type="datetime-local"
                value={formData.time}
                onChange={(e) =>
                  setFormData({ ...formData, time: e.target.value })
                }
                className="w-full"
                required
                tabIndex={-1}
              />
            </div>
            <div>
              <label className="form-label">Type</label>
              <Select
                value={formData.type || ''}
                onValueChange={(value: DiaperType) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WET">{t('Wet')}</SelectItem>
                  <SelectItem value="DIRTY">{t('Dirty')}</SelectItem>
                  <SelectItem value="BOTH">{t('Wet and Dirty')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {formData.type && formData.type !== 'WET' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label">{t('Condition')}</label>
              <Select
                value={formData.condition}
                onValueChange={(value: string) =>
                  setFormData({ ...formData, condition: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NORMAL">{t('Normal')}</SelectItem>
                  <SelectItem value="LOOSE">{t('Loose')}</SelectItem>
                  <SelectItem value="FIRM">{t('Firm')}</SelectItem>
                  <SelectItem value="OTHER">{t('Other')}</SelectItem>
                </SelectContent>
              </Select>
              </div>
              <div>
                <label className="form-label">{t('Color')}</label>
              <Select
                value={formData.color}
                onValueChange={(value: string) =>
                  setFormData({ ...formData, color: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select color" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YELLOW">{t('Yellow')}</SelectItem>
                  <SelectItem value="BROWN">{t('Brown')}</SelectItem>
                  <SelectItem value="GREEN">{t('Green')}</SelectItem>
                  <SelectItem value="OTHER">{t('Other')}</SelectItem>
                </SelectContent>
              </Select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:flex sm:justify-end gap-3 mt-6">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="hover:bg-slate-50"
            >
              {t('Cancel')}
            </Button>
            <Button 
              type="submit"
              className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-700 hover:to-emerald-700"
            >
              {activity ? 'Update Change' : 'Save Change'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
