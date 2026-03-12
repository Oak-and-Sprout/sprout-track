'use client';

import { useState } from 'react';
import { NurseryColors } from '@/src/hooks/useNurseryColors';

interface SubButtonProps {
  label: string;
  onClick: () => void;
  colors: NurseryColors;
  active?: boolean;
  timerText?: string | null;
  disabled?: boolean;
  expanded?: boolean;
}

export function SubButton({ label, onClick, colors, active, timerText, disabled, expanded }: SubButtonProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      disabled={disabled}
      className="flex-1 cursor-pointer font-sans font-medium outline-none flex flex-col items-center min-w-0"
      style={{
        padding: expanded
          ? (timerText ? '0.9rem 0.8rem' : '1.1rem 0.8rem')
          : (timerText ? '0.45rem 0.4rem' : '0.55rem 0.4rem'),
        border: `1px solid ${active ? colors.accent : colors.border}`,
        borderRadius: expanded ? '0.75rem' : '0.55rem',
        background: pressed ? colors.btnActive : active ? colors.btnHover : colors.btnBg,
        color: active ? colors.accent : colors.text,
        transform: pressed ? 'scale(0.96)' : 'scale(1)',
        opacity: disabled ? 0.5 : 1,
        fontSize: expanded ? 'clamp(0.9rem, 1.8vw, 1.1rem)' : 'clamp(0.65rem, 1.3vw, 0.78rem)',
        gap: expanded ? '0.35rem' : '0.125rem',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <span>{label}</span>
      {timerText && (
        <span
          className="font-normal italic font-serif"
          style={{
            color: colors.accent,
            letterSpacing: '0.02em',
            fontSize: expanded ? 'clamp(1rem, 2vw, 1.2rem)' : 'clamp(0.7rem, 1.4vw, 0.85rem)',
          }}
        >
          {timerText}
        </span>
      )}
    </button>
  );
}
