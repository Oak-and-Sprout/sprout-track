import { Button } from '@/src/components/ui/button';
import { Trash2, Pencil } from 'lucide-react';
import {
  FormPage,
  FormPageContent,
  FormPageFooter
} from '@/src/components/ui/form-page';
import { TimelineActivityDetailsProps } from './types';
import { getActivityDetails, formatTime } from './utils';
import { useLocalization } from '@/src/context/localization';
import { useUnit } from '@/src/hooks/useUnit';
import { FeedLogResponse, TimelinePhotoInfo } from '@/app/api/types';
import LinkedFeedsSection from '@/src/components/forms/FeedForm/LinkedFeedsSection';
import { useAuthedImage, photoFileUrl } from '@/src/hooks/useAuthedImage';

import './timeline-activity-details.css';

function DetailPhotoThumb({ photo, onClick }: { photo: TimelinePhotoInfo; onClick?: () => void }) {
  const { t } = useLocalization();
  const { src } = useAuthedImage(photoFileUrl(photo.id, 'thumb'));
  return (
    <button
      type="button"
      className="grid h-[84px] w-[84px] place-items-center overflow-hidden rounded-xl bg-gray-100 shadow-sm timeline-details-photo-thumb"
      onClick={onClick}
      title={photo.caption || undefined}
      aria-label={photo.caption || t('View photo')}
    >
      {src && <img src={src} alt={photo.caption || ''} className="h-full w-full object-cover" />}
    </button>
  );
}

const TimelineActivityDetails = ({
  activity,
  settings,
  isOpen,
  onClose,
  onDelete,
  onEdit,
  onPhotoClick,
}: TimelineActivityDetailsProps) => {
  
  const { t } = useLocalization();
  const { unitSymbol } = useUnit();

  if (!activity) return null;

  // Photos attached by the timeline API (photo logs and linked activities)
  const attachedPhotos: TimelinePhotoInfo[] =
    'photos' in activity && Array.isArray((activity as any).photos) ? (activity as any).photos : [];

  // Special medicine details rendering
  let medicineDetails: { label: string; value: string }[] | null = null;
  if ('doseAmount' in activity && 'medicineId' in activity) {
    let medName = t('Medicine');
    if ('medicine' in activity && activity.medicine && typeof activity.medicine === 'object' && 'name' in activity.medicine) {
      medName = (activity.medicine as { name?: string }).name || medName;
    }
    const dose = activity.doseAmount ? `${activity.doseAmount} ${unitSymbol(activity.unitAbbr)}`.trim() : '';
    const medTime = activity.time ? formatTime(activity.time, settings, true, t) : '';
    let notes = activity.notes ? activity.notes : '';
    if (notes.length > 50) notes = notes.substring(0, 50) + '...';
    medicineDetails = [
      { label: t('Medicine'), value: medName },
      { label: t('Amount'), value: dose },
      { label: t('Time'), value: medTime },
      ...(notes ? [{ label: t('Notes'), value: notes }] : []),
      ...(activity.caretakerName ? [{ label: t('Caretaker'), value: activity.caretakerName }] : [])
    ];
  }
  const activityDetails = getActivityDetails(activity, settings, t);
  
  const handleEdit = () => {
    if (activity) {
      // Photo log - check before the more generic field checks below
      if ('photoLogId' in activity) {
        onEdit(activity, 'photo');
      }
      // Food log (issue #203) - foodId is unique to food logs
      else if ('foodId' in activity) {
        onEdit(activity, 'food');
      }
      // Check play activity before sleep since both have duration and type
      else if ('activities' in activity && 'type' in activity && ['TUMMY_TIME', 'INDOOR_PLAY', 'OUTDOOR_PLAY', 'WALK', 'CUSTOM'].includes((activity as any).type)) {
        onEdit(activity, 'play');
      }
      // Check for breast milk adjustment before pump
      else if ('reason' in activity && 'amount' in activity && !('type' in activity) && !('leftAmount' in activity)) {
        onEdit(activity, 'breast-milk-adjustment');
      }
      // Check for pump activity first since it can also have duration
      else if ('leftAmount' in activity || 'rightAmount' in activity) {
        onEdit(activity, 'pump');
      }
      else if ('duration' in activity) onEdit(activity, 'sleep');
      else if ('amount' in activity) onEdit(activity, 'feed');
      else if ('condition' in activity) onEdit(activity, 'diaper');
      else if ('doseAmount' in activity && 'medicineId' in activity) onEdit(activity, 'medicine');
      else if ('content' in activity) onEdit(activity, 'note');
      else if ('soapUsed' in activity) onEdit(activity, 'bath');
      else if ('vaccineName' in activity) onEdit(activity, 'vaccine');
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
          {'amount' in activity && 'type' in activity && activity.type === 'BREAST' && 'babyId' in activity && (
            <LinkedFeedsSection
              activity={activity as FeedLogResponse}
              babyId={activity.babyId}
              readOnly
            />
          )}
          {attachedPhotos.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-500 timeline-details-label mb-2">
                {t('Photos')} ({attachedPhotos.length})
              </div>
              <div className="flex flex-wrap gap-3">
                {attachedPhotos.map((photo) => (
                  <DetailPhotoThumb
                    key={photo.id}
                    photo={photo}
                    onClick={onPhotoClick ? () => onPhotoClick(photo.id) : undefined}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-400 timeline-details-photo-hint">{t('Tap a photo to view or manage it.')}</p>
            </div>
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
              <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
              {t('Delete')}
            </Button>
            <Button
              variant="outline"
              onClick={handleEdit}
            >
              <Pencil className="h-4 w-4 mr-2" aria-hidden="true" />
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
