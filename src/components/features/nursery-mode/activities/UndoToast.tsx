'use client';

import { ReactElement, useEffect } from 'react';
import { useLocalization } from '@/src/context/localization';
import { UndoInfo } from './types';

export interface UndoToastProps {
  undo: UndoInfo | null;
  onUndo: () => void;
  onDismiss: () => void;
}

/**
 * Fixed bottom-center glass pill: "message · Undo".
 * Auto-dismisses 6s after each new toast (timer reset on undo change / unmount).
 */
export function UndoToast({ undo, onUndo, onDismiss }: UndoToastProps): ReactElement | null {
  const { t } = useLocalization();

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [undo, onDismiss]);

  if (!undo) return null;

  return (
    <div
      className="nursery-toast"
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 'clamp(24px, 5vh, 48px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 12px 10px 20px',
        borderRadius: 9999,
        background: 'rgba(20,22,31,.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,.12)',
        boxShadow: '0 8px 40px rgba(0,0,0,.4)',
        color: '#fff',
      }}
    >
      <span style={{ fontSize: 'clamp(13px, 1.2vw, 15px)' }}>{undo.message}</span>
      <button
        type="button"
        onClick={onUndo}
        style={{
          minHeight: 44,
          padding: '0 18px',
          borderRadius: 9999,
          border: '1px solid rgba(255,255,255,.2)',
          background: 'rgba(255,255,255,.12)',
          color: '#fff',
          fontSize: 'clamp(13px, 1.2vw, 15px)',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {t('Undo')}
      </button>
    </div>
  );
}
