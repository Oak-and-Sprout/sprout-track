'use client';

import { useEffect } from 'react';
import { useFamily } from '@/src/context/family';
import { usePathname } from 'next/navigation';
import { useLocalization } from '@/src/context/localization';

interface DynamicTitleProps {
  baseTitle?: string;
}

/**
 * Component that dynamically updates the document title based on family context
 * Only updates the title when inside the family app routes (app/(app)/[slug]/)
 */
export function DynamicTitle({ baseTitle = 'Sprout Track' }: DynamicTitleProps) {
  const { family } = useFamily();
  const pathname = usePathname();
  const { t } = useLocalization();

  useEffect(() => {
    // Check if we're in a family app route pattern: /[slug]/...
    // Exclude only /home route, but include /demo as it's a valid family
    const isInFamilyApp = pathname && /^\/[^\/]+\/?/.test(pathname) && !pathname.startsWith('/home');

    const pageName = pathname?.includes('/log-entry')
      ? t('Log Entry')
      : pathname?.includes('/calendar')
      ? t('Calendar')
      : pathname?.includes('/reports')
      ? t('Reports')
      : pathname?.includes('/full-log')
      ? t('Full Log')
      : null;

    // Use setTimeout to ensure this runs after any other title updates
    const updateTitle = () => {
      if (isInFamilyApp && family?.name) {
        // Update title to include family name and current page
        document.title = pageName
          ? `${baseTitle} - ${family.name} - ${pageName}`
          : `${baseTitle} - ${family.name}`;
      } else {
        // Reset to base title
        document.title = baseTitle;
      }
    };

    // Run immediately
    updateTitle();

    // Also run after a small delay to override any competing title updates
    const timeoutId = setTimeout(updateTitle, 100);

    return () => clearTimeout(timeoutId);
  }, [family?.name, pathname, baseTitle, t]);

  // This component doesn't render anything
  return null;
}