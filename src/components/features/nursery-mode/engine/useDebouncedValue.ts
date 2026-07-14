'use client';

import { useEffect, useState } from 'react';

/**
 * Returns `value`, delayed by `delayMs` of silence. The initial value passes
 * through immediately (no delay on mount); subsequent changes only commit
 * once `value` has stopped changing for `delayMs`. Used to keep expensive
 * engine work (recolor/outline-trace) from firing on every slider input
 * event while a caretaker drags a color/hue control.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (value === debounced) return;
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delayMs]);

  return debounced;
}
