'use client';

import React, { useEffect } from 'react';
import { useBaby } from '../../../context/baby';
import { useTimezone } from '../../../context/timezone';
import { useFamily } from '@/src/context/family';
import { useLocalization } from '@/src/context/localization';
import { useParams } from 'next/navigation';
import { Calendar } from '@/src/components/Calendar';
import { NoBabySelected } from '@/src/components/ui/no-baby-selected';
import { Baby as BabyIcon } from 'lucide-react';

function CalendarPage() {
  const { selectedBaby, accountStatus, isAccountAuth, isCheckingAccountStatus } = useBaby();
  const { userTimezone } = useTimezone();
  const { family } = useFamily();
  const { t } = useLocalization();
  const params = useParams();
  const familySlug = params?.slug as string;

  // Update unlock timer on any activity
  const updateUnlockTimer = () => {
    const unlockTime = localStorage.getItem('unlockTime');
    if (unlockTime) {
      localStorage.setItem('unlockTime', Date.now().toString());
    }
  };

  // Add activity tracking
  useEffect(() => {
    // Add listeners for user activity
    window.addEventListener('click', updateUnlockTimer);
    window.addEventListener('keydown', updateUnlockTimer);
    window.addEventListener('mousemove', updateUnlockTimer);
    window.addEventListener('touchstart', updateUnlockTimer);

    return () => {
      // Clean up event listeners
      window.removeEventListener('click', updateUnlockTimer);
      window.removeEventListener('keydown', updateUnlockTimer);
      window.removeEventListener('mousemove', updateUnlockTimer);
      window.removeEventListener('touchstart', updateUnlockTimer);
    };
  }, []);

  return (
    <div className="h-full relative isolate overflow-hidden">
      {selectedBaby ? (
        <Calendar 
          selectedBabyId={selectedBaby.id} 
          userTimezone={userTimezone}
          // Note: If the Calendar component needs to be updated to support familyId,
          // we would need to modify the Calendar component itself
        />
      ) : (
        <div className="h-full">
          {isCheckingAccountStatus ? (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-192px)] text-center bg-white border-t border-gray-200">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-100 flex items-center justify-center animate-pulse">
                <BabyIcon className="h-8 w-8 text-indigo-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">{t('Loading')}...</h3>
              <p className="text-sm text-gray-500">
                {t('Checking your account status')}
              </p>
            </div>
          ) : isAccountAuth && accountStatus && !accountStatus.hasFamily ? (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-192px)] text-center bg-white border-t border-gray-200">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <BabyIcon className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">{t('Family Setup Required')}</h3>
              <p className="text-sm text-gray-500 mb-4">
                {t('Welcome')} {accountStatus.firstName}! {t('You need to set up your family before you can view calendar activities.')}
              </p>
              <button
                onClick={() => window.location.href = '/account/family-setup'}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                {t('Set up your family')}
              </button>
            </div>
          ) : isAccountAuth && accountStatus && !accountStatus.verified ? (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-192px)] text-center bg-white border-t border-gray-200">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-100 flex items-center justify-center">
                <BabyIcon className="h-8 w-8 text-yellow-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">{t('Email Verification Required')}</h3>
              <p className="text-sm text-gray-500 mb-4">
                {t('Welcome')} {accountStatus.firstName}! {t('Please verify your email address to continue.')}
              </p>
              <p className="text-xs text-gray-400">
                {t('Check your inbox for a verification link, or click your account button to resend the email.')}
              </p>
            </div>
          ) : (
            <NoBabySelected 
              title={t('Choose a Baby')}
              description={t('Select a baby to view their calendar activities.')}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default CalendarPage;
