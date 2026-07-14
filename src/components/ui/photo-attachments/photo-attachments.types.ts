export interface AttachedPhotoInfo {
  id: string;
  caption: string | null;
}

export interface PhotoAttachmentsProps {
  pendingFiles: File[];
  onPendingFilesChange: (files: File[]) => void;
  existingPhotos?: AttachedPhotoInfo[]; // already-linked photos (edit mode)
  onRemoveExisting?: (photoId: string) => void; // omit to hide the x on existing
  onPhotoClick?: (photoId: string) => void; // tap an existing thumb -> PhotoDetail
  maxPhotos?: number; // default MAX_PHOTOS_PER_ACTIVITY
  disabled?: boolean;
}
