import { Button } from '@/src/components/ui/button';
import { Trash2, Pencil } from 'lucide-react';
import {
  FormPage,
  FormPageContent,
  FormPageFooter
} from '@/src/components/ui/form-page';
import { TimelineActivityDetailsProps } from './types';
import { getActivityDetails, formatTime } from './utils';
import { useTheme } from '@/src/context/theme';
import { useLocalization } from '@/src/context/localization';

import './timeline-activity-details.css';

const TimelineActivityDetails = ({
  activity,
  settings,
  isOpen,
  onClose,
  onDelete,
  onEdit,
}: TimelineActivityDetailsProps) => {
  

  const { t } = useLocalization();  

  const { theme } = useTheme();
  
  if (!activity) return null;

  // Special medicine details rendering
  let medicineDetails: { label: string; value: string }[] | null = null;
  if ('doseAmount' in activity && 'medicineId' in activity) {
    let medName = 'Medicine';
    if ('medicine' in activity && activity.medicine && typeof activity.medicine === 'object' && 'name' in activity.medicine) {
      medName = (activity.medicine as { name?: string }).name || medName;
    }
    const dose = activity.doseAmount ? `${activity.doseAmount} ${activity.unitAbbr || ''}`.trim() : '';
    const medTime = activity.time ? formatTime(activity.time, settings, true) : '';
    let notes = activity.notes ? activity.notes : '';
    if (notes.length > 50) notes = notes.substring(0, 50) + '...';
    medicineDetails = [
      { label: 'Medicine', value: medName },
      { label: 'Amount', value: dose },
      { label: 'Time', value: medTime },
      ...(notes ? [{ label: 'Notes', value: notes }] : [])
    ];
  }
  const activityDetails = getActivityDetails(activity, settings);
  
  const handleEdit = () => {
    if (activity) {
      // Check for pump activity first since it can also have duration
      if ('leftAmount' in activity || 'rightAmount' in activity) {
        onEdit(activity, 'pump');
      }
      else if ('duration' in activity) onEdit(activity, 'sleep');
      else if ('amount' in activity) onEdit(activity, 'feed');
      else if ('condition' in activity) onEdit(activity, 'diaper');
      else if ('doseAmount' in activity && 'medicineId' in activity) onEdit(activity, 'medicine');
      else if ('content' in activity) onEdit(activity, 'note');
      else if ('soapUsed' in activity) onEdit(activity, 'bath');
      else if ('title' in activity && 'category' in activity) onEdit(activity, 'milestone');
      else if ('value' in activity && 'unit' in activity) onEdit(activity, 'measurement');
    }
  };

  const handleDelete = () => {
    if (activity) {
      // For pump logs, we need to ensure the activity is properly identified
      if ('leftAmount' in activity || 'rightAmount' in activity || 
          (activity.id && activity.id.length > 0 && 'startTime' in activity)) {
        // Just pass the original activity - the key is to ensure we're using the correct endpoint
        // The getActivityEndpoint function in utils.tsx will check for leftAmount or rightAmount properties
        onDelete(activity);
      } else {
        onDelete(activity);
      }
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
                <span className="text-sm font-medium text-gray-500 timeline-details-label">{detail.label}:</span>
                <span className="text-sm text-gray-900 timeline-details-value">{detail.value}</span>
              </div>
            ))
          ) : (
            activityDetails.details.map((detail, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500 timeline-details-label">{detail.label}:</span>
                <span className="text-sm text-gray-900 timeline-details-value">{detail.value}</span>
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
              onClick={handleDelete}
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

export default TimelineActivityDetails;
