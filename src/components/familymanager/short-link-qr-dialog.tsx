'use client';

import React, { useCallback, useRef } from 'react';
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
 * Whether the QR code should be (re)drawn. Requires a mounted canvas node, an
 * open dialog, and a non-empty URL. Kept pure so the draw-gating that the
 * blank-QR regression turned on can be unit tested without a renderer.
 */
export function shouldDrawQr(canvas: HTMLCanvasElement | null, open: boolean, shortUrl: string): canvas is HTMLCanvasElement {
  return canvas !== null && open && shortUrl.length > 0;
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

/**
 * Sizing for the small slug caption baked into the QR bottom-right corner.
 * All values scale with the QR pixel width so the label matches at any size.
 */
export function qrSlugLabelLayout(qrSize: number): { fontPx: number; rightPad: number; bottomPad: number; boxPadX: number; boxPadY: number; radius: number } {
  const fontPx = Math.round(qrSize * 0.038);
  return {
    fontPx,
    rightPad: Math.round(qrSize * 0.02),
    bottomPad: Math.round(qrSize * 0.015),
    boxPadX: Math.round(fontPx * 0.45),
    boxPadY: Math.round(fontPx * 0.3),
    radius: Math.round(fontPx * 0.25),
  };
}

/**
 * Draws the slug in the QR's bottom-right corner on a white rounded backing so
 * it stays legible over the code. The white box plus the center logo stay well
 * within the ~30% recovery budget of error-correction level 'H', so scanning is
 * unaffected. No-ops for an empty slug.
 */
export function drawSlugLabel(ctx: CanvasRenderingContext2D, slug: string, qrSize: number): void {
  if (!slug) return;
  const { fontPx, rightPad, bottomPad, boxPadX, boxPadY, radius } = qrSlugLabelLayout(qrSize);
  ctx.save();
  ctx.font = `600 ${fontPx}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const textW = ctx.measureText(slug).width;
  const boxRight = qrSize - rightPad;
  const boxBottom = qrSize - bottomPad;
  const boxW = textW + boxPadX * 2;
  const boxH = fontPx + boxPadY * 2;
  const boxLeft = boxRight - boxW;
  const boxTop = boxBottom - boxH;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(boxLeft, boxTop, boxW, boxH, radius);
    ctx.fill();
  } else {
    ctx.fillRect(boxLeft, boxTop, boxW, boxH);
  }
  ctx.fillStyle = '#334155';
  ctx.fillText(slug, boxRight - boxPadX, (boxTop + boxBottom) / 2);
  ctx.restore();
}

export function ShortLinkQrDialog({ open, onClose, shortUrl, slug }: ShortLinkQrDialogProps): React.JSX.Element {
  const { t } = useLocalization();
  const { showToast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Incremented on every draw request so a slow logo load from a previous
  // render can't paint over a newer QR code.
  const drawTokenRef = useRef(0);

  const drawQrCode = useCallback((canvas: HTMLCanvasElement, url: string, code: string) => {
    const token = ++drawTokenRef.current;
    QRCode.toCanvas(canvas, url, {
      errorCorrectionLevel: 'H',
      width: 1024,
      margin: 2,
      // emerald-700 to match the app theme; dark enough on white to keep the
      // ~5:1 contrast QR scanners want.
      color: { dark: '#047857', light: '#ffffff' },
    })
      .then(() => {
        if (token !== drawTokenRef.current) return;
        // qrcode sets inline width/height (1024px) on the element, which would
        // override the Tailwind display size. Clear it so `w-64 h-64` governs
        // display while the 1024px backing store is kept for a crisp download.
        canvas.style.width = '';
        canvas.style.height = '';
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        drawSlugLabel(ctx, code, 1024);
        const img = new window.Image();
        img.onload = () => {
          if (token !== drawTokenRef.current) return;
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
  }, []);

  // Draw from a callback ref rather than an effect: the canvas lives inside
  // Radix's portaled DialogContent, which mounts a commit *after* the parent's
  // `open` prop flips true. An effect keyed on `open` runs before that mount, so
  // `canvasRef.current` is still null and the QR never renders. A callback ref
  // fires exactly when the canvas node attaches, so we always have a canvas.
  const setCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    if (shouldDrawQr(node, open, shortUrl)) {
      drawQrCode(node as HTMLCanvasElement, shortUrl, slug);
    }
  }, [open, shortUrl, slug, drawQrCode]);

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
          <canvas ref={setCanvasRef} className="w-64 h-64 max-w-full" aria-label={t('QR Code')} />
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
