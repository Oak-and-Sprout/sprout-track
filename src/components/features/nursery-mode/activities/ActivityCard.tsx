'use client';

import { ReactElement, CSSProperties, useEffect, useRef } from 'react';
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
  const { buttons, statusText, active, question, amountPrompt, searchPrompt, buttonsWrap } = view;
  const prefersReducedMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);

  // Opening a decision screen from a scrolled-down grid would otherwise keep the old
  // scroll offset, starting the expanded card with its header out of view above.
  useEffect(() => {
    if (question) {
      cardRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }, [question, prefersReducedMotion]);

  // With a search field, its row hosts the cancel action so backing out never
  // requires scrolling to the bottom of a long picker list.
  const headerButtons = searchPrompt ? buttons.filter(b => b.cancel) : [];
  const listButtons = searchPrompt ? buttons.filter(b => !b.cancel) : buttons;

  return (
    <motion.div
      ref={cardRef}
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
      {searchPrompt && (
        <div className="nursery-search-row">
          <input
            type="search"
            className="nursery-search-input"
            value={searchPrompt.value}
            onChange={e => searchPrompt.onChange(e.target.value)}
            placeholder={searchPrompt.placeholder}
            aria-label={searchPrompt.placeholder}
          />
          {headerButtons.map(btn => (
            <button
              key={btn.key}
              type="button"
              onClick={btn.onClick}
              disabled={btn.disabled}
              className="nursery-abtn"
              style={{ flex: '0 0 auto', opacity: btn.disabled ? 0.5 : undefined }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}
      <div className={`nursery-card-actions${buttonsWrap ? ' wrap' : ''}`}>
        {listButtons.map(btn => {
          const wide = btn.wide || listButtons.length === 1;
          return (
            <button
              key={btn.key}
              type="button"
              onClick={btn.onClick}
              disabled={btn.disabled}
              aria-label={btn.ariaLabel}
              title={btn.iconSrc ? btn.ariaLabel ?? btn.label : undefined}
              className={`nursery-abtn${wide ? ' wide' : ''}`}
              style={btn.disabled ? { opacity: 0.5 } : undefined}
            >
              {btn.iconSrc ? <img src={btn.iconSrc} alt="" aria-hidden="true" className="nursery-btn-emoji" /> : btn.label}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
