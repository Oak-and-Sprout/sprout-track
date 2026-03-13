'use client';

import { ReactNode } from 'react';
import { NurseryColors } from '@/src/hooks/useNurseryColors';

interface TileLog {
  last: string;
  note: string;
}

interface TileShellProps {
  label: string;
  colors: NurseryColors;
  log?: TileLog | null;
  animating?: boolean;
  sleeping?: boolean;
  expanded?: boolean;
  statusText?: string | null;
  children: ReactNode;
}

export function TileShell({ label, colors, log, animating, sleeping, expanded, statusText, children }: TileShellProps) {
  const hasGlow = sleeping || expanded;

  return (
    <div
      className="rounded-2xl flex flex-col liquid-glass-tile relative overflow-hidden"
      style={{
        background: colors.tileBg,
        border: `1px solid ${hasGlow ? colors.accent : colors.border}`,
        padding: expanded ? 'clamp(1.2rem, 3.5vw, 2rem)' : 'clamp(0.85rem, 2.5vw, 1.4rem)',
        boxShadow: [
          hasGlow ? `0 0 25px ${colors.sleepGlow}` : '',
          `inset 1px 1px 0 0 ${colors.glassHighlight}`,
          `inset -1px -1px 0 0 ${colors.glassShadow}`,
        ].filter(Boolean).join(', '),
        minHeight: expanded ? 'clamp(200px, 40vw, 320px)' : 'clamp(130px, 24vw, 195px)',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Fog/smoke overlay */}
      <div
        className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{ background: colors.smokeBg }}
      />

      {animating && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${colors.sleepGlow}, transparent 70%)`,
            animation: 'nursery-tileFlash 0.6s ease-out',
          }}
        />
      )}

      <div className="flex justify-between items-start">
        <div>
          <div
            className="font-medium tracking-tight font-sans"
            style={{
              color: colors.text,
              fontSize: expanded ? 'clamp(1.2rem, 2.8vw, 1.6rem)' : 'clamp(1rem, 2.2vw, 1.35rem)',
              transition: 'font-size 0.4s ease',
            }}
          >
            {label}
          </div>
          {statusText && (
            <div
              className="font-normal italic mt-0.5 font-serif"
              style={{
                color: colors.accent,
                animation: 'nursery-gentlePulse 3s ease-in-out infinite',
                fontSize: expanded ? 'clamp(0.8rem, 1.6vw, 0.95rem)' : 'clamp(0.65rem, 1.3vw, 0.78rem)',
                transition: 'font-size 0.4s ease',
              }}
            >
              {statusText}
            </div>
          )}
        </div>

        {log && !statusText && (
          <div className="text-right flex-shrink-0">
            <div
              className="text-[clamp(0.72rem,1.5vw,0.88rem)] font-normal italic font-serif"
              style={{ color: colors.logText }}
            >
              {log.last}
            </div>
            <div
              className="text-[clamp(0.55rem,1.1vw,0.65rem)] font-normal mt-px font-sans"
              style={{ color: colors.subtext }}
            >
              {log.note}
            </div>
          </div>
        )}
      </div>

      {children}
    </div>
  );
}

export type { TileLog };
