'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera } from 'lucide-react';
import { PhotoResponse } from '@/app/api/types';
import { Button } from '@/src/components/ui/button';
import { useLocalization } from '@/src/context/localization';
import { fetchPhotos, togglePhotoFavorite, trashPhoto, downloadPhoto, bulkPhotoAction } from '@/src/utils/photoClientApi';
import { filterGalleryPhotos, groupByMonth, groupByMilestone } from '@/src/utils/photoGalleryUtils';
import { PhotoQuotaMeter } from '@/src/components/ui/photo-quota-meter';
import PhotoForm from '@/src/components/forms/PhotoForm';
import GalleryToolbar from './GalleryToolbar';
import PhotoGrid from './PhotoGrid';
import Lightbox from './Lightbox';
import SelectionBar from './SelectionBar';
import TrashView from './TrashView';
import { DEFAULT_GALLERY_STATE, GalleryState, PhotoGalleryProps } from './photo-gallery.types';
import './photo-gallery.css';

type GalleryPhoto = PhotoResponse & { activityTypes: string[] };

interface PhotoGroup {
  key: string;
  heading: string | null;
  photos: GalleryPhoto[];
}

function formatMonthHeading(monthKey: string, language: string): string {
  return new Date(`${monthKey}-01T00:00:00`).toLocaleDateString(language || undefined, { month: 'long', year: 'numeric' });
}

/**
 * Container for the Photos gallery page: owns filter/grouping state and the
 * fetched photo list, and composes the hero header, toolbar, and grid.
 * The lightbox, selection bar, and Trash view (Task 24) plug in via the
 * same `GalleryState` (`view`, `lightboxPhotoId`) this component already
 * threads through.
 */
export default function PhotoGallery({ babyId }: PhotoGalleryProps) {
  const { t, language } = useLocalization();

  const [state, setState] = useState<GalleryState>(DEFAULT_GALLERY_STATE);
  const [photos, setPhotos] = useState<PhotoResponse[]>([]);
  const [quota, setQuota] = useState<{ usedBytes: number; totalBytes: number } | null>(null);
  const [trashCount, setTrashCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [showAddPhotos, setShowAddPhotos] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const onStateChange = useCallback((partial: Partial<GalleryState>) => {
    // Exiting select mode, emptying the selection, or switching views all
    // leave any prior bulk-action error stale and orphaned (nothing on
    // screen to attach it to) — clear it alongside those transitions.
    if (partial.selectMode === false || partial.selectedIds?.size === 0 || partial.view !== undefined) {
      setActionError(null);
    }
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
      return groupByMonth(filtered).map((g) => ({ key: g.monthKey, heading: formatMonthHeading(g.monthKey, language), photos: g.photos }));
    }
    if (state.grouping === 'milestone') {
      return groupByMilestone(filtered).map((g) => ({
        key: g.milestoneTitle ?? '__none__',
        heading: g.milestoneTitle || t('No milestone'),
        photos: g.photos,
      }));
    }
    return [{ key: 'all', heading: null, photos: filtered }];
  }, [state.grouping, filtered, t, language]);

  const hasActiveFilters = !!state.query || state.typeFilter !== 'all' || state.favoritesOnly;

  // The lightbox normally navigates across the filtered list. If the open
  // photo has been filtered out from under it (e.g. opened from the Photo
  // Library tab while a search/type filter is active), fall back to a
  // single-item list so it still renders instead of going stuck-invisible.
  const lightboxPhotos = useMemo(() => {
    if (!state.lightboxPhotoId || filtered.some((p) => p.id === state.lightboxPhotoId)) return filtered;
    const fallback = photos.find((p) => p.id === state.lightboxPhotoId);
    return fallback ? [fallback] : filtered;
  }, [filtered, photos, state.lightboxPhotoId]);

  // Guard against a mounted-but-blank Lightbox: if the open photo drops out
  // of both the filtered list and the single-item fallback (e.g. a reload
  // after delete resets pagination and the photo is gone), close it rather
  // than leaving the body-scroll lock and keydown listener stuck active.
  // Gated on `!isLoading` so this doesn't race a just-kicked-off loadPhotos()
  // call (e.g. opening from PhotoForm's Photo Library tab) — `photos` is
  // still stale mid-request, and closing here would immediately undo the
  // open. The Lightbox is already hardened to stay inert while `photo` is
  // unresolved, so it's safe to wait for the load to settle.
  useEffect(() => {
    if (!isLoading && state.lightboxPhotoId && !lightboxPhotos.some((p) => p.id === state.lightboxPhotoId)) {
      setState((s) => ({ ...s, lightboxPhotoId: null }));
    }
  }, [isLoading, state.lightboxPhotoId, lightboxPhotos]);

  const handleToggleSelect = useCallback((id: string) => {
    setState((prev) => {
      const next = new Set(prev.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setActionError(null);
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

  // Deleting the currently open lightbox photo advances to its neighbor in
  // the filtered list (or closes the lightbox if it was the last one left).
  const handleLightboxDelete = useCallback(
    async (id: string) => {
      const idx = lightboxPhotos.findIndex((p) => p.id === id);
      const fallbackId = idx < 0 ? null : lightboxPhotos[idx + 1]?.id ?? lightboxPhotos[idx - 1]?.id ?? null;
      try {
        await trashPhoto(id);
        onStateChange({ lightboxPhotoId: fallbackId });
        await loadPhotos(true);
      } catch (error) {
        console.error('Error deleting photo:', error);
      }
    },
    [lightboxPhotos, onStateChange, loadPhotos]
  );

  const handleLightboxDownload = useCallback(async (photo: PhotoResponse) => {
    try {
      await downloadPhoto(photo.id, photo.originalName);
    } catch (error) {
      console.error('Error downloading photo:', error);
    }
  }, []);

  const handleBulkDownload = useCallback(async () => {
    setActionError(null);
    let failures = 0;
    for (const id of Array.from(state.selectedIds)) {
      const photo = photos.find((p) => p.id === id);
      if (!photo) continue;
      try {
        await downloadPhoto(photo.id, photo.originalName);
      } catch (error) {
        console.error('Error downloading photo:', error);
        failures += 1;
      }
    }
    if (failures > 0) setActionError(t('Some photos failed to download'));
  }, [state.selectedIds, photos, t]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(state.selectedIds);
    if (ids.length === 0) return;
    setActionError(null);
    try {
      const count = await bulkPhotoAction('trash', ids);
      onStateChange({ selectMode: false, selectedIds: new Set() });
      await loadPhotos(true);
      if (count < ids.length) setActionError(t('Some photos could not be updated'));
    } catch (error) {
      console.error('Error deleting photos:', error);
      setActionError(t('Failed to delete photo'));
    }
  }, [state.selectedIds, onStateChange, loadPhotos, t]);

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
        {state.view === 'trash' ? (
          <TrashView
            babyId={babyId}
            onBack={() => onStateChange({ view: 'gallery' })}
            onChanged={() => loadPhotos(true)}
          />
        ) : (
          <>
            <GalleryToolbar state={state} onStateChange={onStateChange} trashCount={trashCount} />

            {actionError && (
              <p className="text-xs text-red-500" role="alert">
                {actionError}
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

      {state.lightboxPhotoId && (
        <Lightbox
          photos={lightboxPhotos}
          photoId={state.lightboxPhotoId}
          onClose={() => onStateChange({ lightboxPhotoId: null })}
          onNavigate={(photoId) => onStateChange({ lightboxPhotoId: photoId })}
          onToggleFavorite={handleToggleFavorite}
          onDelete={handleLightboxDelete}
          onDownload={handleLightboxDownload}
        />
      )}

      {state.selectMode && state.selectedIds.size > 0 && (
        <SelectionBar
          count={state.selectedIds.size}
          onDownload={handleBulkDownload}
          onDelete={handleBulkDelete}
          onCancel={() => {
            setActionError(null);
            onStateChange({ selectMode: false, selectedIds: new Set() });
          }}
        />
      )}
    </div>
  );
}
