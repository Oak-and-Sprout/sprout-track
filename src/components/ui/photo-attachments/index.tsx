'use client';

import React, { useRef } from 'react';
import { Plus, X, ImageOff } from 'lucide-react';
import { useLocalization } from '@/src/context/localization';
import { useAuthedImage, photoFileUrl } from '@/src/hooks/useAuthedImage';
import { MAX_PHOTOS_PER_ACTIVITY } from '@/src/utils/photoUtils';
import { attachmentStyles } from './photo-attachments.styles';
import { PhotoAttachmentsProps } from './photo-attachments.types';
import './photo-attachments.css';

function ExistingThumb({ photoId, onClick, onRemove }: { photoId: string; onClick?: () => void; onRemove?: () => void }) {
  const { src, error } = useAuthedImage(photoFileUrl(photoId, 'thumb'));
  const { t } = useLocalization();
  return (
    <span className="relative inline-block">
      <button type="button" className={attachmentStyles.thumb()} onClick={onClick} aria-label={t('View photo')}>
        {error ? <ImageOff className="h-5 w-5 text-gray-400" /> : src ? <img src={src} alt="" className="h-full w-full rounded-xl object-cover" /> : null}
      </button>
      {onRemove && (
        <button type="button" className={attachmentStyles.removeBadge()} onClick={onRemove} aria-label={t('Remove photo')}>
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

function PendingThumb({ file, onRemove }: { file: File; onRemove?: () => void }) {
  const { t } = useLocalization();
  // Create the preview URL inside the effect so StrictMode's mount→cleanup→remount
  // cycle gets a fresh URL instead of an already-revoked one
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <span className="relative inline-block">
      <span className={attachmentStyles.thumb()}>
        {objectUrl && <img src={objectUrl} alt={file.name} className="h-full w-full rounded-xl object-cover" />}
      </span>
      {onRemove && (
        <button type="button" className={attachmentStyles.removeBadge()} onClick={onRemove} aria-label={t('Remove photo')}>
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

/**
 * Attachment strip: existing photo thumbs, locally-pending files, and a
 * dashed add tile (camera/library picker). Max 4 photos per activity.
 */
export function PhotoAttachments({
  pendingFiles,
  onPendingFilesChange,
  existingPhotos = [],
  onRemoveExisting,
  onPhotoClick,
  maxPhotos = MAX_PHOTOS_PER_ACTIVITY,
  disabled = false,
}: PhotoAttachmentsProps) {
  const { t } = useLocalization();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const total = existingPhotos.length + pendingFiles.length;

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    const room = maxPhotos - total;
    onPendingFilesChange([...pendingFiles, ...selected.slice(0, room)]);
    event.target.value = '';
  };

  return (
    <div className="photo-attachments">
      <div className={attachmentStyles.row()}>
        {existingPhotos.map((photo) => (
          <ExistingThumb
            key={photo.id}
            photoId={photo.id}
            onClick={onPhotoClick ? () => onPhotoClick(photo.id) : undefined}
            onRemove={onRemoveExisting && !disabled ? () => onRemoveExisting(photo.id) : undefined}
          />
        ))}
        {pendingFiles.map((file, index) => (
          <PendingThumb key={`${file.name}-${index}`} file={file} onRemove={!disabled ? () => onPendingFilesChange(pendingFiles.filter((_, i) => i !== index)) : undefined} />
        ))}
        {total < maxPhotos && !disabled && (
          <button type="button" className={`${attachmentStyles.addTile()} photo-attachments-add`} onClick={() => fileInputRef.current?.click()} aria-label={t('Add photo')}>
            <Plus className="h-6 w-6" />
          </button>
        )}
      </div>
      <p className={`${attachmentStyles.hint()} photo-attachments-hint`}>
        {t("Attach up to 4 photos — they'll show on the timeline and in the gallery.")}
      </p>
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handleFilesSelected} />
    </div>
  );
}

export default PhotoAttachments;
