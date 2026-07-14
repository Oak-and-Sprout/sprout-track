'use client';

import { ReactElement, useState } from 'react';
import { useLocalization } from '@/src/context/localization';
import { Badge } from './Badge';
import { ActivityView, TileLog } from './types';

export interface BigTileProps {
  view: ActivityView;
  log: TileLog | null;
  iconColor: string;
  iconShape: 'circle' | 'square';
}

/**
 * Big Tiles layout tile — `.nursery-tile` per prototype (nursery.jsx:469-473).
 * Tap opens a centered glass overlay listing the activity's action buttons.
 */
export function BigTile({ view, log, iconColor, iconShape }: BigTileProps): ReactElement {
  const { t } = useLocalization();
  const [open, setOpen] = useState(false);
  const { buttons, statusText, active } = view;

  const metaLine = active && statusText ? statusText : log ? log.last : '';

  return (
    <>
      <button
        type="button"
        className={`nursery-tile ${iconShape}`}
        onClick={() => setOpen(true)}
      >
        <span className="tico">
          <Badge icon={view.icon} shape={iconShape} ifg={iconColor} size={82} pad={36} />
        </span>
        <span className="tlabel">{view.label}</span>
        {metaLine ? <span className="tmeta">{metaLine}</span> : null}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label={t('Close')}
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 200,
              background: 'rgba(0,0,0,.35)',
              border: 'none',
              cursor: 'default',
            }}
          />
          <div
            role="dialog"
            aria-label={view.label}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 201,
              width: 'min(360px, 90vw)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              padding: 20,
              borderRadius: 20,
              background: 'rgba(20,22,31,.92)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,.12)',
              boxShadow: '0 8px 40px rgba(0,0,0,.4)',
            }}
          >
            {buttons.map(btn => (
              <button
                key={btn.key}
                type="button"
                disabled={btn.disabled}
                onClick={() => {
                  btn.onClick();
                  setOpen(false);
                }}
                className="nursery-abtn wide"
                style={{ minHeight: 44, opacity: btn.disabled ? 0.5 : 1 }}
              >
                {btn.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="nursery-ghost"
              style={{ minHeight: 44, marginTop: 2 }}
            >
              {t('Close')}
            </button>
          </div>
        </>
      )}
    </>
  );
}
