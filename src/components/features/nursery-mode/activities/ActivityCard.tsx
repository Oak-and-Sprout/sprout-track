'use client';

import { ReactElement } from 'react';
import { Badge } from './Badge';
import { ActivityView, TileLog } from './types';

export interface ActivityCardProps {
  view: ActivityView;
  log: TileLog | null;
  iconColor: string;
  iconShape: 'circle' | 'square';
}

/**
 * Cards layout tile — `.nursery-card` per prototype (nursery.jsx:477-485).
 * Header badge + label, serif meta (time/detail) or active status line, action buttons.
 */
export function ActivityCard({ view, log, iconColor, iconShape }: ActivityCardProps): ReactElement {
  const { buttons, statusText } = view;

  return (
    <div className="nursery-card">
      <div className="nursery-card-h">
        <div className="lhs">
          <Badge icon={view.icon} shape={iconShape} ifg={iconColor} size={54} pad={26} />
          <h3>{view.label}</h3>
        </div>
        <div className="nursery-card-meta">
          {statusText ? (
            <div
              className="nursery-serif t"
              style={{ whiteSpace: 'normal', fontStyle: 'italic' }}
            >
              {statusText}
            </div>
          ) : log ? (
            <>
              <div className="t">{log.last}</div>
              <div className="d">{log.note}</div>
            </>
          ) : null}
        </div>
      </div>
      <div className="nursery-card-actions">
        {buttons.map(btn => {
          const wide = btn.wide || buttons.length === 1;
          return (
            <button
              key={btn.key}
              type="button"
              onClick={btn.onClick}
              disabled={btn.disabled}
              className={`nursery-abtn${wide ? ' wide' : ''}`}
              style={btn.disabled ? { opacity: 0.5 } : undefined}
            >
              {btn.label}
              {btn.timerText ? (
                <span className="nursery-serif" style={{ fontStyle: 'italic', marginLeft: 6, opacity: 0.9 }}>
                  {btn.timerText}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
