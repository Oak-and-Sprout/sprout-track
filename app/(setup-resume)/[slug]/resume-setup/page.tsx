'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useLocalization } from '@/src/context/localization';
import SetupWizard from '@/src/components/SetupWizard';

interface SetupStatusData {
  setupStage: number;
  canSetup: boolean;
  currentStage: 2 | 3;
  familyData: {
    id: string;
    name: string;
    slug: string;
    authType: string | null;
    securityPin: string | null;
    caretakers: Array<{
      loginId: string;
      name: string;
      type: string;
      role: 'ADMIN' | 'USER';
      securityPin: string;
    }>;
  };
}

export default function ResumeSetupPage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useLocalization();
  const [setupData, setSetupData] = useState<SetupStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const slug = params?.slug as string;

  useEffect(() => {
    if (!slug) return;

    const checkSetupStatus = async () => {
      try {
        // Check authentication
        const authToken = localStorage.getItem('authToken');
        const unlockTime = localStorage.getItem('unlockTime');

        if (!authToken || !unlockTime) {
          router.push(`/${slug}`);
          return;
        }

        // Decode JWT to get familyId for setup auth
        let familyIdParam = '';
        try {
          const payload = JSON.parse(atob(authToken.split('.')[1]));
          if (payload.familyId) {
            familyIdParam = `?familyId=${payload.familyId}`;
          }
        } catch {
          // Not critical — endpoint can resolve family from auth context
        }

        const response = await fetch(`/api/family/setup-status${familyIdParam}`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
        });

        if (!response.ok) {
          if (response.status === 401) {
            router.push(`/${slug}`);
            return;
          }
          throw new Error('Failed to fetch setup status');
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch setup status');
        }

        const status: SetupStatusData = data.data;

        // If setup is complete, redirect to the app
        if (status.setupStage >= 3) {
          router.push(`/${slug}/log-entry`);
          return;
        }

        // If user can't setup, redirect home
        if (!status.canSetup) {
          router.push('/');
          return;
        }

        // Validate slug matches
        if (status.familyData.slug !== slug) {
          router.push(`/${status.familyData.slug}/resume-setup`);
          return;
        }

        setSetupData(status);
      } catch (err) {
        console.error('Error checking setup status:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    checkSetupStatus();
  }, [slug, router]);

  const handleSetupComplete = (family: { id: string; name: string; slug: string }) => {
    router.push(`/${family.slug}/log-entry`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>{t('Loading setup...')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-900 mb-2">{t('Setup Error')}</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              {t('Return Home')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!setupData) {
    return null;
  }

  return (
    <SetupWizard
      onComplete={handleSetupComplete}
      resumeStage={setupData.currentStage}
      familyData={setupData.familyData}
    />
  );
}
