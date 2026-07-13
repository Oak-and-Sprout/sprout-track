'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react';
import { PhotoResponse } from '@/app/api/types';
import { Button } from '@/src/components/ui/button';
import { useLocalization } from '@/src/context/localization';
import { fetchPhotos, bulkPhotoAction } from '@/src/utils/photoClientApi';
import PhotoGrid from './PhotoGrid';

interface TrashViewProps {
  babyId: string | undefined;
  onBack: () => void;
  onChanged: () => void;
}

const noop = () => {};

/**
 * Trash view for the gallery: lists soft-deleted photos (with the
 * days-remaining badge PhotoGrid already renders for `deletedAt`), and lets
 * the caretaker restore or permanently purge the current selection.
 * Selection is always on here, so tiles toggle selection directly.
 */
export default function TrashView({ babyId, onBack, onChanged }: TrashViewProps) {
  const { t } = useLocalization();
  const [photos, setPhotos] = useState<PhotoResponse[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [confirmingPurge, setConfirmingPurge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(
    async (reset = true) => {
      if (reset) setIsLoading(true);
      else setIsLoadingMore(true);
      try {
        const data = await fetchPhotos({ babyId, trash: true, ...(reset ? {} : { cursor: nextCursor || undefined }) });
        setPhotos((prev) => (reset ? data.photos : [...prev, ...data.photos]));
        setNextCursor(data.nextCursor);
        setLoadError(null);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : t('Failed to load photos'));
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [babyId, nextCursor, t]
  );

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [babyId]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const ids = useMemo(() => Array.from(selectedIds), [selectedIds]);

  const handleRestore = async () => {
    if (busy || ids.length === 0) return;
    setBusy(true);
    setActionError(null);
    try {
      const count = await bulkPhotoAction('restore', ids);
      setSelectedIds(new Set());
      await load(true);
      onChanged();
      if (count < ids.length) setActionError(t('Some photos could not be updated'));
    } catch {
      setActionError(t('Failed to restore photo'));
    } finally {
      setBusy(false);
    }
  };

  const handlePurge = async () => {
    if (busy || ids.length === 0) return;
    setBusy(true);
    setActionError(null);
    try {
      const count = await bulkPhotoAction('purge', ids);
      setSelectedIds(new Set());
      setConfirmingPurge(false);
      await load(true);
      onChanged();
      if (count < ids.length) setActionError(t('Some photos could not be updated'));
    } catch {
      setActionError(t('Failed to delete photo'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label={t('Back')}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <h2 className="text-lg font-bold">{t('Trash')}</h2>
      </div>
      <p className="mt-1 text-xs text-gray-500 photo-gallery-trash-hint">{t('Items are deleted forever after 30 days.')}</p>

      {ids.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 p-2.5 photo-gallery-trash-actions">
          <span className="text-xs font-medium text-gray-500">
            {ids.length} {t('selected')}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={handleRestore} disabled={busy}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t('Restore')}
          </Button>
          {confirmingPurge ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-xs text-gray-500">{t('Delete forever?')}</span>
              <Button type="button" variant="destructive" size="sm" onClick={handlePurge} disabled={busy}>
                {t('Yes')}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirmingPurge(false)} disabled={busy}>
                {t('No')}
              </Button>
            </span>
          ) : (
            <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmingPurge(true)} disabled={busy}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {t('Delete Forever')}
            </Button>
          )}
        </div>
      )}

      {actionError && (
        <p className="mt-2 text-xs text-red-500" role="alert">
          {actionError}
        </p>
      )}

      <div className="mt-4">
        {isLoading && photos.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" aria-hidden="true" />
            <span className="sr-only">{t('Loading')}...</span>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-gray-500">{loadError}</p>
            <Button type="button" variant="outline" onClick={() => load(true)}>
              {t('Retry')}
            </Button>
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-gray-100 photo-gallery-empty-icon">
              <Trash2 className="h-8 w-8 text-gray-400" aria-hidden="true" />
            </div>
            <p className="text-sm text-gray-500">{t('Trash is empty')}</p>
          </div>
        ) : (
          <>
            <PhotoGrid
              photos={photos}
              selectMode
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onOpen={noop}
              onToggleFavorite={noop}
              showCaptions={false}
            />
            {nextCursor && (
              <div className="flex justify-center pt-4">
                <Button type="button" variant="outline" onClick={() => load(false)} disabled={isLoadingMore}>
                  {t('Load more')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
