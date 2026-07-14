'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Search, Heart, ChevronRight, Camera } from 'lucide-react';
import { Input } from '@/src/components/ui/input';
import { useLocalization } from '@/src/context/localization';
import { useTimezone } from '@/app/context/timezone';
import { formatDateLong, formatTimeDisplay } from '@/src/utils/dateFormat';
import { useAuthedImage, photoFileUrl } from '@/src/hooks/useAuthedImage';
import { fetchPhotos, togglePhotoFavorite } from '@/src/utils/photoClientApi';
import { filterGalleryPhotos } from '@/src/utils/photoGalleryUtils';
import { PhotoResponse } from '@/app/api/types';
import { PhotoTabCommonProps } from './photo-form.types';

function LibraryThumb({ photoId }: { photoId: string }) {
  const { src } = useAuthedImage(photoFileUrl(photoId, 'thumb'));
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-gray-100">
      {src && <img src={src} alt="" className="h-full w-full object-cover" />}
    </span>
  );
}

export default function PhotoLibraryTab({ babyId, onOpenPhoto, refreshTrigger, onClose }: PhotoTabCommonProps) {
  const { t } = useLocalization();
  const { dateFormat, timeFormat } = useTimezone();
  const router = useRouter();
  const params = useParams();
  const [photos, setPhotos] = useState<PhotoResponse[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPhotos({ babyId })
      .then((data) => {
        if (!cancelled) setPhotos(data.photos);
      })
      .catch(() => {
        if (!cancelled) setPhotos([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [babyId, refreshTrigger]);

  const filtered = useMemo(
    () =>
      filterGalleryPhotos(
        photos.map((p) => ({ ...p, activityTypes: p.links.map((l) => l.activityType) })),
        { query }
      ),
    [photos, query]
  );

  // Group by taken date (local day) - newest first
  const byDay = useMemo(() => {
    const groups = new Map<string, typeof filtered>();
    for (const photo of filtered) {
      const day = new Date(photo.takenAt).toDateString();
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day)!.push(photo);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  const handleToggleFavorite = async (photoId: string) => {
    try {
      const isFavorite = await togglePhotoFavorite(photoId);
      setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, isFavorite } : p)));
    } catch (err) {
      console.error('Failed to toggle photo favorite', err);
    }
  };

  const openGallery = () => {
    const slug = params?.slug;
    if (slug) router.push(`/${slug}/photos`);
    onClose();
  };

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Search captions, milestones…')} />
      </div>
      <p className="mt-2 text-xs text-gray-400">
        {filtered.length} {filtered.length === 1 ? t('photo') : t('photos')} •{' '}
        <button type="button" className="text-teal-600 underline" onClick={openGallery}>
          {t('Open Photos gallery')}
        </button>
      </p>

      {byDay.map(([day, dayPhotos]) => (
        <div key={day}>
          <div className="mt-4 mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">
            {formatDateLong(new Date(dayPhotos[0].takenAt), dateFormat)}
          </div>
          {dayPhotos.map((photo) => (
            <div
              key={photo.id}
              className="photo-library-row flex w-full cursor-pointer items-center gap-3 rounded-xl px-1.5 py-2 hover:bg-gray-50"
              role="button"
              tabIndex={0}
              onClick={() => onOpenPhoto?.(photo.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpenPhoto?.(photo.id);
                }
              }}
            >
              <LibraryThumb photoId={photo.id} />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-sm text-gray-900 photo-library-caption">{photo.caption || t('Untitled photo')}</b>
                <i className="block text-xs not-italic text-gray-500">
                  {formatTimeDisplay(new Date(photo.takenAt), timeFormat)}
                  {photo.milestoneTitle ? ` • ${photo.milestoneTitle}` : ''}
                </i>
              </span>
              <button
                type="button"
                className={photo.isFavorite ? 'text-red-500' : 'text-gray-300'}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleFavorite(photo.id);
                }}
                aria-label={photo.isFavorite ? t('Remove from favorites') : t('Favorite')}
                aria-pressed={photo.isFavorite}
              >
                <Heart size={18} fill={photo.isFavorite ? 'currentColor' : 'none'} />
              </button>
              <ChevronRight className="h-4 w-4 text-gray-300" />
            </div>
          ))}
        </div>
      ))}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-14 text-sm text-gray-400">
          <Camera className="h-8 w-8" />
          {query ? t('No photos match your search') : t('No photos yet')}
        </div>
      )}
    </div>
  );
}
