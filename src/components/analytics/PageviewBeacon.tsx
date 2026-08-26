'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useDeployment } from '@/app/context/deployment';
import { beaconBody } from './beacon-body';

/**
 * Fires an anonymous first-party pageview beacon on route change.
 * No-ops entirely outside SaaS mode (and while deployment config is loading),
 * so self-hosted and normal-browser behavior is unchanged.
 */
export default function PageviewBeacon() {
  const { isSaasMode, isLoading } = useDeployment();
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading || !isSaasMode) return;
    if (typeof window === 'undefined') return;
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;

    const url = '/api/analytics/collect';
    const body = beaconBody(pathname, document.referrer, window.location.search);
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      } else {
        void fetch(url, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body });
      }
    } catch {
      /* analytics must never break navigation */
    }
  }, [isSaasMode, isLoading, pathname]);

  return null;
}
