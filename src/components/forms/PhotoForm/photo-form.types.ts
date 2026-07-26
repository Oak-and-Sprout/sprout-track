export interface PhotoFormProps {
  isOpen: boolean;
  onClose: () => void;
  babyId: string | undefined;
  initialTime: string;                 // same convention as other forms (see VaccineForm)
  activity?: { photoLogId: string };   // edit mode: an existing photo log
  onSuccess?: () => void;
  onOpenPhoto?: (photoId: string) => void; // parent opens PhotoDetail
}

export interface PhotoTabCommonProps {
  babyId: string | undefined;
  onClose: () => void;
  onSuccess?: () => void;
  onOpenPhoto?: (photoId: string) => void;
  refreshTrigger: number;
}
