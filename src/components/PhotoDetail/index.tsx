'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Heart, Pencil, Download, Trash2, ImageOff } from 'lucide-react';
import { FormPage, FormPageContent, FormPageFooter } from '@/src/components/ui/form-page';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { useLocalization } from '@/src/context/localization';
import { useTimezone } from '@/app/context/timezone';
import { formatDateLong, formatTimeDisplay } from '@/src/utils/dateFormat';
import { useAuthedImage, photoFileUrl } from '@/src/hooks/useAuthedImage';
import { updatePhoto, trashPhoto, togglePhotoFavorite, downloadPhoto } from '@/src/utils/photoClientApi';
import { PhotoDetailProps } from './photo-detail.types';
import './photo-detail.css';

// Maps a PhotoLink's activityType to its localization key.
const TYPE_LABEL_KEYS: Record<string, string> = {
  photo: 'Photo',
  feed: 'Feed',
  milestone: 'Milestone',
  bath: 'Bath',
  play: 'Activity',
  measurement: 'Measurement',
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="photo-detail-row-label text-sm font-medium text-gray-500">{label}</span>
      <span className="photo-detail-row-value text-right text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}

/**
 * Single-photo viewer/editor drawer. The parent always holds the loaded
 * `PhotoResponse` (from the library list, timeline, or a record view), so
 * this component takes the photo directly rather than fetching by id.
 */
export default function PhotoDetail({ isOpen, onClose, photo, onChanged }: PhotoDetailProps) {
  const { t } = useLocalization();
  const { dateFormat, timeFormat } = useTimezone();

  const [caption, setCaption] = useState(photo?.caption ?? '');
  const [isFavorite, setIsFavorite] = useState(photo?.isFavorite ?? false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [draftCaption, setDraftCaption] = useState('');
  const [savingCaption, setSavingCaption] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipCaptionSaveRef = useRef(false);

  // Sync local edit state whenever the parent hands us a different photo
  // (or a refetch brings back updated caption/favorite values).
  useEffect(() => {
    setCaption(photo?.caption ?? '');
    setIsFavorite(photo?.isFavorite ?? false);
    setEditingCaption(false);
    setError(null);
  }, [photo?.id, photo?.caption, photo?.isFavorite]);

  const { src, error: imageError } = useAuthedImage(
    photo ? photoFileUrl(photo.id, 'full') : null,
    isOpen && !!photo
  );

  if (!photo) return null;

  const startEditCaption = () => {
    setDraftCaption(caption);
    setEditingCaption(true);
  };

  const saveCaption = async () => {
    const trimmed = draftCaption.trim();
    setEditingCaption(false);
    if (trimmed === (caption || '').trim()) return;
    setSavingCaption(true);
    setError(null);
    try {
      const updated = await updatePhoto(photo.id, { caption: trimmed || null });
      setCaption(updated.caption ?? '');
      onChanged?.();
    } catch {
      setError(t('Failed to update caption'));
    } finally {
      setSavingCaption(false);
    }
  };

  const handleCaptionBlur = () => {
    if (skipCaptionSaveRef.current) {
      skipCaptionSaveRef.current = false;
      return;
    }
    saveCaption();
  };

  const handleCaptionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      skipCaptionSaveRef.current = true;
      e.currentTarget.blur();
    }
  };

  const handleToggleFavorite = async () => {
    if (togglingFavorite) return;
    setTogglingFavorite(true);
    setError(null);
    try {
      const next = await togglePhotoFavorite(photo.id);
      setIsFavorite(next);
      onChanged?.();
    } catch {
      setError(t('Failed to update favorite'));
    } finally {
      setTogglingFavorite(false);
    }
  };

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    setError(null);
    try {
      await downloadPhoto(photo.id, photo.originalName);
    } catch {
      setError(t('Failed to download photo'));
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await trashPhoto(photo.id);
      onChanged?.();
      onClose();
    } catch {
      setError(t('Failed to delete photo'));
      setDeleting(false);
    }
  };

  // "Type" is the first link's activityType (what kind of entry the photo
  // belongs to). "Linked activity" is narrower: it only surfaces a
  // cross-referenced feed/bath/play/measurement record, since a milestone
  // tag already gets its own row and a bare 'photo' link (library-only
  // entry) isn't a "linked activity".
  const primaryLink = photo.links[0];
  const typeLabel = primaryLink ? t(TYPE_LABEL_KEYS[primaryLink.activityType] ?? primaryLink.activityType) : t('Photo');
  const crossLink = photo.links.find((l) => l.activityType !== 'photo' && l.activityType !== 'milestone');
  const linkedActivityLabel = crossLink ? t(TYPE_LABEL_KEYS[crossLink.activityType] ?? crossLink.activityType) : '—';

  return (
    <FormPage isOpen={isOpen} onClose={onClose} title={t('Photo')}>
      <FormPageContent>
        <div className="space-y-4 p-4">
          <div className="photo-detail-image-wrap relative flex h-64 items-center justify-center overflow-hidden rounded-xl bg-gray-100 sm:h-80">
            {imageError ? (
              <ImageOff className="h-8 w-8 text-gray-400" aria-hidden="true" />
            ) : src ? (
              <img src={src} alt={caption || t('Photo')} className="h-full w-full object-contain" />
            ) : (
              <div className="photo-detail-image-skeleton h-full w-full animate-pulse bg-gray-200" aria-hidden="true" />
            )}
            <button
              type="button"
              className="photo-detail-favorite-overlay absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-red-500 shadow"
              onClick={handleToggleFavorite}
              disabled={togglingFavorite}
              aria-pressed={isFavorite}
              aria-label={isFavorite ? t('Remove from favorites') : t('Favorite')}
            >
              <Heart className="h-5 w-5" fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-start justify-between gap-2">
            {editingCaption ? (
              <Input
                autoFocus
                value={draftCaption}
                onChange={(e) => setDraftCaption(e.target.value)}
                onBlur={handleCaptionBlur}
                onKeyDown={handleCaptionKeyDown}
                disabled={savingCaption}
                aria-label={t('Edit caption')}
                className="flex-1"
              />
            ) : (
              <>
                <p className={`flex-1 text-base font-semibold ${caption ? 'text-gray-900' : 'italic text-gray-400'}`}>
                  {caption || t('Untitled photo')}
                </p>
                <Button type="button" variant="ghost" size="icon" onClick={startEditCaption} aria-label={t('Edit caption')}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
              </>
            )}
          </div>

          <div className="photo-detail-meta">
            <Row
              label={t('Taken:')}
              value={`${formatDateLong(new Date(photo.takenAt), dateFormat)} • ${formatTimeDisplay(new Date(photo.takenAt), timeFormat)}`}
            />
            <Row label={t('Type:')} value={typeLabel} />
            {photo.milestoneTitle && (
              <Row
                label={t('Milestone:')}
                value={
                  <span className="photo-detail-milestone-chip inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                    {photo.milestoneTitle}
                  </span>
                }
              />
            )}
            <Row label={t('Linked activity:')} value={linkedActivityLabel} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={handleToggleFavorite} disabled={togglingFavorite} aria-pressed={isFavorite}>
              <Heart className="mr-2 h-4 w-4" fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
              {isFavorite ? t('Favorited') : t('Favorite')}
            </Button>
            <Button type="button" variant="outline" onClick={handleDownload} disabled={downloading}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('Download')}
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('Delete')}
            </Button>
          </div>
          <p className="photo-detail-hint text-xs text-gray-400">
            {t('Deleted photos move to Trash and auto-delete after 30 days.')}
          </p>
          {error && (
            <p className="photo-detail-error text-xs text-red-500" role="alert">
              {error}
            </p>
          )}
        </div>
      </FormPageContent>
      <FormPageFooter>
        <Button variant="outline" onClick={onClose}>
          {t('Close')}
        </Button>
      </FormPageFooter>
    </FormPage>
  );
}
