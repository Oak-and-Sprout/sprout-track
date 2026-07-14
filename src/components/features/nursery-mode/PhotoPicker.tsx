'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ReactElement } from 'react';
import { useBaby } from '@/app/context/baby';
import { useLocalization } from '@/src/context/localization';
import { useAuthedImage, photoFileUrl } from '@/src/hooks/useAuthedImage';
import { fetchPhotos, uploadPhotos } from '@/src/utils/photoClientApi';
import { PhotoResponse } from '@/app/api/types';

export interface PhotoPickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (photoId: string) => void;
}

/** Small authed thumbnail cell. A dedicated component so each grid cell owns its own hook instance. */
export function PickerThumb({ id }: { id: string }): ReactElement {
  const { src } = useAuthedImage(photoFileUrl(id, 'thumb'), true);
  return src ? (
    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
  ) : (
    <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,.06)' }} />
  );
}

/**
 * Overlay panel for choosing a nursery-mode photo: upload a new one or pick
 * from the family's existing photo gallery. Opened from SettingsDrawer's
 * Photo section.
 */
export function PhotoPicker({ open, onClose, onPick }: PhotoPickerProps): ReactElement | null {
  const { t } = useLocalization();
  const { selectedBaby } = useBaby();
  const [photos, setPhotos] = useState<PhotoResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    setUploadError(null);
    fetchPhotos({ limit: 60 })
      .then((data) => {
        if (!cancelled) setPhotos(data.photos);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file || !selectedBaby) return;
    setUploading(true);
    setUploadError(null);
    try {
      const result = await uploadPhotos([file], { babyId: selectedBaby.id });
      const uploaded = result.photos[0];
      if (uploaded) {
        onPick(uploaded.id);
        onClose();
      } else {
        // Per-file failure (quota exceeded, invalid file): the API reports it
        // in errors[] with a human-readable message while still returning success.
        setUploadError(result.errors[0]?.error || t('Failed to upload photo'));
      }
    } catch (err) {
      console.error('Failed to upload photo:', err);
      setUploadError(t('Failed to upload photo'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="nursery-ovl" style={{ zIndex: 60 }} onClick={onClose} />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(520px, 92vw)',
          maxHeight: '70vh',
          overflowY: 'auto',
          background: 'rgba(20,22,31,.95)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 18,
          padding: 20,
          zIndex: 61,
          color: '#fff',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.01em' }}>{t('Choose a photo')}</h2>
          <button type="button" className="nursery-ghost" style={{ minWidth: 44, minHeight: 44 }} onClick={onClose}>
            {t('Close')}
          </button>
        </div>

        <button
          type="button"
          className="nursery-togcard"
          style={{ marginBottom: 16, minHeight: 44, opacity: uploading || !selectedBaby ? 0.55 : undefined }}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !selectedBaby}
        >
          <div className="v">{uploading ? `${t('Loading')}...` : t('Upload photo')}</div>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleUpload} />

        {uploadError && (
          <div style={{ padding: '0 0 16px', textAlign: 'center', color: 'rgba(255,255,255,.6)' }}>{uploadError}</div>
        )}

        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,.6)' }}>{t('Loading')}...</div>
        ) : error ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,.6)' }}>{t('Failed to load photos')}</div>
        ) : photos.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,.6)' }}>{t('No photos yet')}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 8 }}>
            {photos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onPick(p.id);
                  onClose();
                }}
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  aspectRatio: '1 / 1',
                  borderRadius: 10,
                  overflow: 'hidden',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  background: 'rgba(255,255,255,.06)',
                }}
              >
                <PickerThumb id={p.id} />
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
