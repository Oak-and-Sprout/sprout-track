'use client';

import React, { useCallback, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { createPortal } from 'react-dom';
import { ArrowLeft, X } from 'lucide-react';
import { literata, alegreyaSans } from '@/src/components/landing/fonts';
import { useLocalization } from '@/src/context/localization';
import { StorybookDrawerProps } from './storybook-drawer.types';
import './storybook-drawer.css';

const ART_META = {
  butterfly: { src: '/landing/butterfly.svg', width: 42, rotate: 'rotate(9deg)' },
  star: { src: '/landing/star.svg', width: 38, rotate: 'rotate(12deg)' },
} as const;

/**
 * Right slide-over drawer in the v1-storybook skin. Radix Dialog underneath:
 * portal, focus trap, Esc-to-close, click-outside via the overlay.
 * Stack sub-forms by rendering a second StorybookDrawer while this one is open.
 */
export function StorybookDrawer({
  open,
  onClose,
  title,
  subtitle,
  onBack,
  art,
  headerExtras,
  footer,
  children,
  className,
}: StorybookDrawerProps) {
  const { t } = useLocalization();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="sb-overlay" />
        <DialogPrimitive.Content
          className={`${literata.variable} ${alegreyaSans.variable} sb-pane${className ? ` ${className}` : ''}`}
          aria-describedby={undefined}
        >
          {art && (
            <img
              className="sb-pane-art"
              src={ART_META[art].src}
              alt=""
              width={ART_META[art].width}
              style={{ transform: ART_META[art].rotate }}
              aria-hidden="true"
            />
          )}
          <header className="sb-pane-hd">
            {onBack && (
              <button type="button" className="sb-backbtn" onClick={onBack} aria-label={t('Back')}>
                <ArrowLeft size={19} strokeWidth={1.8} />
              </button>
            )}
            <div className="sb-tt">
              <DialogPrimitive.Title asChild>
                <h2 className="sb-title">{title}</h2>
              </DialogPrimitive.Title>
              {subtitle ? <p className="sb-subtitle">{subtitle}</p> : null}
            </div>
            <DialogPrimitive.Close asChild>
              <button type="button" className="sb-xbtn" aria-label={t('Close')}>
                <X size={18} strokeWidth={1.8} />
              </button>
            </DialogPrimitive.Close>
          </header>
          {headerExtras}
          <div className="sb-pane-bd">{children}</div>
          {footer ? <div className="sb-pane-ft">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * Storybook confirmation toast (ink pill, bottom-center, ~3.4s).
 * Usage: const { showSbToast, sbToast } = useSbToast(); render {sbToast}.
 */
export function useSbToast(): {
  showSbToast: (message: string) => void;
  sbToast: React.ReactNode;
} {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSbToast = useCallback((msg: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(msg);
    timer.current = setTimeout(() => setMessage(null), 3400);
  }, []);

  const sbToast =
    message && typeof document !== 'undefined'
      ? createPortal(
          <div
            className={`${literata.variable} ${alegreyaSans.variable} sb-toast`}
            role="status"
          >
            {message}
          </div>,
          document.body
        )
      : null;

  return { showSbToast, sbToast };
}
