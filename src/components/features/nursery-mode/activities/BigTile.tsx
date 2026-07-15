'use client';

import { ReactElement, useState, CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useLocalization } from '@/src/context/localization';
import { Badge } from './Badge';
import { Icon, IconName } from '../icons';
import { ActivityView, TileLog } from './types';

/** Maps useFeedActions'/usePumpActions' quick-action button keys to an icon for the tile-face controls. */
const QUICK_ACTION_ICONS: Record<string, IconName> = {
  switch: 'switch',
  pause: 'pause',
  resume: 'resume',
  stop: 'stop',
  resumeLeft: 'resumeLeft',
  resumeRight: 'resumeRight',
};

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
  const { buttons, statusText, active, amountPrompt, searchPrompt } = view;

  // With a search field, its row hosts the cancel action at the top of the modal
  // so backing out never requires scrolling to the bottom of a long picker list.
  const headerButtons = searchPrompt ? buttons.filter(b => b.cancel) : [];
  const listButtons = searchPrompt ? buttons.filter(b => !b.cancel) : buttons;

  const metaLine = active && statusText ? statusText : log ? log.last : '';
  // Breastfeeding/pumping are long-running sessions — surface their controls directly
  // on the tile face so switching sides, pausing, or stopping doesn't take two taps
  // (open the modal, then tap the button).
  const showQuickActions = (view.id === 'feed' || view.id === 'pump') && active;

  // A lone "advance to the next decision" button (e.g. sleep's "Start Sleep") needs
  // no confirmation tap of its own — fire it immediately so the modal opens straight
  // into the real choice (location, amount, etc.) instead of showing a redundant step.
  const handleTileClick = () => {
    if (buttons.length === 1 && buttons[0].keepOpen) {
      buttons[0].onClick();
    }
    setOpen(true);
  };

  return (
    <>
      <div
        className={`nursery-tile ${iconShape}${active ? ' active' : ''}${showQuickActions ? ' with-qa' : ''}`}
        style={{ '--active-glow': iconColor } as CSSProperties}
      >
        <button type="button" className="tmain" onClick={handleTileClick}>
          <span className="tico">
            <Badge icon={view.icon} shape={iconShape} ifg={iconColor} size={82} pad={36} />
          </span>
          <span className="tlabel">{view.label}</span>
          {metaLine ? <span className="tmeta">{metaLine}</span> : null}
        </button>
        {showQuickActions && (
          <div className="tqa">
            {buttons.map(btn => {
              const iconName = QUICK_ACTION_ICONS[btn.key];
              return (
                <button
                  key={btn.key}
                  type="button"
                  disabled={btn.disabled}
                  onClick={() => {
                    btn.onClick();
                    // keepOpen means this button leads to another decision screen
                    // (e.g. pump's amount/action step) that needs the modal's room.
                    if (btn.keepOpen) setOpen(true);
                  }}
                  aria-label={btn.label}
                  title={btn.label}
                  className={`nursery-tqa-btn${btn.emphasized ? ' emphasized' : ''}`}
                >
                  {iconName ? <Icon n={iconName} s={18} /> : btn.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Portaled to <body>: the activity area's edge-fade mask clips everything its
          subtree paints (even position:fixed), so the modal must escape it to cover
          the full page — including the clock/topbar. */}
      {open && createPortal(
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
              maxHeight: '80vh',
              overflow: 'hidden',
            }}
          >
            {searchPrompt && (
              <div className="nursery-search-row" style={{ marginBottom: 0 }}>
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
                    disabled={btn.disabled}
                    onClick={() => {
                      btn.onClick();
                      setOpen(false);
                    }}
                    className="nursery-abtn"
                    style={{ flex: '0 0 auto', opacity: btn.disabled ? 0.5 : 1 }}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            )}
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
            {view.statusText && !view.active && (
              <div style={{ textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,.75)' }}>{view.statusText}</div>
            )}
            <div className={`nursery-modal-list${searchPrompt ? ' masked' : ''}`}>
              {listButtons.map(btn => (
                <button
                  key={btn.key}
                  type="button"
                  disabled={btn.disabled}
                  onClick={() => {
                    btn.onClick();
                    if (!btn.keepOpen) setOpen(false);
                  }}
                  aria-label={btn.ariaLabel}
                  title={btn.iconSrc ? btn.ariaLabel ?? btn.label : undefined}
                  className="nursery-abtn wide"
                  style={{ minHeight: 44, opacity: btn.disabled ? 0.5 : 1, whiteSpace: 'normal' }}
                >
                  {btn.iconSrc ? <img src={btn.iconSrc} alt="" aria-hidden="true" className="nursery-btn-emoji" /> : btn.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="nursery-ghost"
              style={{ minHeight: 44, marginTop: 2 }}
            >
              {t('Close')}
            </button>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
