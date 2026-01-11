import React from 'react';
import { Button } from '@/src/components/ui/button';
import { Trash2, Pencil } from 'lucide-react';
import {
  FormPage,
  FormPageContent,
  FormPageFooter
} from '@/src/components/ui/form-page';
import { FullLogActivityDetailsProps } from './full-log-timeline.types';
import { getActivityDetails, formatTime } from '@/src/components/Timeline/utils';
import { useTheme } from '@/src/context/theme';
import { useLocalization } from '@/src/context/localization';

import './full-log-timeline.css';

/**
 * FullLogActivityDetails Component
 * 
 * Displays detailed information about a selected activity
 */
const FullLogActivityDetails: React.FC<FullLogActivityDetailsProps> = ({
  activity,
  settings,
  isOpen,
  onClose,
  onDelete,
  onEdit,
}) => {
  const { theme } = useTheme();
  const { t } = useLocalization();
  
  if (!activity) return null;

  // Special medicine details rendering
  let medicineDetails: { label: string; value: string }[] | null = null;
  if ('doseAmount' in activity && 'medicineId' in activity) {
    let medName = t('Medicine');
    if ('medicine' in activity && activity.medicine && typeof activity.medicine === 'object' && 'name' in activity.medicine) {
      medName = (activity.medicine as { name?: string }).name || medName;
    }
    const dose = activity.doseAmount ? `${activity.doseAmount} ${activity.unitAbbr || ''}`.trim() : '';
    const medTime = activity.time ? formatTime(activity.time, settings, true) : '';
    let notes = activity.notes ? activity.notes : '';
    if (notes.length > 50) notes = notes.substring(0, 50) + '...';
    medicineDetails = [
      { label: t('Medicine'), value: medName },
      { label: t('Amount'), value: dose },
      { label: t('Time'), value: medTime },
      ...(notes ? [{ label: t('Notes'), value: notes }] : [])
    ];
  }
  const activityDetails = getActivityDetails(activity, settings, t);
  
  const handleEdit = () => {
    if (activity) {
      // Check for pump activity first since it can also have duration
      if ('leftAmount' in activity || 'rightAmount' in activity) {
        onEdit(activity, 'pump');
      }
      else if ('duration' in activity) onEdit(activity, 'sleep');
      else if ('amount' in activity) onEdit(activity, 'feed');
      else if ('condition' in activity) onEdit(activity, 'diaper');
      else if ('content' in activity) onEdit(activity, 'note');
      else if ('soapUsed' in activity) onEdit(activity, 'bath');
      else if ('title' in activity && 'category' in activity) onEdit(activity, 'milestone');
      else if ('value' in activity && 'unit' in activity) onEdit(activity, 'measurement');
      else if ('doseAmount' in activity && 'medicineId' in activity) onEdit(activity, 'medicine');
    }
  };

  return (
    <FormPage 
      isOpen={isOpen} 
      onClose={onClose}
      title={activityDetails.title}
    >
      <FormPageContent>
        <div className="space-y-4 p-4">
          {medicineDetails ? (
            medicineDetails.map((detail, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500 full-log-timeline-details-label">{detail.label}:</span>
                <span className="text-sm text-gray-900 full-log-timeline-details-value">{detail.value}</span>
              </div>
            ))
          ) : (
            activityDetails.details.map((detail, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500 full-log-timeline-details-label">{detail.label}:</span>
                <span className="text-sm text-gray-900 full-log-timeline-details-value">{detail.value}</span>
              </div>
            ))
          )}
        </div>
      </FormPageContent>
      <FormPageFooter>
        <div className="flex justify-between w-full px-4 py-2">
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={() => onDelete(activity)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('Delete')}
            </Button>
            <Button
              variant="outline"
              onClick={handleEdit}
            >
              <Pencil className="h-4 w-4 mr-2" />
              {t('Edit')}
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={onClose}
          >
            {t('Close')}
          </Button>
        </div>
      </FormPageFooter>
    </FormPage>
  );
};

export default FullLogActivityDetails;
