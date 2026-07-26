'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, SwitchCamera, VideoOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { useLocalization } from '@/src/context/localization';
import { cn } from '@/src/lib/utils';
import {
  CAPTURE_JPEG_QUALITY,
  CAPTURE_MIME,
  CameraErrorKind,
  CameraFacingMode,
  capturedPhotoFileName,
  mapGetUserMediaError,
  nextFacingMode,
} from '@/src/utils/photoUtils';
import { cameraCaptureStyles as styles } from './camera-capture.styles';
import { CameraCaptureModalProps, CameraPhase } from './camera-capture.types';
import './camera-capture.css';

export { useTakePhoto } from './useTakePhoto';

/**
 * In-app webcam capture for devices where the file input's capture
 * attribute does nothing (desktops). Live preview, shutter, retake/use,
 * camera flip when more than one camera exists. Emits a JPEG File.
 */
export function CameraCaptureModal({ open, onClose, onCapture, initialFacingMode = 'user' }: CameraCaptureModalProps) {
  const { t } = useLocalization();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<CameraPhase>('requesting');
  const [errorKind, setErrorKind] = useState<CameraErrorKind>('unknown');
  const [facingMode, setFacingMode] = useState<CameraFacingMode>(initialFacingMode);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  // Acquire the stream while open; the cancelled flag keeps StrictMode's
  // mount→cleanup→remount and a close during the permission prompt from
  // leaking a live track.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPhase('requesting');
    setVideoReady(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorKind('no-camera');
      setPhase('error');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setPhase('streaming');
        // Device labels/counts are only reliable after permission is granted
        navigator.mediaDevices
          .enumerateDevices()
          .then((devices) => {
            if (!cancelled) setHasMultipleCameras(devices.filter((d) => d.kind === 'videoinput').length > 1);
          })
          .catch(() => {});
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorKind(mapGetUserMediaError(err?.name));
          setPhase('error');
        }
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [open, facingMode, retryNonce]);

  // Fresh state on every open
  useEffect(() => {
    if (open) return;
    setCapturedBlob(null);
    setPhase('requesting');
    setFacingMode(initialFacingMode);
  }, [open, initialFacingMode]);

  useEffect(() => {
    if (!capturedBlob) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(capturedBlob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [capturedBlob]);

  const handleShutter = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Bake the preview mirror into the file so the captured frame matches
    // what the user saw
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedBlob(blob);
        setPhase('captured');
      },
      CAPTURE_MIME,
      CAPTURE_JPEG_QUALITY
    );
  };

  const handleUsePhoto = () => {
    if (!capturedBlob) return;
    onCapture(new File([capturedBlob], capturedPhotoFileName(new Date()), { type: CAPTURE_MIME }));
    onClose();
  };

  const errorMessage =
    errorKind === 'permission-denied'
      ? t('Camera access was denied. Allow camera access in your browser settings and try again.')
      : errorKind === 'no-camera'
        ? t('No camera was found on this device.')
        : t('Could not start the camera.');

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={styles.content()} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('Take a photo')}</DialogTitle>
        </DialogHeader>
        <div className={styles.well()}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={() => setVideoReady(true)}
            className={cn(styles.video(), facingMode === 'user' && '-scale-x-100', phase !== 'streaming' && 'invisible')}
          />
          {phase === 'captured' && previewUrl && <img src={previewUrl} alt={t('Captured photo preview')} className={styles.capturedImage()} />}
          {phase === 'requesting' && (
            <div className={styles.status()}>
              <Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none" />
              <p className="text-sm">{t('Starting camera...')}</p>
            </div>
          )}
          {phase === 'error' && (
            <div className={styles.status()}>
              <VideoOff className="h-6 w-6" />
              <p className="max-w-[36ch] px-4 text-center text-sm">{errorMessage}</p>
              <button type="button" className={styles.pillGhost()} onClick={() => setRetryNonce((n) => n + 1)}>
                {t('Try Again')}
              </button>
            </div>
          )}
          {phase === 'streaming' && (
            <div className={styles.controls()}>
              <span className="justify-self-end">
                {hasMultipleCameras && (
                  <button type="button" className={styles.flipButton()} onClick={() => setFacingMode(nextFacingMode)} aria-label={t('Switch camera')}>
                    <SwitchCamera className="h-5 w-5" />
                  </button>
                )}
              </span>
              <button type="button" className={styles.shutter()} onClick={handleShutter} disabled={!videoReady} aria-label={t('Take Photo')}>
                <span className={styles.shutterDisc()} />
              </button>
              <span />
            </div>
          )}
          {phase === 'captured' && (
            <div className={styles.controls()}>
              <span />
              <span className="flex items-center gap-3">
                <button type="button" className={styles.pillGhost()} onClick={() => { setCapturedBlob(null); setPhase('streaming'); }}>
                  {t('Retake')}
                </button>
                <button type="button" className={styles.pillPrimary()} onClick={handleUsePhoto}>
                  {t('Use Photo')}
                </button>
              </span>
              <span />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CameraCaptureModal;
