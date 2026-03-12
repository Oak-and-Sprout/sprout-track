'use client';

import React, { useState } from 'react';
import { Baby, NotificationEventType } from '@prisma/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Switch } from '@/src/components/ui/switch';
import { Label } from '@/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { useToast } from '@/src/components/ui/toast';
import { useLocalization } from '@/src/context/localization';
import {
  checkPushSupport,
  requestNotificationPermission,
  getVapidPublicKey,
  subscribeToPush,
  sendSubscriptionToServer,
} from '@/src/lib/notifications/client';
import { Bell, Loader2, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

const ALL_ACTIVITY_TYPES = [
  'feed', 'diaper', 'sleep', 'bath', 'pump', 'medicine', 'supplement', 'play', 'note', 'milestone', 'measurement',
] as const;

interface NotificationSplashModalProps {
  open: boolean;
  onClose: () => void;
  babies: Baby[];
}

interface PreferenceState {
  enabled: boolean;
  timerIntervalMinutes: number | null;
  activityTypes: string[] | null;
}

type PreferenceKey = string; // `${babyId}-${eventType}`

export default function NotificationSplashModal({
  open,
  onClose,
  babies,
}: NotificationSplashModalProps) {
  const { t } = useLocalization();
  const { showToast } = useToast();
  const [step, setStep] = useState<'welcome' | 'preferences'>('welcome');
  const [subscribing, setSubscribing] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<Record<PreferenceKey, PreferenceState>>({});
  const [savingPreference, setSavingPreference] = useState<string | null>(null);
  const [expandedActivities, setExpandedActivities] = useState<Record<string, boolean>>({});

  const handleDismiss = () => {
    localStorage.setItem('notificationSplashDismissed', Date.now().toString());
    setStep('welcome');
    onClose();
  };

  const handleEnableNotifications = async () => {
    try {
      setSubscribing(true);

      if (!checkPushSupport()) {
        showToast({
          variant: 'error',
          title: t('Error'),
          message: t('Your browser does not support push notifications'),
          duration: 5000,
        });
        return;
      }

      const permission = await requestNotificationPermission();
      if (permission !== 'granted') {
        showToast({
          variant: 'error',
          title: t('Error'),
          message: t('Notification permission denied'),
          duration: 5000,
        });
        return;
      }

      const publicKey = await getVapidPublicKey();
      const subscription = await subscribeToPush(publicKey);

      const deviceLabel = navigator.userAgent.includes('Mobile')
        ? 'Mobile Device'
        : 'Desktop Device';
      const subId = await sendSubscriptionToServer(
        subscription,
        deviceLabel,
        navigator.userAgent
      );

      setSubscriptionId(subId);

      // Create default ACTIVITY_CREATED preferences for all babies
      const authToken = localStorage.getItem('authToken');
      const defaultPrefs: Record<PreferenceKey, PreferenceState> = {};

      for (const baby of babies) {
        try {
          await fetch('/api/notifications/preferences', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              subscriptionId: subId,
              babyId: baby.id,
              eventType: NotificationEventType.ACTIVITY_CREATED,
              enabled: true,
            }),
          });
          defaultPrefs[`${baby.id}-${NotificationEventType.ACTIVITY_CREATED}`] = {
            enabled: true,
            timerIntervalMinutes: null,
            activityTypes: null,
          };
        } catch (error) {
          console.error(`Error creating default preference for baby ${baby.id}:`, error);
        }
      }

      setPreferences(defaultPrefs);

      showToast({
        variant: 'success',
        title: t('Success'),
        message: t('Notifications enabled successfully'),
        duration: 3000,
      });

      setStep('preferences');
    } catch (error: any) {
      console.error('Error enabling notifications:', error);
      showToast({
        variant: 'error',
        title: t('Error'),
        message: error?.message || t('Failed to subscribe to notifications'),
        duration: 5000,
      });
    } finally {
      setSubscribing(false);
    }
  };

  const handlePreferenceUpdate = async (
    babyId: string,
    eventType: NotificationEventType,
    updates: { enabled?: boolean; timerIntervalMinutes?: number | null; activityTypes?: string[] | null }
  ) => {
    if (!subscriptionId) return;

    const prefKey = `${babyId}-${eventType}`;
    setSavingPreference(prefKey);

    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          subscriptionId,
          babyId,
          eventType,
          ...updates,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('Failed to save preferences'));
      }

      setPreferences((prev) => ({
        ...prev,
        [prefKey]: {
          enabled: updates.enabled ?? prev[prefKey]?.enabled ?? false,
          timerIntervalMinutes: updates.timerIntervalMinutes !== undefined
            ? updates.timerIntervalMinutes
            : prev[prefKey]?.timerIntervalMinutes ?? null,
          activityTypes: updates.activityTypes !== undefined
            ? updates.activityTypes
            : prev[prefKey]?.activityTypes ?? null,
        },
      }));
    } catch (error: any) {
      console.error('Error updating preference:', error);
      showToast({
        variant: 'error',
        title: t('Error'),
        message: error?.message || t('Failed to save preferences'),
        duration: 5000,
      });
    } finally {
      setSavingPreference(null);
    }
  };

  const getPreference = (babyId: string, eventType: NotificationEventType): PreferenceState => {
    return preferences[`${babyId}-${eventType}`] || { enabled: false, timerIntervalMinutes: null, activityTypes: null };
  };

  const handleComplete = () => {
    localStorage.setItem('notificationSplashDismissed', Date.now().toString());
    setStep('welcome');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleDismiss(); }}>
      <DialogContent hideClose={step === 'welcome'} className="dialog-content !p-4 sm:!p-6 max-w-md">
        {step === 'welcome' && (
          <>
            <DialogHeader>
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                  <Bell className="h-8 w-8 text-teal-600 dark:text-teal-400" />
                </div>
              </div>
              <DialogTitle className="text-center text-xl">
                {t('Stay Updated')}
              </DialogTitle>
              <DialogDescription className="text-center">
                {t('Enable push notifications to get alerts when activities are logged, feeding timers expire, and more.')}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 mt-4">
              <Button
                onClick={handleEnableNotifications}
                disabled={subscribing}
                className="w-full"
              >
                {subscribing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('Enabling...')}
                  </>
                ) : (
                  <>
                    <Bell className="h-4 w-4 mr-2" />
                    {t('Enable Notifications')}
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={handleDismiss}
                className="w-full"
              >
                {t('Not Now')}
              </Button>
              <p className="text-xs text-center text-gray-400 dark:text-gray-500">
                {t('You can always enable notifications later in Settings.')}
              </p>
            </div>
          </>
        )}

        {step === 'preferences' && (
          <>
            <DialogHeader>
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <DialogTitle className="text-center text-xl">
                {t('Customize Notifications')}
              </DialogTitle>
              <DialogDescription className="text-center">
                {t('Choose which notifications you want to receive for each baby.')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4 max-h-[50vh] overflow-y-auto">
              {babies.map((baby) => (
                <div key={baby.id} className="space-y-3 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <h4 className="font-medium">
                    {baby.firstName} {baby.lastName}
                  </h4>

                  {/* Activity Created */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">{t('Activity Created')}</Label>
                      <Switch
                        checked={getPreference(baby.id, NotificationEventType.ACTIVITY_CREATED).enabled}
                        onCheckedChange={(checked) =>
                          handlePreferenceUpdate(baby.id, NotificationEventType.ACTIVITY_CREATED, { enabled: checked })
                        }
                        disabled={savingPreference === `${baby.id}-${NotificationEventType.ACTIVITY_CREATED}`}
                      />
                    </div>
                    {/* Activity Type Sub-Selections */}
                    {getPreference(baby.id, NotificationEventType.ACTIVITY_CREATED).enabled && (
                      <div className="space-y-2">
                        <button
                          type="button"
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          onClick={() => {
                            setExpandedActivities((prev) => ({
                              ...prev,
                              [baby.id]: !prev[baby.id],
                            }));
                          }}
                        >
                          {expandedActivities[baby.id] ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                          {t('Select Activities')}
                        </button>
                        {expandedActivities[baby.id] && (
                          <div className="grid grid-cols-2 gap-2 pl-2">
                            {ALL_ACTIVITY_TYPES.map((actType) => {
                              const pref = getPreference(baby.id, NotificationEventType.ACTIVITY_CREATED);
                              const currentTypes = pref.activityTypes || [];
                              const isAll = currentTypes.length === 0;
                              const isChecked = isAll || currentTypes.includes(actType);
                              return (
                                <label
                                  key={actType}
                                  className="flex items-center gap-2 text-sm cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      let newTypes: string[];
                                      if (isAll) {
                                        newTypes = ALL_ACTIVITY_TYPES.filter((at) => at !== actType) as unknown as string[];
                                      } else if (e.target.checked) {
                                        newTypes = [...currentTypes, actType];
                                      } else {
                                        newTypes = currentTypes.filter((at) => at !== actType);
                                      }
                                      const saveTypes =
                                        newTypes.length === ALL_ACTIVITY_TYPES.length ? null : newTypes;
                                      handlePreferenceUpdate(
                                        baby.id,
                                        NotificationEventType.ACTIVITY_CREATED,
                                        { activityTypes: saveTypes }
                                      );
                                    }}
                                    disabled={savingPreference === `${baby.id}-${NotificationEventType.ACTIVITY_CREATED}`}
                                    className="rounded border-gray-300"
                                  />
                                  <span className="capitalize">
                                    {t(actType.charAt(0).toUpperCase() + actType.slice(1))}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Feed Timer Expired */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">{t('Feed Timer Expired')}</Label>
                      <Switch
                        checked={getPreference(baby.id, NotificationEventType.FEED_TIMER_EXPIRED).enabled}
                        onCheckedChange={(checked) =>
                          handlePreferenceUpdate(baby.id, NotificationEventType.FEED_TIMER_EXPIRED, { enabled: checked })
                        }
                        disabled={savingPreference === `${baby.id}-${NotificationEventType.FEED_TIMER_EXPIRED}`}
                      />
                    </div>
                    {getPreference(baby.id, NotificationEventType.FEED_TIMER_EXPIRED).enabled && (
                      <Select
                        value={
                          getPreference(baby.id, NotificationEventType.FEED_TIMER_EXPIRED).timerIntervalMinutes?.toString() || 'null'
                        }
                        onValueChange={(value) =>
                          handlePreferenceUpdate(baby.id, NotificationEventType.FEED_TIMER_EXPIRED, {
                            timerIntervalMinutes: value === 'null' ? null : parseInt(value),
                          })
                        }
                        disabled={savingPreference === `${baby.id}-${NotificationEventType.FEED_TIMER_EXPIRED}`}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('Repeat Interval')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="null">{t('Once per expiration')}</SelectItem>
                          <SelectItem value="15">{t('Every 15 minutes')}</SelectItem>
                          <SelectItem value="30">{t('Every 30 minutes')}</SelectItem>
                          <SelectItem value="60">{t('Every hour')}</SelectItem>
                          <SelectItem value="120">{t('Every 2 hours')}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Diaper Timer Expired */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">{t('Diaper Timer Expired')}</Label>
                      <Switch
                        checked={getPreference(baby.id, NotificationEventType.DIAPER_TIMER_EXPIRED).enabled}
                        onCheckedChange={(checked) =>
                          handlePreferenceUpdate(baby.id, NotificationEventType.DIAPER_TIMER_EXPIRED, { enabled: checked })
                        }
                        disabled={savingPreference === `${baby.id}-${NotificationEventType.DIAPER_TIMER_EXPIRED}`}
                      />
                    </div>
                    {getPreference(baby.id, NotificationEventType.DIAPER_TIMER_EXPIRED).enabled && (
                      <Select
                        value={
                          getPreference(baby.id, NotificationEventType.DIAPER_TIMER_EXPIRED).timerIntervalMinutes?.toString() || 'null'
                        }
                        onValueChange={(value) =>
                          handlePreferenceUpdate(baby.id, NotificationEventType.DIAPER_TIMER_EXPIRED, {
                            timerIntervalMinutes: value === 'null' ? null : parseInt(value),
                          })
                        }
                        disabled={savingPreference === `${baby.id}-${NotificationEventType.DIAPER_TIMER_EXPIRED}`}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('Repeat Interval')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="null">{t('Once per expiration')}</SelectItem>
                          <SelectItem value="15">{t('Every 15 minutes')}</SelectItem>
                          <SelectItem value="30">{t('Every 30 minutes')}</SelectItem>
                          <SelectItem value="60">{t('Every hour')}</SelectItem>
                          <SelectItem value="120">{t('Every 2 hours')}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Medicine Timer Expired */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">{t('Medicine Timer Expired')}</Label>
                      <Switch
                        checked={getPreference(baby.id, NotificationEventType.MEDICINE_TIMER_EXPIRED).enabled}
                        onCheckedChange={(checked) =>
                          handlePreferenceUpdate(baby.id, NotificationEventType.MEDICINE_TIMER_EXPIRED, { enabled: checked })
                        }
                        disabled={savingPreference === `${baby.id}-${NotificationEventType.MEDICINE_TIMER_EXPIRED}`}
                      />
                    </div>
                    {getPreference(baby.id, NotificationEventType.MEDICINE_TIMER_EXPIRED).enabled && (
                      <Select
                        value={
                          getPreference(baby.id, NotificationEventType.MEDICINE_TIMER_EXPIRED).timerIntervalMinutes?.toString() || 'null'
                        }
                        onValueChange={(value) =>
                          handlePreferenceUpdate(baby.id, NotificationEventType.MEDICINE_TIMER_EXPIRED, {
                            timerIntervalMinutes: value === 'null' ? null : parseInt(value),
                          })
                        }
                        disabled={savingPreference === `${baby.id}-${NotificationEventType.MEDICINE_TIMER_EXPIRED}`}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('Repeat Interval')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="null">{t('Once per expiration')}</SelectItem>
                          <SelectItem value="15">{t('Every 15 minutes')}</SelectItem>
                          <SelectItem value="30">{t('Every 30 minutes')}</SelectItem>
                          <SelectItem value="60">{t('Every hour')}</SelectItem>
                          <SelectItem value="120">{t('Every 2 hours')}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <Button onClick={handleComplete} className="w-full">
                {t('Done')}
              </Button>
              <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-2">
                {t('You can customize your preferences anytime in Settings.')}
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
