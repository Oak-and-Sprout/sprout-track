import { PhotoResponse } from '@/app/api/types';

export interface PhotoDetailProps {
  isOpen: boolean;
  onClose: () => void;
  photo: PhotoResponse | null; // parent supplies the loaded photo
  onChanged?: () => void; // fired after favorite/caption/delete so parents refetch
}
