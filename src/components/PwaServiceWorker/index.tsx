'use client';

import { useEffect } from 'react';
import { registerPwaServiceWorker } from '@/src/lib/notifications/client';

export function PwaServiceWorker() {
  useEffect(() => {
    registerPwaServiceWorker();
  }, []);

  return null;
}
