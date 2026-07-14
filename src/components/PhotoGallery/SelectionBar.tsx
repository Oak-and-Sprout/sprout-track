'use client';

import React, { useState } from 'react';
import { Download, Trash2, X } from 'lucide-react';
import { useLocalization } from '@/src/context/localization';

interface SelectionBarProps {
  count: number;
  onDownload: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

/**
 * Floating action bar shown while the gallery is in select mode. Delete asks
 * for confirmation inline (two-button confirm state) rather than a browser
 * `window.confirm`, matching the pattern already used for destructive
 * actions elsewhere in the app (e.g. chat attachment delete).
 */
export default function SelectionBar({ count, onDownload, onDelete, onCancel }: SelectionBarProps) {
  const { t } = useLocalization();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (count === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-2xl photo-gallery-selection-bar">
      <span className="font-medium">
        {count} {t('selected')}
      </span>

      {confirmingDelete ? (
        <>
          <span className="text-slate-300">{t('Move to Trash?')}</span>
          <button
            type="button"
            onClick={() => { setConfirmingDelete(false); onDelete(); }}
            className="rounded-lg bg-red-500 px-2.5 py-1 text-xs font-medium hover:bg-red-600"
          >
            {t('Yes')}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(false)}
            className="rounded-lg bg-slate-700 px-2.5 py-1 text-xs font-medium hover:bg-slate-600"
          >
            {t('No')}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {t('Download')}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium hover:bg-slate-800"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t('Delete')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium hover:bg-slate-800"
            aria-label={t('Cancel')}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            {t('Cancel')}
          </button>
        </>
      )}
    </div>
  );
}
