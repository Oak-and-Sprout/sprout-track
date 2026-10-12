'use client';

import { useEffect, useState } from 'react';
import { useLocalization } from '@/src/context/localization';
import { formatDurationLabel } from '@/src/utils/latestStatus';
import { feedTimer, splitDuration, wakeTimer } from '@/src/utils/nursery/timerBlocks';
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
        <Badge icon={icon} shape={iconShape} ifg={iconColor} size={30} pad={17} />
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

/** Awake/asleep and time-since-last-feed blocks for Nursery Mode (issue #219). */
export function TimerBlocks({ status, baby, feeding, showWake, showFeed, iconColor, iconShape }: TimerBlocksProps) {
  const { t } = useLocalization();
  const now = useNow();
  if (!status || (!showWake && !showFeed)) return null;

  const wake = wakeTimer(status, now);
  const feed = feedTimer(status, baby, now, feeding);
  const shared = { iconColor, iconShape };

  const wakeLabel = wake.kind === 'sleeping' ? t('Sleeping') : wake.kind === 'awake' ? t('Awake') : t('Awake Time');
  const feedLabel = t('Since last feed');

  return (
    <div className={styles.row}>
      {showWake && (wake.kind === 'none' ? (
        <TimerBlock {...shared} icon="sun" label={wakeLabel} tone="empty" minutes={null}
          note={t('No recent sleep')} ariaLabel={`${wakeLabel}, ${t('No recent sleep')}`} />
      ) : (
        <TimerBlock {...shared} icon={wake.kind === 'sleeping' ? 'moon' : 'sun'} label={wakeLabel}
          tone={wake.kind === 'sleeping' ? 'sleeping' : 'normal'} minutes={wake.minutes}
          ariaLabel={`${wakeLabel}, ${formatDurationLabel(wake.minutes, t)}`} />
      ))}
      {showFeed && (feed.kind === 'since' ? (
        <TimerBlock {...shared} icon="bottle" label={feedLabel} tone={feed.warning ? 'warning' : 'normal'}
          minutes={feed.minutes} badge={feed.warning ? t('Overdue') : undefined}
          ariaLabel={[feedLabel, formatDurationLabel(feed.minutes, t), feed.warning ? t('Overdue') : ''].filter(Boolean).join(', ')} />
      ) : feed.kind === 'feeding' ? (
        <TimerBlock {...shared} icon="bottle" label={feedLabel} tone="normal" minutes={null}
          text={t('Feeding')} ariaLabel={t('Feeding')} />
      ) : (
        <TimerBlock {...shared} icon="bottle" label={feedLabel} tone="empty" minutes={null}
          note={t('No recent feed')} ariaLabel={`${feedLabel}, ${t('No recent feed')}`} />
      ))}
    </div>
  );
}
