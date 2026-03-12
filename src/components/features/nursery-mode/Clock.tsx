'use client';

import { useState, useEffect } from 'react';
import { NurseryColors } from '@/src/hooks/useNurseryColors';

interface ClockProps {
  colors: NurseryColors;
}

export function Clock({ colors }: ClockProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .toLowerCase();

  const date = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="text-center select-none">
      <div
        style={{ color: colors.text, opacity: 0.9 }}
        className="text-[clamp(2.5rem,6vw,4.5rem)] font-light leading-tight tracking-tight font-serif"
      >
        {time}
      </div>
      <div
        style={{ color: colors.text, opacity: 0.5 }}
        className="text-[clamp(0.75rem,1.8vw,1rem)] font-normal tracking-widest uppercase mt-1 font-sans"
      >
        {date}
      </div>
    </div>
  );
}
