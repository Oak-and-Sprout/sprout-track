'use client';

import React from 'react';
import { useLocalization } from '@/src/context/localization';
import { DAY_STORY_ROWS } from './landing-data';

/** "One Tuesday, tracked together" — the day timeline from the mockup. */
export function DayStory() {
  const { t } = useLocalization();

  return (
    <div className="ld-day">
      {DAY_STORY_ROWS.map((row) => (
        <div className="ld-day-row" key={row.title}>
          <img className="ld-day-ic" src={row.icon} alt="" width={40} height={40} />
          <span className="ld-t">
            <b>{t(row.title)}</b>
            <span className={`ld-who ${row.whoClass}`}>{t(row.who)}</span>
            <p>{t(row.note)}</p>
          </span>
          <time>{t(row.time)}</time>
        </div>
      ))}
    </div>
  );
}
