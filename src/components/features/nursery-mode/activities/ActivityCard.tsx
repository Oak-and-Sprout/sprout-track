'use client';

import { ReactElement, CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Badge } from './Badge';
import { ActivityView, TileLog } from './types';

export interface ActivityCardProps {
  view: ActivityView;
  log: TileLog | null;
  iconColor: string;
  iconShape: 'circle' | 'square';
  /** Another card in the grid is asking a question — fade this one out and disable it. */
  dimmed?: boolean;
}

/**
 * Cards layout tile — `.nursery-card` per prototype (nursery.jsx:477-485).
 * Header badge + label, serif meta (time/detail) or active status line, action buttons.
 * While `view.question` is true (e.g. pump's amount/action step, sleep's location
 * picker), the card grows to fill the whole grid via a framer-motion layout
 * animation, and sibling cards are passed `dimmed` to fade out.
 */
export function ActivityCard({ view, log, iconColor, iconShape, dimmed = false }: ActivityCardProps): ReactElement {
  const { buttons, statusText, active, question, amountPrompt, buttonsWrap } = view;
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      layout={!prefersReducedMotion}
      animate={{ opacity: dimmed ? 0 : 1 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={`nursery-card${active ? ' active' : ''}${question ? ' question' : ''}`}
      style={{ '--active-glow': iconColor, pointerEvents: dimmed ? 'none' : undefined } as CSSProperties}
    >
      <div className="nursery-card-h">
        <div className="lhs">
          <Badge icon={view.icon} shape={iconShape} ifg={iconColor} size={54} pad={26} />
          <h3>{view.label}</h3>
        </div>
        <div className="nursery-card-meta">
          {statusText ? (
            <div className="status">{statusText}</div>
          ) : log ? (
            <>
              <div className="t">{log.last}</div>
              <div className="d">{log.note}</div>
            </>
          ) : null}
        </div>
      </div>
      {amountPrompt && (
        <div className="nursery-amount-row">
          {amountPrompt.fields.map(f => (
            <label key={f.key} className="nursery-amount-field">
              <span className="al">{f.label}</span>
              <span className="ai">
                <input type="number" inputMode="decimal" min={0} value={f.value} onChange={e => f.onChange(e.target.value)} />
                <span className="au">{f.unit}</span>
              </span>
            </label>
          ))}
        </div>
      )}
      <div className={`nursery-card-actions${buttonsWrap ? ' wrap' : ''}`}>
        {buttons.map(btn => {
          const wide = btn.wide || buttons.length === 1;
          return (
            <button
              key={btn.key}
              type="button"
              onClick={btn.onClick}
              disabled={btn.disabled}
              aria-label={btn.ariaLabel}
              className={`nursery-abtn${wide ? ' wide' : ''}`}
              style={btn.disabled ? { opacity: 0.5 } : undefined}
            >
              {btn.label}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
