'use client';

import { useEffect, useState } from 'react';
import { useTimezone } from '@/app/context/timezone';
import { formatTimeDisplay } from '@/src/utils/dateFormat';
import { useLocalization } from '@/src/context/localization';

export interface ClockBlockBaby {
  id: string;
  firstName: string;
}

export interface ClockBlockProps {
  babyName: string;
  babies: ClockBlockBaby[];
  selectedBabyId?: string | null;
  onSelectBaby: (id: string) => void;
  /** Compact inline variant for landscape layouts: time + name + date on one line. */
  compact?: boolean;
}

/**
 * Serif clock + tappable baby name (with switcher dropdown) + uppercase date,
 * matching the `.nursery-clockwrap`/`.nursery-clock`/`.nursery-date` markup
 * from the nursery mode prototype.
 */
export function ClockBlock({ babyName, babies, selectedBabyId, onSelectBaby, compact }: ClockBlockProps) {
  const [now, setNow] = useState(new Date());
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const { timeFormat } = useTimezone();
  const { t, language } = useLocalization();

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = formatTimeDisplay(now, timeFormat);
  const date = now.toLocaleDateString(language || 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const canSwitch = babies.length > 1;

  const nameButton = (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => canSwitch && setSwitcherOpen(o => !o)}
        className="nursery-serif name"
        aria-label={t('Switch Baby')}
        aria-haspopup={canSwitch ? 'listbox' : undefined}
        aria-expanded={canSwitch ? switcherOpen : undefined}
        style={{
          background: 'none',
          border: 'none',
          color: 'inherit',
          padding: 0,
          minWidth: 44,
          minHeight: 44,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: canSwitch ? 'pointer' : 'default',
        }}
      >
        {babyName}
      </button>
      {switcherOpen && canSwitch && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[100] bg-transparent border-none p-0 cursor-default"
            onClick={() => setSwitcherOpen(false)}
            aria-label={t('Close')}
          />
          <div
            className="absolute left-1/2 top-full z-[101] mt-2 overflow-hidden rounded-lg"
            style={{
              transform: 'translateX(-50%)',
              background: 'rgba(20,22,31,.92)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,.12)',
              minWidth: 160,
            }}
            role="listbox"
          >
            {babies.map(baby => (
              <button
                key={baby.id}
                type="button"
                role="option"
                aria-selected={selectedBabyId === baby.id}
                onClick={() => {
                  onSelectBaby(baby.id);
                  setSwitcherOpen(false);
                }}
                className="nursery-serif block w-full cursor-pointer border-none bg-transparent px-4 py-2.5 text-left text-sm transition-colors duration-100"
                style={{
                  minHeight: 44,
                  color: '#fff',
                  opacity: selectedBabyId === baby.id ? 1 : 0.6,
                  background: selectedBabyId === baby.id ? 'rgba(255,255,255,.1)' : 'transparent',
                }}
              >
                {baby.firstName}
              </button>
            ))}
          </div>
        </>
      )}
    </span>
  );

  if (compact) {
    return (
      <div className="flex select-none items-baseline justify-center gap-2">
        <span
          className="nursery-serif"
          style={{
            fontWeight: 400,
            fontSize: 'clamp(1.1rem,2.5vw,1.4rem)',
            lineHeight: 1.1,
            letterSpacing: '-.01em',
            textShadow: '0 2px 20px rgba(0,0,0,.25)',
          }}
        >
          {time}
        </span>
        <span style={{ fontStyle: 'italic', fontSize: 'clamp(0.85rem,1.8vw,1.05rem)', opacity: .9 }}>
          {nameButton}
        </span>
        <span
          style={{
            fontSize: 'clamp(0.55rem,1.2vw,0.7rem)',
            fontWeight: 600,
            letterSpacing: '.24em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,.62)',
          }}
        >
          {date}
        </span>
      </div>
    );
  }

  return (
    <div className="nursery-clockwrap">
      <div className="nursery-clock">
        <span className="nursery-serif time">{time}</span>
        {nameButton}
      </div>
      <div className="nursery-date">{date}</div>
    </div>
  );
}
