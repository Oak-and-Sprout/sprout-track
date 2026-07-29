export interface PhotoFormProps {
  isOpen: boolean;
  onClose: () => void;
  babyId: string | undefined;
  initialTime: string;                 // same convention as other forms (see VaccineForm)
  activity?: { photoLogId: string };   // edit mode: an existing photo log
  onSuccess?: () => void;
  onOpenPhoto?: (photoId: string) => void; // parent opens PhotoDetail
}

/** Footer actions reported by AddPhotoTab to PhotoForm */
export interface PhotoAddActions {
  onSave: () => void;
  onDelete?: () => void;
  onCancel: () => void;
  canSave: boolean;
  saving: boolean;
}

export interface PhotoTabCommonProps {
  babyId: string | undefined;
  onClose: () => void;
  onSuccess?: () => void;
  onOpenPhoto?: (photoId: string) => void;
  refreshTrigger: number;
}
