'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ThemeProvider } from '@/src/context/theme';
import { DeploymentProvider } from '@/app/context/deployment';
import { useLocalization } from '@/src/context/localization';
import AccountModal from '@/src/components/modals/AccountModal';
import PageviewBeacon from '@/src/components/analytics/PageviewBeacon';

/**
 * Path-based landing for account verification links (see app/api/utils/account-emails.ts).
 * Renders the same AccountModal the legacy `/#verify?token=` hash handler in
 * app/home/page.tsx mounts — this route exists so the link has a real path that
 * Universal/App Links can match. The hash handler stays in place unchanged for
 * links already sitting in inboxes.
 */
function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? undefined;

  return (
    <ThemeProvider>
      <DeploymentProvider>
        <PageviewBeacon />
      </DeploymentProvider>
      <AccountModal
        open
        onClose={() => router.push('/')}
        initialMode="verify"
        verificationToken={token}
      />
    </ThemeProvider>
  );
}

export default function VerifyPage() {
  const { t } = useLocalization();

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">{t('Loading...')}</div>}>
      <VerifyContent />
    </Suspense>
  );
}
