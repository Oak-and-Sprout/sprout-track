'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Returns true when viewport width is <= 600px.
 * Matches the breakpoint used in app/family-manager/layout.tsx.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  const checkWidth = useCallback(() => {
    setIsMobile(window.innerWidth <= 600);
  }, []);

  useEffect(() => {
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, [checkWidth]);

  return isMobile;
}
