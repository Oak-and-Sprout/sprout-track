'use client';

import React, { useState, useEffect, useId } from 'react';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react';
import { Baby, Gender } from '@prisma/client';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
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
import { StorybookDrawer } from '@/src/components/ui/storybook-drawer';
import { cn } from '@/src/lib/utils';
import { babyFormStyles } from './baby-form.styles';
import { useToast } from '@/src/components/ui/toast';
import { handleExpirationError } from '@/src/lib/expiration-error-handler';
import { useLocalization } from '@/src/context/localization';
import { useTimezone } from '@/app/context/timezone';
import { formatDateLong } from '@/src/utils/dateFormat';

interface BabyFormProps {
  isOpen: boolean;
  onClose: () => void;
  isEditing: boolean;
  baby: Baby | null;
  onBabyChange?: () => void;
  /** 'storybook' renders the stacked storybook drawer (account manager); default is the classic FormPage. */
  appearance?: 'default' | 'storybook';
}

const defaultFormData = {
  firstName: '',
  lastName: '',
  birthDate: undefined as Date | undefined,
  gender: '',
  inactive: false,
  feedWarningTime: '03:00',
  diaperWarningTime: '02:00',
  feedTimerFrom: 'start',
};

export default function BabyForm({
  isOpen,
  onClose,
  isEditing,
  baby,
  onBabyChange,
  appearance = 'default',
}: BabyFormProps) {
  const { t } = useLocalization();
  const { dateFormat } = useTimezone();
  const { showToast } = useToast();
  const [formData, setFormData] = useState(defaultFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formId = useId();

  // Reset form when form opens/closes or baby changes
  useEffect(() => {
    if (baby && isOpen && !isSubmitting) {
      const birthDate = baby.birthDate instanceof Date 
        ? baby.birthDate
        : new Date(baby.birthDate as string);

      setFormData({
        firstName: baby.firstName,
        lastName: baby.lastName,
        birthDate,
        gender: baby.gender || '',
        inactive: baby.inactive || false,
        feedWarningTime: baby.feedWarningTime || '03:00',
        diaperWarningTime: baby.diaperWarningTime || '02:00',
        feedTimerFrom: (baby as any).feedTimerFrom || 'start',
      });
    } else if (!isOpen && !isSubmitting) {
      setFormData(defaultFormData);
    }
  }, [baby?.id, isOpen, isSubmitting]); // Use baby.id instead of full baby object to prevent unnecessary resets

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      
      // Get auth token for API request
      const authToken = localStorage.getItem('authToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await fetch('/api/baby', {
        method: isEditing ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify({
          ...formData,
          id: baby?.id,
          birthDate: formData.birthDate,
          gender: formData.gender as Gender,
        }),
      });

      if (!response.ok) {
        // Check if this is an account expiration error
        if (response.status === 403) {
          const { isExpirationError } = await handleExpirationError(
            response, 
            showToast, 
            'managing babies'
          );
          if (isExpirationError) {
            // Don't close the form, let user see the error
            return;
          }
        }
        
        // For other errors, throw as before
        throw new Error('Failed to save baby');
      }

      if (onBabyChange) {
        onBabyChange();
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving baby:', error);
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
        title={isEditing ? t('Edit baby') : t('Add a baby')}
        subtitle={t('You can change any of this later.')}
        footer={
          <>
            <button type="button" className="sb-btn sb-ghost" onClick={onClose}>{t('Cancel')}</button>
            <button type="submit" form="sb-baby-form" className="sb-btn" disabled={isSubmitting}>
              {isSubmitting ? t('Saving…') : isEditing ? t('Save changes') : t('Add baby')}
            </button>
          </>
        }
      >
        <form id="sb-baby-form" onSubmit={handleSubmit} className="sb-f-grid">
          <div className="sb-f2">
            <div>
              <label className="sb-fl" htmlFor="sbBabyFirst">{t('First name')}</label>
              <input id="sbBabyFirst" className="sb-fi" value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} required />
            </div>
            <div>
              <label className="sb-fl" htmlFor="sbBabyLast">{t('Last name')}</label>
              <input id="sbBabyLast" className="sb-fi" value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required />
            </div>
          </div>
          <div className="sb-f2">
            <div>
              <label className="sb-fl" htmlFor="sbBabyBirthDate">{t('Birth date')}</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="sbBabyBirthDate"
                    variant="input"
                    className={cn(
                      "sb-fi w-full justify-start text-left font-normal",
                      !formData.birthDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" aria-hidden="true" />
                    {formData.birthDate ? formatDateLong(formData.birthDate, dateFormat) : t("Select date")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[100]" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={formData.birthDate}
                    onSelect={(date) => setFormData({ ...formData, birthDate: date })}
                    maxDate={new Date()} // Can't select future dates
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="sb-fl" htmlFor="sbBabyGender">{t('Gender')}</label>
              <select id="sbBabyGender" className="sb-fi" value={formData.gender || ''}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as Gender })}>
                <option value="">{t('Choose…')}</option>
                <option value="MALE">{t('Boy')}</option>
                <option value="FEMALE">{t('Girl')}</option>
              </select>
            </div>
          </div>
          <div className="sb-fgroup">
            <b>{t('Gentle nudges')}</b>
            <p className="sb-fh">{t("Sprout Track quietly warns whoever's on duty when it's been this long.")}</p>
            <div className="sb-f2">
              <div>
                <label className="sb-fl" htmlFor="sbBabyFeed">
                  {t('Since last feed')} <span className="sb-fl-opt">(hh:mm)</span>
                </label>
                <input id="sbBabyFeed" className="sb-fi" pattern="[0-9]{2}:[0-9]{2}" required
                  value={formData.feedWarningTime}
                  onChange={(e) => setFormData({ ...formData, feedWarningTime: e.target.value })} />
              </div>
              <div>
                <label className="sb-fl" htmlFor="sbBabyDiaper">
                  {t('Since last diaper')} <span className="sb-fl-opt">(hh:mm)</span>
                </label>
                <input id="sbBabyDiaper" className="sb-fi" pattern="[0-9]{2}:[0-9]{2}" required
                  value={formData.diaperWarningTime}
                  onChange={(e) => setFormData({ ...formData, diaperWarningTime: e.target.value })} />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <label className="sb-fl" htmlFor="sbBabyTimer">{t('Feed timer counts from')}</label>
              <select id="sbBabyTimer" className="sb-fi" value={formData.feedTimerFrom}
                onChange={(e) => setFormData({ ...formData, feedTimerFrom: e.target.value })}>
                <option value="start">{t('Start of feeding')}</option>
                <option value="end">{t('End of feeding')}</option>
              </select>
            </div>
          </div>
          {isEditing && (
            <label className="sb-fcheck">
              <input type="checkbox" checked={formData.inactive}
                onChange={(e) => setFormData({ ...formData, inactive: e.target.checked })} />
              <span>{t("Mark as inactive — their history stays, but they drop out of daily tracking.")}</span>
            </label>
          )}
        </form>
      </StorybookDrawer>
    );
  }

  return (
    <FormPage 
      isOpen={isOpen} 
      onClose={onClose}
      title={isEditing ? t('Edit Baby') : t('Add New Baby')}
      description={isEditing 
        ? t("Update your baby's information") 
        : t("Enter your baby's information to start tracking")
      }
    >
      <form onSubmit={handleSubmit} className="h-full flex flex-col overflow-hidden">
        <FormPageContent className={babyFormStyles.content}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${formId}-first-name`} className="form-label">{t('First Name')}</label>
              <Input
                id={`${formId}-first-name`}
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
                className="w-full"
                placeholder={t("Enter first name")}
                required
              />
            </div>
            <div>
              <label htmlFor={`${formId}-last-name`} className="form-label">{t('Last Name')}</label>
              <Input
                id={`${formId}-last-name`}
                value={formData.lastName}
                onChange={(e) =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
                className="w-full"
                placeholder={t("Enter last name")}
                required
              />
            </div>
          </div>
          <div>
            <label htmlFor={`${formId}-birth-date`} className="form-label">{t('Birth Date')}</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id={`${formId}-birth-date`}
                  variant="input"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.birthDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" aria-hidden="true" />
                  {formData.birthDate ? formatDateLong(formData.birthDate, dateFormat) : t("Select date")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[100]" align="start">
                <CalendarComponent
                  mode="single"
                  selected={formData.birthDate}
                  onSelect={(date) => setFormData({ ...formData, birthDate: date })}
                  maxDate={new Date()} // Can't select future dates
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label htmlFor={`${formId}-gender`} className="form-label">{t('Gender')}</label>
            <Select
              value={formData.gender}
              onValueChange={(value) =>
                setFormData({ ...formData, gender: value })
              }
            >
              <SelectTrigger id={`${formId}-gender`} className="w-full">
                <SelectValue placeholder={t("Select gender")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MALE">{t('Male')}</SelectItem>
                <SelectItem value="FEMALE">{t('Female')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${formId}-feed-warning-time`} className="form-label">{t('Feed Warning Time (hh:mm)')}</label>
              <Input
                id={`${formId}-feed-warning-time`}
                type="text"
                pattern="[0-9]{2}:[0-9]{2}"
                value={formData.feedWarningTime}
                onChange={(e) =>
                  setFormData({ ...formData, feedWarningTime: e.target.value })
                }
                className="w-full"
                placeholder="03:00"
                required
              />
            </div>
            <div>
              <label htmlFor={`${formId}-diaper-warning-time`} className="form-label">{t('Diaper Warning Time (hh:mm)')}</label>
              <Input
                id={`${formId}-diaper-warning-time`}
                type="text"
                pattern="[0-9]{2}:[0-9]{2}"
                value={formData.diaperWarningTime}
                onChange={(e) =>
                  setFormData({ ...formData, diaperWarningTime: e.target.value })
                }
                className="w-full"
                placeholder="02:00"
                required
              />
            </div>
          </div>
          <div>
            <label htmlFor={`${formId}-feed-timer-from`} className="form-label">{t('Feed timer counts from')}</label>
            <Select
              value={formData.feedTimerFrom}
              onValueChange={(value) =>
                setFormData({ ...formData, feedTimerFrom: value })
              }
            >
              <SelectTrigger id={`${formId}-feed-timer-from`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="start">{t('Start of feeding')}</SelectItem>
                <SelectItem value="end">{t('End of feeding')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isEditing && (
            <div className="flex items-center space-x-2 mt-4">
              <label className="form-label flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  checked={formData.inactive}
                  onChange={(e) =>
                    setFormData({ ...formData, inactive: e.target.checked })
                  }
                />
                <span className="ml-2">{t('Mark as inactive')}</span>
              </label>
            </div>
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
              disabled={isSubmitting}
            >
              {isSubmitting ? t('Saving...') : isEditing ? t('Update') : t('Save')}
            </Button>
          </div>
        </FormPageFooter>
      </form>
    </FormPage>
  );
}
