'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera } from 'lucide-react';
import { PhotoResponse } from '@/app/api/types';
import { Button } from '@/src/components/ui/button';
import { useLocalization } from '@/src/context/localization';
import { fetchPhotos, togglePhotoFavorite } from '@/src/utils/photoClientApi';
import { filterGalleryPhotos, groupByMonth, groupByMilestone } from '@/src/utils/photoGalleryUtils';
import { PhotoQuotaMeter } from '@/src/components/ui/photo-quota-meter';
import PhotoForm from '@/src/components/forms/PhotoForm';
import PhotoDetail from '@/src/components/PhotoDetail';
import GalleryToolbar from './GalleryToolbar';
import PhotoGrid from './PhotoGrid';
import { DEFAULT_GALLERY_STATE, GalleryState, PhotoGalleryProps } from './photo-gallery.types';
import './photo-gallery.css';

type GalleryPhoto = PhotoResponse & { activityTypes: string[] };

interface PhotoGroup {
  key: string;
  heading: string | null;
  photos: GalleryPhoto[];
}

function formatMonthHeading(monthKey: string): string {
  return new Date(`${monthKey}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Container for the Photos gallery page: owns filter/grouping state and the
 * fetched photo list, and composes the hero header, toolbar, and grid.
 * The lightbox, selection bar, and Trash view (Task 24) plug in via the
 * same `GalleryState` (`view`, `lightboxPhotoId`) this component already
 * threads through.
 */
export default function PhotoGallery({ babyId }: PhotoGalleryProps) {
  const { t } = useLocalization();

  const [state, setState] = useState<GalleryState>(DEFAULT_GALLERY_STATE);
  const [photos, setPhotos] = useState<PhotoResponse[]>([]);
  const [quota, setQuota] = useState<{ usedBytes: number; totalBytes: number } | null>(null);
  const [trashCount, setTrashCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [showAddPhotos, setShowAddPhotos] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const onStateChange = useCallback((partial: Partial<GalleryState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const loadPhotos = useCallback(
    async (reset = true) => {
      if (reset) setIsLoading(true);
      else setIsLoadingMore(true);
      try {
        const data = await fetchPhotos({
          babyId,
          trash: state.view === 'trash',
          ...(reset ? {} : { cursor: nextCursor || undefined }),
        });
        setPhotos((prev) => (reset ? data.photos : [...prev, ...data.photos]));
        setQuota(data.quota);
        setTrashCount(data.trashCount);
        setNextCursor(data.nextCursor);
        setLoadError(null);
      } catch (error) {
        console.error('Error fetching photos:', error);
        setLoadError(error instanceof Error ? error.message : t('Failed to load photos'));
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [babyId, state.view, nextCursor, t]
  );

  // Reload from scratch whenever the baby or gallery/trash view changes.
  useEffect(() => {
    setNextCursor(null);
    loadPhotos(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [babyId, state.view]);

  const galleryPhotos = useMemo<GalleryPhoto[]>(
    () => photos.map((p) => ({ ...p, activityTypes: p.links.map((l) => l.activityType) })),
    [photos]
  );

  const filtered = useMemo(
    () =>
      filterGalleryPhotos(galleryPhotos, {
        query: state.query,
        type: state.typeFilter,
        favoritesOnly: state.favoritesOnly,
      }),
    [galleryPhotos, state.query, state.typeFilter, state.favoritesOnly]
  );

  const groups = useMemo<PhotoGroup[]>(() => {
    if (state.grouping === 'month') {
      return groupByMonth(filtered).map((g) => ({ key: g.monthKey, heading: formatMonthHeading(g.monthKey), photos: g.photos }));
    }
    if (state.grouping === 'milestone') {
      return groupByMilestone(filtered).map((g) => ({
        key: g.milestoneTitle ?? '__none__',
        heading: g.milestoneTitle || t('No milestone'),
        photos: g.photos,
      }));
    }
    return [{ key: 'all', heading: null, photos: filtered }];
  }, [state.grouping, filtered, t]);

  const hasActiveFilters = !!state.query || state.typeFilter !== 'all' || state.favoritesOnly;

  const handleToggleSelect = useCallback((id: string) => {
    setState((prev) => {
      const next = new Set(prev.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, selectedIds: next };
    });
  }, []);

  const handleOpen = useCallback((photo: PhotoResponse) => {
    onStateChange({ lightboxPhotoId: photo.id });
  }, [onStateChange]);

  const handleToggleFavorite = useCallback(async (id: string) => {
    let previous = false;
    setPhotos((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          previous = p.isFavorite;
          return { ...p, isFavorite: !p.isFavorite };
        }
        return p;
      })
    );
    try {
      await togglePhotoFavorite(id);
    } catch {
      setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, isFavorite: previous } : p)));
    }
  }, []);

  const clearFilters = useCallback(() => {
    onStateChange({ query: '', typeFilter: 'all', favoritesOnly: false });
  }, [onStateChange]);

  const detailPhoto = useMemo(
    () => photos.find((p) => p.id === state.lightboxPhotoId) ?? null,
    [photos, state.lightboxPhotoId]
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-3 p-4 text-white photo-gallery-header bg-gradient-to-r from-teal-600 to-teal-700 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">{t('Photos')}</h1>
          {quota && <PhotoQuotaMeter usedBytes={quota.usedBytes} totalBytes={quota.totalBytes} variant="dark" className="mt-1" />}
        </div>
        <Button
          type="button"
          onClick={() => setShowAddPhotos(true)}
          className="w-fit bg-white text-teal-700 hover:bg-white/90"
        >
          <Camera className="mr-2 h-4 w-4" aria-hidden="true" />
          {t('Add Photos')}
        </Button>
      </div>

      <div className="space-y-6 p-4">
        <GalleryToolbar state={state} onStateChange={onStateChange} trashCount={trashCount} />

        {state.selectMode && (
          <p className="text-xs font-medium text-gray-500">
            {state.selectedIds.size} {t('Selected')}
          </p>
        )}

        {isLoading && photos.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" aria-hidden="true" />
            <span className="sr-only">{t('Loading')}...</span>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-gray-500">{loadError}</p>
            <Button type="button" variant="outline" onClick={() => loadPhotos(true)}>
              {t('Retry')}
            </Button>
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-gray-100 photo-gallery-empty-icon">
              <Camera className="h-8 w-8 text-gray-400" aria-hidden="true" />
            </div>
            <p className="text-sm text-gray-500">{t('No photos yet — capture your first moment!')}</p>
            <Button type="button" onClick={() => setShowAddPhotos(true)}>
              {t('Add Photos')}
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-gray-500">{t('No photos match')}</p>
            <Button type="button" variant="outline" onClick={clearFilters} disabled={!hasActiveFilters}>
              {t('Clear filters')}
            </Button>
          </div>
        ) : (
          <>
            {groups.map((group) => (
              <section key={group.key}>
                {group.heading && (
                  <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500 photo-gallery-month-heading">
                    {group.heading}
                  </h2>
                )}
                <PhotoGrid
                  photos={group.photos}
                  selectMode={state.selectMode}
                  selectedIds={state.selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onOpen={handleOpen}
                  onToggleFavorite={handleToggleFavorite}
                  showCaptions={state.showCaptions}
                />
              </section>
            ))}

            {nextCursor && (
              <div className="flex justify-center pt-2">
                <Button type="button" variant="outline" onClick={() => loadPhotos(false)} disabled={isLoadingMore}>
                  {t('Load more')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <PhotoForm
        isOpen={showAddPhotos}
        onClose={() => setShowAddPhotos(false)}
        babyId={babyId}
        initialTime={new Date().toISOString()}
        onSuccess={() => {
          setShowAddPhotos(false);
          loadPhotos(true);
        }}
        onOpenPhoto={(photoId) => {
          setShowAddPhotos(false);
          // The Photo Library tab fetches its own list, which may include
          // photos not yet in the gallery's loaded page — reload so the
          // detail drawer always has the photo it's asked to open.
          loadPhotos(true);
          onStateChange({ lightboxPhotoId: photoId });
        }}
      />

      <PhotoDetail
        isOpen={!!state.lightboxPhotoId}
        onClose={() => onStateChange({ lightboxPhotoId: null })}
        photo={detailPhoto}
        onChanged={() => loadPhotos(true)}
      />
    </div>
  );
}
