'use client';

import { useEffect, useState } from 'react';
import { useLocalization } from '@/src/context/localization';
import { formatDurationLabel } from '@/src/utils/latestStatus';
import { diaperTimer, feedTimer, SinceTimer, splitDuration, wakeTimer } from '@/src/utils/nursery/timerBlocks';
import type { IconName } from '../icons';
import { Badge } from '../activities/Badge';
import { timerBlockVariants, timerBlocksStyles as styles } from './timer-blocks.styles';
import { TimerBlockProps, TimerBlocksProps } from './timer-blocks.types';
import './timer-blocks.css';

/** Re-render often enough that a minute-resolution display never lags by much. */
const TICK_MS = 15000;

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, TICK_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return now;
}

/**
 * One glanceable timer card. role="timer" carries an implicit aria-live="off",
 * so the per-minute tick is never announced; the aria-label holds the full
 * reading for anyone who navigates to it.
 */
export function TimerBlock({ icon, label, tone, minutes, text, note, badge, ariaLabel, iconColor, iconShape }: TimerBlockProps) {
  const { t } = useLocalization();
  const { hours, minutes: mins } = splitDuration(minutes ?? 0);
  return (
    <div role="timer" aria-label={ariaLabel} className={timerBlockVariants({ tone })}>
      <div className={styles.head} aria-hidden="true">
        <Badge icon={icon} shape={iconShape} ifg={iconColor} size={24} pad={14} />
        <span className="truncate">{label}</span>
      </div>
      <div className={styles.value} aria-hidden="true">
        {minutes === null ? <span className={styles.text}>{text ?? '—'}</span> : (
          <>
            {hours > 0 && <>{hours}<span className={styles.unit}>{t('hr')}</span></>}
            {mins}<span className={styles.unit}>{t('min')}</span>
          </>
        )}
      </div>
      {badge && <span className={styles.badge} aria-hidden="true">{badge}</span>}
      {note && <div className={styles.note} aria-hidden="true">{note}</div>}
    </div>
  );
}

/** Awake/asleep, time-since-last-feed and time-since-last-diaper blocks for Nursery Mode (issue #219). */
export function TimerBlocks({ status, baby, feeding, showWake, showFeed, showDiaper, iconColor, iconShape }: TimerBlocksProps) {
  const { t } = useLocalization();
  const now = useNow();
  if (!status || (!showWake && !showFeed && !showDiaper)) return null;

  const wake = wakeTimer(status, now);
  const feed = feedTimer(status, baby, now, feeding);
  const shared = { iconColor, iconShape };

  // Short visible labels keep three blocks on one phone row; the aria-label carries the full text.
  const wakeLabel = wake.kind === 'sleeping' ? t('Sleeping') : t('Awake');
  const wakeAria = wake.kind === 'none' ? t('Awake Time') : wakeLabel;

  /** A "time since" block (feed or diaper): duration with the Overdue warning, or the empty state. */
  const since = (timer: SinceTimer, icon: IconName, label: string, fullLabel: string, emptyNote: string) =>
    timer.kind === 'since' ? (
      <TimerBlock {...shared} icon={icon} label={label} tone={timer.warning ? 'warning' : 'normal'}
        minutes={timer.minutes} badge={timer.warning ? t('Overdue') : undefined}
        ariaLabel={[fullLabel, formatDurationLabel(timer.minutes, t), timer.warning ? t('Overdue') : ''].filter(Boolean).join(', ')} />
    ) : (
      <TimerBlock {...shared} icon={icon} label={label} tone="empty" minutes={null}
        note={emptyNote} ariaLabel={`${fullLabel}, ${emptyNote}`} />
    );

  return (
    <div className={styles.row}>
      {showWake && (wake.kind === 'none' ? (
        <TimerBlock {...shared} icon="sun" label={wakeLabel} tone="empty" minutes={null}
          note={t('No recent sleep')} ariaLabel={`${wakeAria}, ${t('No recent sleep')}`} />
      ) : (
        <TimerBlock {...shared} icon={wake.kind === 'sleeping' ? 'moon' : 'sun'} label={wakeLabel}
          tone={wake.kind === 'sleeping' ? 'sleeping' : 'normal'} minutes={wake.minutes}
          ariaLabel={`${wakeAria}, ${formatDurationLabel(wake.minutes, t)}`} />
      ))}
      {showFeed && (feed.kind === 'feeding' ? (
        <TimerBlock {...shared} icon="bottle" label={t('Feed')} tone="normal" minutes={null}
          text={t('Feeding')} ariaLabel={t('Feeding')} />
      ) : since(feed, 'bottle', t('Feed'), t('Since last feed'), t('No recent feed')))}
      {showDiaper && since(diaperTimer(status, baby, now), 'diaper', t('Diaper'), t('Since last diaper'), t('No recent diaper'))}
    </div>
  );
}
