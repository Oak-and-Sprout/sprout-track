'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ThemeProvider } from '@/src/context/theme';
import { useLocalization } from '@/src/context/localization';
import AccountModal from '@/src/components/modals/AccountModal';

/**
 * Path-based landing for password reset links (see app/api/utils/account-emails.ts).
 * Renders the same AccountModal the legacy `/#passwordreset?token=` hash handler in
 * app/home/page.tsx mounts — this route exists so the link has a real path that
 * Universal/App Links can match. The hash handler stays in place unchanged for
 * links already sitting in inboxes.
 */
function PasswordResetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? undefined;

  return (
    <ThemeProvider>
      <AccountModal
        open
        onClose={() => router.push('/')}
        initialMode="reset-password"
        resetToken={token}
      />
    </ThemeProvider>
  );
}

export default function PasswordResetPage() {
  const { t } = useLocalization();

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">{t('Loading...')}</div>}>
      <PasswordResetContent />
    </Suspense>
  );
}
