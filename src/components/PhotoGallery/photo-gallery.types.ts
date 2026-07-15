import { PhotoResponse } from '@/app/api/types';
import { GalleryTypeFilter } from '@/src/utils/photoGalleryUtils';

export type GalleryView = 'gallery' | 'trash';
export type GalleryGrouping = 'month' | 'milestone' | 'all';

/**
 * Full gallery UI state. Owned by `PhotoGallery/index.tsx` and passed down
 * to `GalleryToolbar` and (from Task 24 on) the lightbox/selection bar/trash
 * view, so every piece of the feature reads from and updates one shape.
 */
export interface GalleryState {
  grouping: GalleryGrouping;
  query: string;
  typeFilter: GalleryTypeFilter;
  favoritesOnly: boolean;
  selectMode: boolean;
  selectedIds: Set<string>;
  view: GalleryView;
  lightboxPhotoId: string | null; // Task 24
  showCaptions: boolean;
}

export const DEFAULT_GALLERY_STATE: GalleryState = {
  grouping: 'month',
  query: '',
  typeFilter: 'all',
  favoritesOnly: false,
  selectMode: false,
  selectedIds: new Set<string>(),
  view: 'gallery',
  lightboxPhotoId: null,
  showCaptions: true,
};

export interface GalleryToolbarProps {
  state: GalleryState;
  onStateChange: (partial: Partial<GalleryState>) => void;
  trashCount: number;
}

export interface PhotoGridProps {
  photos: PhotoResponse[];
  selectMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpen: (photo: PhotoResponse) => void;
  onToggleFavorite: (id: string) => void;
  showCaptions: boolean;
}

export interface PhotoGalleryProps {
  babyId: string | undefined;
}
