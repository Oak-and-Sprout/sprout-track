'use client';

import React from 'react';
import { Check, Heart } from 'lucide-react';
import { PhotoResponse } from '@/app/api/types';
import { useLocalization } from '@/src/context/localization';
import { useAuthedImage, useInView, photoFileUrl } from '@/src/hooks/useAuthedImage';
import { trashDaysRemaining } from '@/src/utils/photoUtils';
import { PhotoGridProps } from './photo-gallery.types';

interface GalleryTileProps {
  photo: PhotoResponse;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOpen: (photo: PhotoResponse) => void;
  onToggleFavorite: (id: string) => void;
  showCaptions: boolean;
}

function GalleryTile({ photo, selectMode, selected, onToggleSelect, onOpen, onToggleFavorite, showCaptions }: GalleryTileProps) {
  const { t } = useLocalization();
  const { ref, inView } = useInView<HTMLButtonElement>();
  const { src } = useAuthedImage(photoFileUrl(photo.id, 'thumb', !!photo.deletedAt), inView);
  return (
    <div>
      <button
        ref={ref}
        type="button"
        className={`group relative aspect-square w-full overflow-hidden rounded-2xl bg-gray-100 transition-transform hover:scale-[1.02] ${selected ? 'outline outline-[3px] outline-offset-2 outline-teal-600' : ''} photo-gallery-tile`}
        onClick={() => (selectMode ? onToggleSelect(photo.id) : onOpen(photo))}
        aria-label={photo.caption || t('Photo')}
      >
        {src && <img src={src} alt={photo.caption || ''} className="h-full w-full object-cover" loading="lazy" />}
        {photo.deletedAt && (
          <span className="absolute bottom-2 left-2 rounded-full bg-slate-900/70 px-2 py-0.5 text-[11px] font-semibold text-white">
            {trashDaysRemaining(photo.deletedAt, new Date())} {t('days left')}
          </span>
        )}
        {selectMode && (
          <span className={`absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full border-2 border-white text-white ${selected ? 'bg-teal-600' : 'bg-slate-900/30'}`}>
            {selected && <Check className="h-3.5 w-3.5" />}
          </span>
        )}
        {!selectMode && !photo.deletedAt && (
          <span
            role="button"
            tabIndex={0}
            className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 transition-opacity ${photo.isFavorite ? 'text-red-500 opacity-100' : 'text-gray-400 opacity-0 group-hover:opacity-100'}`}
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(photo.id); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onToggleFavorite(photo.id); } }}
            aria-label={t('Favorite')}
            aria-pressed={photo.isFavorite}
          >
            <Heart className="h-4 w-4" fill={photo.isFavorite ? 'currentColor' : 'none'} />
          </span>
        )}
      </button>
      {showCaptions && (
        <div className="mt-1.5">
          <b className="block truncate text-[13px] font-semibold text-gray-900 photo-gallery-tile-caption">{photo.caption || t('Untitled photo')}</b>
          <i className="text-[11.5px] not-italic text-gray-400 photo-gallery-tile-date">{new Date(photo.takenAt).toLocaleDateString()}</i>
        </div>
      )}
    </div>
  );
}

/**
 * Responsive photo tile grid. Pure presentational — all data shaping
 * (filter/group/paginate) happens in the parent `PhotoGallery` container.
 */
export default function PhotoGrid({ photos, selectMode, selectedIds, onToggleSelect, onOpen, onToggleFavorite, showCaptions }: PhotoGridProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
      {photos.map((photo) => (
        <GalleryTile
          key={photo.id}
          photo={photo}
          selectMode={selectMode}
          selected={selectedIds.has(photo.id)}
          onToggleSelect={onToggleSelect}
          onOpen={onOpen}
          onToggleFavorite={onToggleFavorite}
          showCaptions={showCaptions}
        />
      ))}
    </div>
  );
}
