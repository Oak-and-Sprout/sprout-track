'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useBaby } from '../../../context/baby';
import { useTimezone } from '../../../context/timezone';
import { useFamily } from '@/src/context/family';
import { useLocalization } from '@/src/context/localization';
import { useParams } from 'next/navigation';
import FullLogTimeline from '@/src/components/FullLogTimeline';
import { NoBabySelected } from '@/src/components/ui/no-baby-selected';
import { Baby as BabyIcon } from 'lucide-react';

function FullLogPage() {
  const { selectedBaby, accountStatus, isAccountAuth, isCheckingAccountStatus } = useBaby();
  const { userTimezone } = useTimezone();
  const { family } = useFamily();
  const { t } = useLocalization();
  const params = useParams();
  const familySlug = params?.slug as string;
  
  const [activities, setActivities] = useState([]);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // Default to last 7 days
    return date;
  });
  const [endDate, setEndDate] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(false);

  const refreshActivities = useCallback(async () => {
    if (!selectedBaby?.id) return;

    setIsLoading(true);
    try {
      // Set start date to beginning of day (00:00:00) and end date to end of day (23:59:59)
      const adjustedStartDate = new Date(startDate);
      adjustedStartDate.setHours(0, 0, 0, 0);
      
      const adjustedEndDate = new Date(endDate);
      adjustedEndDate.setHours(23, 59, 59, 999);

      // Build the URL with query parameters
      let url = `/api/timeline?babyId=${selectedBaby.id}&startDate=${adjustedStartDate.toISOString()}&endDate=${adjustedEndDate.toISOString()}&timezone=${encodeURIComponent(userTimezone)}`;
      
      // Add family ID if available
      if (family?.id) {
        url += `&familyId=${family.id}`;
      }

      const authToken = localStorage.getItem('authToken');
      const response = await fetch(url, {
        headers: authToken ? {
          'Authorization': `Bearer ${authToken}`
        } : {}
      });
      const data = await response.json();
      if (data.success) {
        setActivities(data.data);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBaby?.id, startDate, endDate, userTimezone, family]);

  // Initial load
  React.useEffect(() => {
    refreshActivities();
  }, [refreshActivities]);

  const handleDateRangeChange = (newStartDate: Date, newEndDate: Date) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  };

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
    <div className="h-full relative isolate">
      {selectedBaby ? (
        <div className="relative z-0">
          <FullLogTimeline
            activities={activities}
            onActivityDeleted={refreshActivities}
            startDate={startDate}
            endDate={endDate}
            onDateRangeChange={handleDateRangeChange}
          />
        </div>
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
                {t('Welcome')} {accountStatus.firstName}! {t('You need to set up your family before you can view activity logs.')}
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
              title={t('Start Logging')}
              description={t('Choose a baby to view their full activity log.')}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default FullLogPage;
