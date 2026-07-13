'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Heart, ImageOff, Trash2, X } from 'lucide-react';
import { PhotoResponse } from '@/app/api/types';
import { Button } from '@/src/components/ui/button';
import { useLocalization } from '@/src/context/localization';
import { useTimezone } from '@/app/context/timezone';
import { formatDateLong, formatTimeDisplay } from '@/src/utils/dateFormat';
import { useAuthedImage, photoFileUrl } from '@/src/hooks/useAuthedImage';

// Maps a PhotoLink's activityType to its localization key (mirrors PhotoDetail).
const TYPE_LABEL_KEYS: Record<string, string> = {
  photo: 'Photo',
  feed: 'Feed',
  milestone: 'Milestone',
  bath: 'Bath',
  play: 'Activity',
  measurement: 'Measurement',
};

interface LightboxProps {
  photos: PhotoResponse[];
  photoId: string;
  onClose: () => void;
  onNavigate: (photoId: string) => void;
  onToggleFavorite: (id: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onDownload: (photo: PhotoResponse) => void | Promise<void>;
}

/**
 * Full-screen photo viewer for the gallery. Replaces `PhotoDetail` for tile
 * clicks in the gallery: adds prev/next navigation across the currently
 * filtered photo list. All mutations (favorite/delete/download) are
 * delegated to the parent via props — this component only renders.
 */
export default function Lightbox({ photos, photoId, onClose, onNavigate, onToggleFavorite, onDelete, onDownload }: LightboxProps) {
  const { t } = useLocalization();
  const { dateFormat, timeFormat } = useTimezone();
  const [busy, setBusy] = useState<'favorite' | 'download' | 'delete' | null>(null);

  const index = useMemo(() => photos.findIndex((p) => p.id === photoId), [photos, photoId]);
  const photo = index >= 0 ? photos[index] : null;
  const prevId = index > 0 ? photos[index - 1].id : null;
  const nextId = index >= 0 && index < photos.length - 1 ? photos[index + 1].id : null;

  const { src, loading, error: imageError } = useAuthedImage(photo ? photoFileUrl(photo.id, 'full') : null, !!photo);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && prevId) onNavigate(prevId);
      if (e.key === 'ArrowRight' && nextId) onNavigate(nextId);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prevId, nextId, onClose, onNavigate]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    setBusy(null);
  }, [photoId]);

  if (!photo) return null;

  const primaryLink = photo.links[0];
  const typeLabel = primaryLink ? t(TYPE_LABEL_KEYS[primaryLink.activityType] ?? primaryLink.activityType) : t('Photo');
  const crossLink = photo.links.find((l) => l.activityType !== 'photo' && l.activityType !== 'milestone');
  const linkedActivityLabel = crossLink ? t(TYPE_LABEL_KEYS[crossLink.activityType] ?? crossLink.activityType) : '—';

  const handleToggleFavorite = async () => {
    if (busy) return;
    setBusy('favorite');
    try {
      await onToggleFavorite(photo.id);
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async () => {
    if (busy) return;
    setBusy('download');
    try {
      await onDownload(photo);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (busy) return;
    setBusy('delete');
    try {
      await onDelete(photo.id);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption || t('Photo')}
      onClick={onClose}
    >
      {prevId && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNavigate(prevId); }}
          className="photo-gallery-lightbox-nav absolute left-3 top-1/2 z-[61] grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:left-6"
          aria-label={t('Previous photo')}
        >
          <ChevronLeft className="h-6 w-6" aria-hidden="true" />
        </button>
      )}
      {nextId && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNavigate(nextId); }}
          className="photo-gallery-lightbox-nav absolute right-3 top-1/2 z-[61] grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:right-6"
          aria-label={t('Next photo')}
        >
          <ChevronRight className="h-6 w-6" aria-hidden="true" />
        </button>
      )}

      <div
        className="photo-gallery-lightbox relative flex max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="photo-gallery-lightbox-close absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-gray-700 shadow"
          aria-label={t('Close')}
          autoFocus
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="photo-gallery-lightbox-media relative flex flex-1 items-center justify-center bg-slate-900">
          {imageError ? (
            <ImageOff className="h-10 w-10 text-slate-500" aria-hidden="true" />
          ) : src ? (
            <img src={src} alt={photo.caption || t('Photo')} className="h-full max-h-[85vh] w-full object-contain" />
          ) : loading ? (
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" aria-hidden="true" />
          ) : null}
        </div>

        <div className="photo-gallery-lightbox-meta w-full max-w-sm shrink-0 overflow-y-auto p-5">
          <p className={`text-base font-semibold ${photo.caption ? 'text-gray-900' : 'italic text-gray-400'} photo-gallery-lightbox-caption`}>
            {photo.caption || t('Untitled photo')}
          </p>

          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between gap-3 py-1">
              <span className="text-sm font-medium text-gray-500 photo-gallery-lightbox-row-label">{t('Taken:')}</span>
              <span className="text-right text-sm font-semibold text-gray-900 photo-gallery-lightbox-row-value">
                {formatDateLong(new Date(photo.takenAt), dateFormat)} • {formatTimeDisplay(new Date(photo.takenAt), timeFormat)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 py-1">
              <span className="text-sm font-medium text-gray-500 photo-gallery-lightbox-row-label">{t('Type:')}</span>
              <span className="text-right text-sm font-semibold text-gray-900 photo-gallery-lightbox-row-value">{typeLabel}</span>
            </div>
            {photo.milestoneTitle && (
              <div className="flex items-center justify-between gap-3 py-1">
                <span className="text-sm font-medium text-gray-500 photo-gallery-lightbox-row-label">{t('Milestone:')}</span>
                <span className="photo-gallery-lightbox-milestone-chip inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                  {photo.milestoneTitle}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 py-1">
              <span className="text-sm font-medium text-gray-500 photo-gallery-lightbox-row-label">{t('Linked activity:')}</span>
              <span className="text-right text-sm font-semibold text-gray-900 photo-gallery-lightbox-row-value">{linkedActivityLabel}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={handleToggleFavorite} disabled={!!busy} aria-pressed={photo.isFavorite}>
              <Heart className="mr-2 h-4 w-4" fill={photo.isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
              {photo.isFavorite ? t('Favorited') : t('Favorite')}
            </Button>
            <Button type="button" variant="outline" onClick={handleDownload} disabled={!!busy}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('Download')}
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={!!busy}>
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('Delete')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
