'use client';

import { useState, useCallback } from 'react';
import { NurseryColors } from '@/src/hooks/useNurseryColors';
import { TileShell, TileLog } from './TileShell';
import { SubButton } from './SubButton';
import { useLocalization } from '@/src/context/localization';

interface DiaperTileProps {
  colors: NurseryColors;
  log: TileLog | null;
  onLog: (tileId: string, note: string) => void;
  animating: boolean;
  babyId: string;
  toUTCString: (date: Date | null | undefined) => string | null;
}

export function DiaperTile({ colors, log, onLog, animating, babyId, toUTCString }: DiaperTileProps) {
  const { t } = useLocalization();
  const [submitting, setSubmitting] = useState(false);

  const submitDiaper = useCallback(async (type: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const now = toUTCString(new Date());
      const res = await fetch('/api/diaper-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authToken ? `Bearer ${authToken}` : '',
        },
        body: JSON.stringify({ babyId, time: now, type }),
      });
      const data = await res.json();
      if (data.success) {
        const labels: Record<string, string> = { WET: t('Wet'), DIRTY: t('Dirty'), BOTH: t('Both') };
        onLog('diaper', labels[type] || type);
      }
    } catch (err) {
      console.error('Error logging diaper:', err);
    } finally {
      setSubmitting(false);
    }
  }, [babyId, toUTCString, onLog, submitting, t]);

  return (
    <TileShell label={t('Diaper')} colors={colors} log={log} animating={animating}>
      <div className="flex gap-1.5 mt-auto pt-2">
        <SubButton label={t('Wet')} onClick={() => submitDiaper('WET')} colors={colors} disabled={submitting} />
        <SubButton label={t('Dirty')} onClick={() => submitDiaper('DIRTY')} colors={colors} disabled={submitting} />
        <SubButton label={t('Both')} onClick={() => submitDiaper('BOTH')} colors={colors} disabled={submitting} />
      </div>
    </TileShell>
  );
}
