'use client';

import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Copy, Download } from 'lucide-react';
import { useLocalization } from '@/src/context/localization';
import { useToast } from '@/src/components/ui/toast';

export interface ShortLinkQrDialogProps {
  open: boolean;
  onClose: () => void;
  shortUrl: string; // absolute, e.g. https://sprout-track.com/go/a1b2c3d4
  slug: string;     // used for the download filename
}

/**
 * Computes the centered, padded logo overlay for a QR code of the given
 * pixel width. Logo occupies 20% of the QR width; the white backing tile
 * adds 12% padding around the logo and is centered on the code.
 */
export function qrLogoLayout(qrSize: number): { logoSize: number; tileSize: number; offset: number; tileRadius: number } {
  const logoSize = Math.round(qrSize * 0.2);
  const tileSize = Math.round(logoSize * 1.24);
  const offset = Math.round((qrSize - tileSize) / 2);
  const tileRadius = Math.round(tileSize * 0.15);
  return { logoSize, tileSize, offset, tileRadius };
}

export function ShortLinkQrDialog({ open, onClose, shortUrl, slug }: ShortLinkQrDialogProps): React.JSX.Element {
  const { t } = useLocalization();
  const { showToast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    let cancelled = false;
    const canvas = canvasRef.current;

    QRCode.toCanvas(canvas, shortUrl, {
      errorCorrectionLevel: 'H',
      width: 1024,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(() => {
        if (cancelled) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const img = new window.Image();
        img.onload = () => {
          if (cancelled) return;
          const { logoSize, tileSize, offset, tileRadius } = qrLogoLayout(1024);
          ctx.save();
          if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(offset, offset, tileSize, tileSize, tileRadius);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
          } else {
            // Older engines without CanvasRenderingContext2D.roundRect: fall
            // back to a square tile rather than losing the logo entirely.
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(offset, offset, tileSize, tileSize);
          }
          ctx.restore();
          const pad = Math.round((tileSize - logoSize) / 2);
          ctx.drawImage(img, offset + pad, offset + pad, logoSize, logoSize);
        };
        img.onerror = () => {
          console.error('QR logo failed to load');
        };
        img.src = '/sprout-256.png';
      })
      .catch((error) => {
        console.error('Error generating QR code:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [open, shortUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shortUrl);
      showToast({
        variant: 'success',
        title: t('Copied!'),
        message: t('Short URL copied to clipboard'),
        duration: 3000,
      });
    } catch (error) {
      console.error('Error copying short URL:', error);
      showToast({
        variant: 'error',
        title: t('Error'),
        message: t('Failed to copy short URL'),
        duration: 5000,
      });
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sprout-track-${slug}-qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('QR Code')}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 flex flex-col items-center gap-4">
          <canvas ref={canvasRef} className="w-64 h-64 max-w-full" aria-label={t('QR Code')} />
          <div className="flex gap-2 w-full">
            <Input
              readOnly
              value={shortUrl}
              aria-label={t('Short URL')}
              className="flex-1 font-mono text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              title={t('Copy short URL')}
              aria-label={t('Copy short URL')}
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <Button variant="default" onClick={handleDownload} className="w-full">
            <Download className="h-4 w-4 mr-1" aria-hidden="true" />
            {t('Download PNG')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
