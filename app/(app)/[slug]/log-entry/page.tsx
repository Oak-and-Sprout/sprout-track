'use client';

import React, { useEffect, useState, useRef, Suspense, useCallback } from 'react';
import '../../../(app)/[slug]/log-entry/no-activities.css';
import { ActiveBreastFeedResponse, ActiveActivityResponse } from '@/app/api/types';
import { Card } from "@/src/components/ui/card";
import { Baby as BabyIcon } from 'lucide-react';
import TimelineV2 from '@/src/components/Timeline/TimelineV2';
import SettingsModal from '@/src/components/modals/SettingsModal';
import { useBaby } from '../../../context/baby';
import { useFamily } from '@/src/context/family';
import { useLocalization } from '@/src/context/localization';
import { ActivityTileGroup } from '@/src/components/ActivityTileGroup';
import SleepForm from '@/src/components/forms/SleepForm';
import FeedForm from '@/src/components/forms/FeedForm';
import DiaperForm from '@/src/components/forms/DiaperForm';
import NoteForm from '@/src/components/forms/NoteForm';
import BathForm from '@/src/components/forms/BathForm';
import PumpForm from '@/src/components/forms/PumpForm';
import MeasurementForm from '@/src/components/forms/MeasurementForm';
import MilestoneForm from '@/src/components/forms/MilestoneForm';
import MedicineForm from '@/src/components/forms/MedicineForm';
import ActivityForm from '@/src/components/forms/ActivityForm';
import VaccineForm from '@/src/components/forms/VaccineForm';
import { useParams } from 'next/navigation';
import { NoBabySelected } from '@/src/components/ui/no-baby-selected';
import ActiveFeedBanner from '@/src/components/ActiveFeedBanner';
import ActiveActivityBanner from '@/src/components/ActiveActivityBanner';

function HomeContent(): React.ReactElement {
  const { selectedBaby, sleepingBabies, setSleepingBabies, feedingBabies, setFeedingBabies, accountStatus, isAccountAuth, isCheckingAccountStatus } = useBaby();
  const { family } = useFamily();
  const { t } = useLocalization();
  const params = useParams();
  const familySlug = params?.slug as string;
  
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [showFeedModal, setShowFeedModal] = useState(false);
  const [showDiaperModal, setShowDiaperModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showBathModal, setShowBathModal] = useState(false);
  const [showPumpModal, setShowPumpModal] = useState(false);
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showMedicineModal, setShowMedicineModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showVaccineModal, setShowVaccineModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [localTime, setLocalTime] = useState<string>('');
  const [sleepStartTime, setSleepStartTime] = useState<Record<string, Date>>({});
  const [lastSleepEndTime, setLastSleepEndTime] = useState<Record<string, Date>>({});
  const [lastFeedTime, setLastFeedTime] = useState<Record<string, Date>>({});
  const [lastDiaperTime, setLastDiaperTime] = useState<Record<string, Date>>({});
  const [includeSolidsInFeedTimer, setIncludeSolidsInFeedTimer] = useState(true);
  const includeSolidsRef = useRef(true);

  // Fetch family settings for feed timer configuration
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) return;
        const response = await fetch('/api/settings', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        if (data.success && data.data) {
          const value = data.data.includeSolidsInFeedTimer ?? true;
          setIncludeSolidsInFeedTimer(value);
          includeSolidsRef.current = value;
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };
    fetchSettings();
  }, [family?.id]);

  const [activeFeedData, setActiveFeedData] = useState<ActiveBreastFeedResponse | null>(null);
  const [feedStartTime, setFeedStartTime] = useState<Record<string, Date>>({});
  const [activeActivityData, setActiveActivityData] = useState<ActiveActivityResponse | null>(null);
  const [activityPrefillData, setActivityPrefillData] = useState<{
    startTime: string;
    durationMinutes: number;
    playType: string;
    subCategory: string | null;
    notes: string | null;
  } | null>(null);

  // Sleep status is now provided by TimelineV2 via onLatestStatusReady callback

  // Check for active breastfeed sessions
  const checkFeedStatus = useCallback(async (babyId: string) => {
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`/api/active-breastfeed?babyId=${babyId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        }
      });
      if (!response.ok) return;

      const data = await response.json();
      if (data.success && data.data) {
        setActiveFeedData(data.data);
        setFeedingBabies((prev: Set<string>) => {
          const newSet = new Set(prev);
          newSet.add(babyId);
          return newSet;
        });
        setFeedStartTime((prev: Record<string, Date>) => ({
          ...prev,
          [babyId]: new Date(data.data.sessionStartTime)
        }));
      } else {
        setActiveFeedData(null);
        setFeedingBabies((prev: Set<string>) => {
          const newSet = new Set(prev);
          newSet.delete(babyId);
          return newSet;
        });
      }
    } catch (error) {
      console.error('Error checking feed status:', error);
    }
  }, [setFeedingBabies]);

  // Check for active activity sessions
  const checkActivityStatus = useCallback(async (babyId: string) => {
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`/api/active-activity?babyId=${babyId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        }
      });
      if (!response.ok) return;

      const data = await response.json();
      if (data.success && data.data) {
        setActiveActivityData(data.data);
      } else {
        setActiveActivityData(null);
      }
    } catch (error) {
      console.error('Error checking activity status:', error);
    }
  }, []);

  // Timeline data fetching is now owned by TimelineV2 component
  // Use refreshTrigger to signal TimelineV2 to re-fetch after form submissions
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Update unlock timer on any activity
  const updateUnlockTimer = () => {
    const unlockTime = localStorage.getItem('unlockTime');
    if (unlockTime) {
      localStorage.setItem('unlockTime', Date.now().toString());
    }
  };

  useEffect(() => {
    // Set initial time
    const now = new Date();
    setLocalTime(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);

    // Update time every minute
    const interval = setInterval(() => {
      const now = new Date();
      setLocalTime(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    }, 60000);

    // Add listeners for user activity
    window.addEventListener('click', updateUnlockTimer);
    window.addEventListener('keydown', updateUnlockTimer);
    window.addEventListener('mousemove', updateUnlockTimer);
    window.addEventListener('touchstart', updateUnlockTimer);

    return () => {
      clearInterval(interval);
      window.removeEventListener('click', updateUnlockTimer);
      window.removeEventListener('keydown', updateUnlockTimer);
      window.removeEventListener('mousemove', updateUnlockTimer);
      window.removeEventListener('touchstart', updateUnlockTimer);
    };
  }, []);

  useEffect(() => {
    const initializeData = async () => {
      if (selectedBaby?.id) {
        // Timeline data and sleep status are now handled by TimelineV2
        await checkFeedStatus(selectedBaby.id);
        await checkActivityStatus(selectedBaby.id);
      }
    };

    initializeData();
  }, [selectedBaby, checkFeedStatus, checkActivityStatus]);

  // Sleep status changes are now handled by handleLatestStatusReady callback from TimelineV2

  // Poll only for active feed/activity status (timeline polling is handled by TimelineV2)
  useEffect(() => {
    if (!selectedBaby?.id) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkFeedStatus(selectedBaby.id);
        checkActivityStatus(selectedBaby.id);
      }
    };

    const poll = setInterval(() => {
      checkFeedStatus(selectedBaby.id);
      checkActivityStatus(selectedBaby.id);
    }, 30000); // Check every 30 seconds

    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(poll);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedBaby?.id, checkFeedStatus, checkActivityStatus]);

  // Active breastfeed action handlers
  const handleFeedSwitch = async () => {
    if (!activeFeedData || !selectedBaby?.id) return;
    try {
      const authToken = localStorage.getItem('authToken');
      await fetch(`/api/active-breastfeed?id=${activeFeedData.id}&action=switch`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
      });
      await checkFeedStatus(selectedBaby.id);
    } catch (error) {
      console.error('Error switching feed side:', error);
    }
  };

  const handleFeedPause = async () => {
    if (!activeFeedData || !selectedBaby?.id) return;
    try {
      const authToken = localStorage.getItem('authToken');
      await fetch(`/api/active-breastfeed?id=${activeFeedData.id}&action=pause`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
      });
      await checkFeedStatus(selectedBaby.id);
    } catch (error) {
      console.error('Error pausing feed:', error);
    }
  };

  const handleFeedResume = async (side: 'LEFT' | 'RIGHT') => {
    if (!activeFeedData || !selectedBaby?.id) return;
    try {
      const authToken = localStorage.getItem('authToken');
      await fetch(`/api/active-breastfeed?id=${activeFeedData.id}&action=resume`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
        body: JSON.stringify({ side }),
      });
      await checkFeedStatus(selectedBaby.id);
    } catch (error) {
      console.error('Error resuming feed:', error);
    }
  };

  const handleFeedEnd = async () => {
    if (!activeFeedData || !selectedBaby?.id) return;
    try {
      const authToken = localStorage.getItem('authToken');
      await fetch(`/api/active-breastfeed?id=${activeFeedData.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
      });
      setActiveFeedData(null);
      setFeedingBabies((prev: Set<string>) => {
        const newSet = new Set(prev);
        newSet.delete(selectedBaby.id);
        return newSet;
      });
      triggerRefresh();
    } catch (error) {
      console.error('Error ending feed:', error);
    }
  };

  // Active activity action handlers
  const handleActivityStart = async (playType: string, subCategory: string, notes: string, existingDurationSeconds: number) => {
    if (!selectedBaby?.id) return;
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch('/api/active-activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
        body: JSON.stringify({
          babyId: selectedBaby.id,
          playType,
          subCategory: subCategory || null,
          notes: notes || null,
          existingDuration: existingDurationSeconds,
        }),
      });
      if (response.ok) {
        await checkActivityStatus(selectedBaby.id);
      }
    } catch (error) {
      console.error('Error starting activity timer:', error);
    }
  };

  const handleActivityPause = async () => {
    if (!activeActivityData || !selectedBaby?.id) return;
    try {
      const authToken = localStorage.getItem('authToken');
      await fetch(`/api/active-activity?id=${activeActivityData.id}&action=pause`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
      });
      await checkActivityStatus(selectedBaby.id);
    } catch (error) {
      console.error('Error pausing activity:', error);
    }
  };

  const handleActivityResume = async () => {
    if (!activeActivityData || !selectedBaby?.id) return;
    try {
      const authToken = localStorage.getItem('authToken');
      await fetch(`/api/active-activity?id=${activeActivityData.id}&action=resume`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
      });
      await checkActivityStatus(selectedBaby.id);
    } catch (error) {
      console.error('Error resuming activity:', error);
    }
  };

  const handleActivityEnd = async () => {
    if (!activeActivityData || !selectedBaby?.id) return;
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`/api/active-activity?id=${activeActivityData.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
      });
      const data = await response.json();
      if (data.success && data.data) {
        setActivityPrefillData({
          startTime: data.data.sessionStartTime,
          durationMinutes: Math.ceil(data.data.duration / 60),
          playType: data.data.playType,
          subCategory: data.data.subCategory,
          notes: data.data.notes,
        });
        setShowActivityModal(true);
      }
      setActiveActivityData(null);
    } catch (error) {
      console.error('Error ending activity:', error);
    }
  };

  // Receive latest status data from TimelineV2
  const handleLatestStatusReady = useCallback((data: import('@/src/components/Timeline/types').LatestStatusData) => {
    if (!selectedBaby?.id) return;

    if (data.lastFeedTime) {
      setLastFeedTime(prev => ({ ...prev, [selectedBaby.id]: data.lastFeedTime! }));
    }
    if (data.lastDiaperTime) {
      setLastDiaperTime(prev => ({ ...prev, [selectedBaby.id]: data.lastDiaperTime! }));
    }
    if (data.lastSleepEndTime) {
      setLastSleepEndTime(prev => ({ ...prev, [selectedBaby.id]: data.lastSleepEndTime! }));
    }

    // Update sleeping babies set
    if (data.ongoingSleep) {
      setSleepingBabies((prev: Set<string>) => {
        const newSet = new Set(prev);
        newSet.add(selectedBaby.id);
        return newSet;
      });
      setSleepStartTime((prev: Record<string, Date>) => ({
        ...prev,
        [selectedBaby.id]: new Date(data.ongoingSleep!.startTime)
      }));
    } else {
      setSleepingBabies((prev: Set<string>) => {
        const newSet = new Set(prev);
        newSet.delete(selectedBaby.id);
        return newSet;
      });
      setSleepStartTime((prev: Record<string, Date>) => {
        const newState = { ...prev };
        delete newState[selectedBaby.id];
        return newState;
      });
    }
  }, [selectedBaby?.id]);

  return (
    <div className="relative isolate">
      {/* Activity Tile Group */}
      {selectedBaby?.id && (
        <ActivityTileGroup
          selectedBaby={selectedBaby}
          sleepingBabies={sleepingBabies}
          feedingBabies={feedingBabies}
          sleepStartTime={sleepStartTime}
          lastSleepEndTime={lastSleepEndTime}
          lastFeedTime={lastFeedTime}
          lastDiaperTime={lastDiaperTime}
          feedStartTime={feedStartTime}
          updateUnlockTimer={updateUnlockTimer}
          onSleepClick={() => setShowSleepModal(true)}
          onFeedClick={() => {
            // Auto-pause the timer when opening the End Feed form
            if (selectedBaby?.id && feedingBabies.has(selectedBaby.id) && activeFeedData && !activeFeedData.isPaused) {
              handleFeedPause();
            }
            setShowFeedModal(true);
          }}
          onDiaperClick={() => setShowDiaperModal(true)}
          onNoteClick={() => setShowNoteModal(true)}
          onBathClick={() => setShowBathModal(true)}
          onPumpClick={() => setShowPumpModal(true)}
          onMeasurementClick={() => setShowMeasurementModal(true)}
          onMilestoneClick={() => setShowMilestoneModal(true)}
          onMedicineClick={() => setShowMedicineModal(true)}
          onPlayClick={() => setShowActivityModal(true)}
          onVaccineClick={() => setShowVaccineModal(true)}
        />
      )}

      {/* Active Breastfeed Banner */}
      {selectedBaby?.id && activeFeedData && (
        <ActiveFeedBanner
          activeFeed={activeFeedData}
          onSwitch={handleFeedSwitch}
          onPause={handleFeedPause}
          onResume={handleFeedResume}
          onEnd={handleFeedEnd}
          onOpenForm={() => setShowFeedModal(true)}
        />
      )}

      {/* Active Activity Banner */}
      {selectedBaby?.id && activeActivityData && (
        <ActiveActivityBanner
          activeActivity={activeActivityData}
          onPause={handleActivityPause}
          onResume={handleActivityResume}
          onEnd={handleActivityEnd}
          onOpenForm={() => setShowActivityModal(true)}
        />
      )}

      {/* Timeline Section */}
      {selectedBaby?.id && (
        <Card className="overflow-hidden border-0 relative z-0">
          <TimelineV2
            babyId={selectedBaby.id}
            refreshTrigger={refreshTrigger}
            onLatestStatusReady={handleLatestStatusReady}
            onActivityDeleted={() => {
              triggerRefresh();
            }}
          />
        </Card>
      )}

      {/* No Baby Selected Screen or Account Setup Needed */}
      {!selectedBaby && (
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
                {t('Welcome')} {accountStatus.firstName}! {t('You need to set up your family before you can start tracking activities.')}
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
            <NoBabySelected />
          )}
        </div>
      )}

      {/* Forms */}
      {/* Sleep Form */}
      <SleepForm
        isOpen={showSleepModal}
        onClose={async () => {
          setShowSleepModal(false);
        }}
        isSleeping={selectedBaby?.id ? sleepingBabies.has(selectedBaby.id) : false}
        onSleepToggle={() => {
          if (selectedBaby?.id) {
            setSleepingBabies((prev: Set<string>) => {
              const newSet = new Set(prev);
              if (newSet.has(selectedBaby.id)) {
                newSet.delete(selectedBaby.id);
              } else {
                newSet.add(selectedBaby.id);
              }
              return newSet;
            });
          }
        }}
        babyId={selectedBaby?.id || ''}
        initialTime={localTime}
        onSuccess={() => {
          if (selectedBaby?.id) {
            triggerRefresh();
          }
        }}
      />
      
      {/* Feed Form */}
      <FeedForm
        isOpen={showFeedModal}
        onClose={() => {
          setShowFeedModal(false);
        }}
        babyId={selectedBaby?.id || ''}
        initialTime={localTime}
        isFeeding={selectedBaby?.id ? feedingBabies.has(selectedBaby.id) : false}
        activeFeedData={activeFeedData}
        onFeedToggle={() => {
          if (selectedBaby?.id) {
            checkFeedStatus(selectedBaby.id);
          }
        }}
        onSwitch={handleFeedSwitch}
        onPause={handleFeedPause}
        onResume={handleFeedResume}
        onSuccess={async () => {
          if (selectedBaby?.id) {
            triggerRefresh();
            await checkFeedStatus(selectedBaby.id);
          }
        }}
      />
      
      {/* Diaper Form */}
      <DiaperForm
        isOpen={showDiaperModal}
        onClose={() => {
          setShowDiaperModal(false);
        }}
        babyId={selectedBaby?.id || ''}
        initialTime={localTime}
        onSuccess={() => {
          if (selectedBaby?.id) {
            triggerRefresh();
          }
        }}
      />
      
      {/* Note Form */}
      <NoteForm
        isOpen={showNoteModal}
        onClose={() => {
          setShowNoteModal(false);
        }}
        babyId={selectedBaby?.id || ''}
        initialTime={localTime}
        onSuccess={() => {
          if (selectedBaby?.id) {
            triggerRefresh();
          }
        }}
      />
      
      {/* Bath Form */}
      <BathForm
        isOpen={showBathModal}
        onClose={() => {
          setShowBathModal(false);
        }}
        babyId={selectedBaby?.id || ''}
        initialTime={localTime}
        onSuccess={() => {
          if (selectedBaby?.id) {
            triggerRefresh();
          }
        }}
      />
      
      {/* Pump Form */}
      <PumpForm
        isOpen={showPumpModal}
        onClose={() => {
          setShowPumpModal(false);
        }}
        babyId={selectedBaby?.id || ''}
        initialTime={localTime}
        onSuccess={() => {
          if (selectedBaby?.id) {
            triggerRefresh();
          }
        }}
      />
      
      {/* Measurement Form */}
      <MeasurementForm
        isOpen={showMeasurementModal}
        onClose={() => {
          setShowMeasurementModal(false);
        }}
        babyId={selectedBaby?.id || ''}
        initialTime={localTime}
        onSuccess={() => {
          if (selectedBaby?.id) {
            triggerRefresh();
          }
        }}
      />
      
      {/* Milestone Form */}
      <MilestoneForm
        isOpen={showMilestoneModal}
        onClose={() => {
          setShowMilestoneModal(false);
        }}
        babyId={selectedBaby?.id || ''}
        initialTime={localTime}
        onSuccess={() => {
          if (selectedBaby?.id) {
            triggerRefresh();
          }
        }}
      />
      
      {/* Medicine Form */}
      <MedicineForm
        isOpen={showMedicineModal}
        onClose={() => {
          setShowMedicineModal(false);
        }}
        babyId={selectedBaby?.id}
        initialTime={localTime}
        onSuccess={() => {
          if (selectedBaby?.id) {
            triggerRefresh();
          }
        }}
      />
      
      {/* Activity Form */}
      <ActivityForm
        isOpen={showActivityModal}
        onClose={() => {
          setShowActivityModal(false);
          setActivityPrefillData(null);
        }}
        babyId={selectedBaby?.id || ''}
        initialTime={localTime}
        activeActivityData={activeActivityData}
        onStartTimer={handleActivityStart}
        onPauseTimer={handleActivityPause}
        onResumeTimer={handleActivityResume}
        onEndTimer={handleActivityEnd}
        prefillData={activityPrefillData}
        onSuccess={() => {
          if (selectedBaby?.id) {
            triggerRefresh();
            checkActivityStatus(selectedBaby.id);
          }
        }}
      />

      {/* Vaccine Form */}
      <VaccineForm
        isOpen={showVaccineModal}
        onClose={() => setShowVaccineModal(false)}
        babyId={selectedBaby?.id || ''}
        initialTime={localTime}
        onSuccess={() => {
          if (selectedBaby?.id) {
            triggerRefresh();
          }
        }}
      />

      {/* Settings Modal */}
      <SettingsModal
        open={showSettingsModal}
        onClose={() => {
          setShowSettingsModal(false);
          if (selectedBaby?.id) {
            triggerRefresh();
          }
        }}
        variant="settings"
      />
    </div>
  );
}

export default function Home() {
  const { t } = useLocalization();
  
  return (
    <Suspense fallback={<div>{t('Loading')}...</div>}>
      <HomeContent />
    </Suspense>
  );
}
