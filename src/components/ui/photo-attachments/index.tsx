'use client';

import React from 'react';
import { Camera, Images, X, ImageOff } from 'lucide-react';
import { useLocalization } from '@/src/context/localization';
import { useAuthedImage, photoFileUrl } from '@/src/hooks/useAuthedImage';
import { CameraCaptureModal, useTakePhoto } from '@/src/components/ui/camera-capture';
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
 * Attachment strip: existing photo thumbs, locally-pending files, and two
 * dashed add tiles — Take Photo (device camera) and Library (photo picker).
 * Max 4 photos per activity.
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
  const total = existingPhotos.length + pendingFiles.length;

  const addFiles = (files: File[]) => {
    const room = maxPhotos - total;
    onPendingFilesChange([...pendingFiles, ...files.slice(0, room)]);
  };

  const camera = useTakePhoto(addFiles);

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files || []));
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
          <>
            <button type="button" className={`${attachmentStyles.addTile()} photo-attachments-add`} onClick={camera.takePhoto} aria-label={t('Take Photo')}>
              <Camera className="h-5 w-5" />
              <span className={attachmentStyles.tileLabel()}>{t('Take Photo')}</span>
            </button>
            <button type="button" className={`${attachmentStyles.addTile()} photo-attachments-add`} onClick={() => camera.libraryInputRef.current?.click()} aria-label={t('Choose from Library')}>
              <Images className="h-5 w-5" />
              <span className={attachmentStyles.tileLabel()}>{t('Library')}</span>
            </button>
          </>
        )}
      </div>
      <p className={`${attachmentStyles.hint()} photo-attachments-hint`}>
        {t("Attach up to 4 photos — they'll show on the timeline and in the gallery.")}
      </p>
      <input ref={camera.captureInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFilesSelected} />
      <input ref={camera.libraryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFilesSelected} />
      <CameraCaptureModal open={camera.cameraOpen} onClose={camera.closeCamera} onCapture={camera.handleCapture} />
    </div>
  );
}

export default PhotoAttachments;
