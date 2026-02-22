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
import { FeedType, BreastSide } from '@prisma/client';
import { FeedLogResponse } from '@/app/api/types';
import { useLocalization } from '@/src/context/localization';

interface FeedModalProps {
  open: boolean;
  onClose: () => void;
  babyId: string | undefined;
  initialTime: string;
  activity?: FeedLogResponse;
  /**
   * Optional variant to control the modal styling
   */
  variant?: 'feed' | 'default';
}

export default function FeedModal({
  open,
  onClose,
  babyId,
  initialTime,
  activity,
  variant = 'default',
}: FeedModalProps) {
  const { t } = useLocalization();
  const [formData, setFormData] = useState({
    time: initialTime,
    type: '' as FeedType | '',
    amount: '',
    side: '' as BreastSide | '',
    food: '',
  });

  const fetchLastAmount = async (type: FeedType) => {
    if (!babyId) return;
    
    try {
      const response = await fetch(`/api/feed-log/last?babyId=${babyId}&type=${type}`);
      if (!response.ok) return;
      
      const data = await response.json();
      if (data.success && data.data?.amount) {
        setFormData(prev => ({
          ...prev,
          amount: data.data.amount.toString()
        }));
      }
    } catch (error) {
      console.error('Error fetching last amount:', error);
    }
  };

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
          amount: activity.amount?.toString() || '',
          side: activity.side || '',
          food: activity.food || '',
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

  useEffect(() => {
    if (formData.type === 'BOTTLE' || formData.type === 'SOLIDS') {
      fetchLastAmount(formData.type);
    }
  }, [formData.type, babyId]);

  const handleAmountChange = (newAmount: string) => {
    // Ensure it's a valid number and not negative
    const numValue = parseFloat(newAmount);
    if (!isNaN(numValue) && numValue >= 0) {
      setFormData(prev => ({
        ...prev,
        amount: newAmount
      }));
    }
  };

  const incrementAmount = () => {
    const currentAmount = parseFloat(formData.amount || '0');
    setFormData(prev => ({
      ...prev,
      amount: (currentAmount + 1).toString()
    }));
  };

  const decrementAmount = () => {
    const currentAmount = parseFloat(formData.amount || '0');
    if (currentAmount > 0) {
      setFormData(prev => ({
        ...prev,
        amount: (currentAmount - 1).toString()
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!babyId) return;

    // Validate required fields
    if (!formData.type || !formData.time) {
      console.error('Required fields missing');
      return;
    }

    // Validate breast feeding side
    if (formData.type === 'BREAST' && !formData.side) {
      console.error('Side is required for breast feeding');
      return;
    }

    try {
      const payload = {
        babyId,
        time: formData.time, // Send the local time directly
        type: formData.type,
        ...(formData.type === 'BREAST' && { side: formData.side }),
        ...((formData.type === 'BOTTLE' || formData.type === 'SOLIDS') && formData.amount && { amount: parseFloat(formData.amount) }),
        ...(formData.type === 'SOLIDS' && formData.food && { food: formData.food })
      };

      const response = await fetch(`/api/feed-log${activity ? `?id=${activity.id}` : ''}`, {
        method: activity ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save feed log');
      }

      onClose();
      
      // Reset form data
      setFormData({
        time: initialTime,
        type: '' as FeedType | '',
        amount: '',
        side: '' as BreastSide | '',
        food: '',
      });
    } catch (error) {
      console.error('Error saving feed log:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="dialog-content !p-4 sm:!p-6">
        <DialogHeader className="dialog-header">
          <DialogTitle className="dialog-title">
            {activity ? 'Edit Feeding' : 'Log Feeding'}
          </DialogTitle>
          <DialogDescription className="dialog-description">
            {activity ? 'Update what and when your baby ate' : 'Record what and when your baby ate'}
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
                value={formData.type}
                onValueChange={(value: FeedType) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BREAST">{t('Breast')}</SelectItem>
                  <SelectItem value="BOTTLE">{t('Bottle')}</SelectItem>
                  <SelectItem value="SOLIDS">{t('Solid Food')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.type === 'BREAST' && (
            <div>
              <label className="form-label">{t('Side')}</label>
              <Select
                value={formData.side}
                onValueChange={(value: BreastSide) =>
                  setFormData({ ...formData, side: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select side" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LEFT">{t('Left')}</SelectItem>
                  <SelectItem value="RIGHT">{t('Right')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {(formData.type === 'BOTTLE' || formData.type === 'SOLIDS') && (
            <div>
              <label className="form-label">
                {t('Amount')} {formData.type === 'SOLIDS' ? '(g)' : '(oz)'}
              </label>
              <div className="grid grid-cols-[auto,1fr,auto] gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={decrementAmount}
                  className="px-3"
                >
                  -
                </Button>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="w-full"
                  step="0.1"
                  min="0"
                  placeholder={formData.type === 'SOLIDS' ? 'Enter grams' : 'Enter ounces'}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={incrementAmount}
                  className="px-3"
                >
                  +
                </Button>
              </div>
            </div>
          )}

          {formData.type === 'SOLIDS' && (
            <div>
              <label className="form-label">{t('Food')}</label>
              <Select
                value={formData.food}
                onValueChange={(value: string) =>
                  setFormData({ ...formData, food: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select food" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANANA">{t('Banana')}</SelectItem>
                  <SelectItem value="RICE_CEREAL">{t('Rice Cereal')}</SelectItem>
                  <SelectItem value="PUREE">{t('Puree')}</SelectItem>
                  <SelectItem value="OTHER">{t('Other')}</SelectItem>
                </SelectContent>
              </Select>
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
              {activity ? 'Update Feed' : 'Save Feed'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
