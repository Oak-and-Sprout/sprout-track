import React from 'react';
import { cn } from '@/src/lib/utils';
import { RecurrencePattern } from '@prisma/client';
import { calendarEventFormStyles as styles } from './calendar-event-form.styles';
import { Repeat, AlertCircle } from 'lucide-react';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Checkbox } from '@/src/components/ui/checkbox';
import { useLocalization } from '@/src/context/localization';

interface RecurrenceSelectorProps {
  recurring: boolean;
  recurrencePattern?: RecurrencePattern;
  recurrenceEnd?: Date;
  onRecurringChange: (recurring: boolean) => void;
  onRecurrencePatternChange: (pattern: RecurrencePattern) => void;
  onRecurrenceEndChange: (date: Date | undefined) => void;
  error?: {
    recurrencePattern?: string;
    recurrenceEnd?: string;
  };
}

/**
 * RecurrenceSelector Component
 * 
 * A subcomponent of CalendarEventForm that handles the selection of recurrence patterns
 * for recurring events.
 */
const RecurrenceSelector: React.FC<RecurrenceSelectorProps> = ({
  recurring,
  recurrencePattern,
  recurrenceEnd,
  onRecurringChange,
  onRecurrencePatternChange,
  onRecurrenceEndChange,
  error,
}) => {

  const { t } = useLocalization();
  // Format date for input
  const formatDateForInput = (date?: Date) => {  

    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  // Handle recurrence end date change
  const handleRecurrenceEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value) {
      onRecurrenceEndChange(new Date(value));
    } else {
      onRecurrenceEndChange(undefined);
    }
  };

  return (
    <div className={styles.recurrenceContainer}>
      {/* Recurring checkbox */}
      <div className="flex items-center space-x-2 py-2">
        <Checkbox
          id="recurring"
          checked={recurring}
          onCheckedChange={(checked) => onRecurringChange(checked === true)}
        />
        <label htmlFor="recurring" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
          <Repeat className="h-4 w-4 mr-1.5 text-gray-500 dark:text-gray-400" />
          {t('Recurring event')}
        </label>
      </div>

      {/* Recurrence options (only shown if recurring is checked) */}
      {recurring && (
        <>
          {/* Recurrence pattern */}
          <div className={styles.fieldGroup}>
            <label className="form-label">
              {t('Recurrence Pattern')}
              <span className={styles.fieldRequired}>*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.values(RecurrencePattern).map((pattern) => (
                <Button
                  key={pattern}
                  type="button"
                  variant={recurrencePattern === pattern ? "default" : "outline"}
                  onClick={() => onRecurrencePatternChange(pattern)}
                  className="w-full"
                >
                  {pattern.charAt(0) + pattern.slice(1).toLowerCase().replace('_', ' ')}
                </Button>
              ))}
            </div>
            {error?.recurrencePattern && (
              <div className={styles.fieldError}>
                <AlertCircle className="h-3 w-3 inline mr-1" />
                {error.recurrencePattern}
              </div>
            )}
          </div>

          {/* Recurrence end date */}
          <div className={styles.fieldGroup}>
            <label 
              htmlFor="recurrenceEnd" 
              className="form-label"
            >
              {t('Ends On')}
            </label>
            <Input
              type="date"
              id="recurrenceEnd"
              value={formatDateForInput(recurrenceEnd)}
              onChange={handleRecurrenceEndChange}
              className="w-full"
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('Leave blank for an indefinite recurrence')}
            </div>
            {error?.recurrenceEnd && (
              <div className={styles.fieldError}>
                <AlertCircle className="h-3 w-3 inline mr-1" />
                {error.recurrenceEnd}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default RecurrenceSelector;
