'use client';

import React, { useEffect, useState } from 'react';
import { Baby, NotificationEventType } from '@prisma/client';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { Switch } from '@/src/components/ui/switch';
import { useToast } from '@/src/components/ui/toast';
import { useLocalization } from '@/src/context/localization';
import {
  checkPushSupport,
  requestNotificationPermission,
  getVapidPublicKey,
  subscribeToPush,
  sendSubscriptionToServer,
  unsubscribeFromPush,
  getCurrentSubscription,
  checkSubscriptionStatus,
} from '@/src/lib/notifications/client';
import { Loader2, Trash2, Bell, BellOff } from 'lucide-react';

interface NotificationSettingsProps {
  babies: Baby[];
  loading: boolean;
}

interface PushSubscription {
  id: string;
  endpoint: string;
  deviceLabel: string | null;
  userAgent: string | null;
  failureCount: number;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface NotificationPreference {
  id: string;
  subscriptionId: string;
  babyId: string;
  eventType: NotificationEventType;
  activityTypes: string | null;
  timerIntervalMinutes: number | null;
  lastTimerNotifiedAt: string | null;
  enabled: boolean;
  subscription: {
    id: string;
    deviceLabel: string | null;
    endpoint: string;
  };
  baby: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export default function NotificationSettings({
  babies,
  loading: parentLoading,
}: NotificationSettingsProps) {
  const { t } = useLocalization();
  const { showToast } = useToast();
  const [subscriptions, setSubscriptions] = useState<PushSubscription[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState<string | undefined>();

  // Fetch subscriptions and preferences
  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('[NotificationSettings] Fetching notification data...');
      const authToken = localStorage.getItem('authToken');
      const headers: HeadersInit = authToken
        ? { Authorization: `Bearer ${authToken}` }
        : {};

      const [subscriptionsResponse, preferencesResponse, statusResponse] =
        await Promise.all([
          fetch('/api/notifications/subscriptions', { headers }),
          fetch('/api/notifications/preferences', { headers }),
          checkSubscriptionStatus(),
        ]);

      if (subscriptionsResponse.ok) {
        const subsData = await subscriptionsResponse.json();
        if (subsData.success) {
          const subs = subsData.data || [];
          setSubscriptions(subs);
          console.log(`[NotificationSettings] Loaded ${subs.length} subscription(s)`);
        }
      } else {
        console.warn('[NotificationSettings] Failed to fetch subscriptions:', subscriptionsResponse.status);
      }

      if (preferencesResponse.ok) {
        const prefsData = await preferencesResponse.json();
        if (prefsData.success) {
          const prefs = prefsData.data || [];
          setPreferences(prefs);
          console.log(`[NotificationSettings] Loaded ${prefs.length} preference(s)`);
        }
      } else {
        console.warn('[NotificationSettings] Failed to fetch preferences:', preferencesResponse.status);
      }

      setIsSubscribed(statusResponse.isSubscribed);
      setSubscriptionId(statusResponse.subscriptionId);
      console.log('[NotificationSettings] Subscription status:', {
        isSubscribed: statusResponse.isSubscribed,
        subscriptionId: statusResponse.subscriptionId,
      });
    } catch (error) {
      console.error('[NotificationSettings] Error fetching notification data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('[NotificationSettings] Component mounted, parentLoading:', parentLoading);
    if (!parentLoading) {
      fetchData();
    }
    return () => {
      console.log('[NotificationSettings] Component unmounting');
    };
  }, [parentLoading]);

  // Handle enabling notifications
  const handleEnableNotifications = async () => {
    try {
      setSubscribing(true);

      // Check browser support
      if (!checkPushSupport()) {
        showToast({
          variant: 'error',
          title: t('Error'),
          message: t('Your browser does not support push notifications'),
          duration: 5000,
        });
        return;
      }

      // Request permission
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

      // Get VAPID key and subscribe
      console.log('Getting VAPID public key...');
      const publicKey = await getVapidPublicKey();
      console.log('VAPID public key retrieved, length:', publicKey.length);
      
      console.log('Registering service worker and subscribing to push...');
      const subscription = await subscribeToPush(publicKey);
      console.log('Push subscription created, endpoint:', subscription.endpoint);

      // Send to server
      const deviceLabel = navigator.userAgent.includes('Mobile')
        ? 'Mobile Device'
        : 'Desktop Device';
      console.log('Sending subscription to server...');
      const subId = await sendSubscriptionToServer(
        subscription,
        deviceLabel,
        navigator.userAgent
      );
      console.log('Subscription saved to server, ID:', subId);

      showToast({
        variant: 'success',
        title: t('Success'),
        message: t('Notifications enabled successfully'),
        duration: 3000,
      });

      await fetchData();
    } catch (error: any) {
      console.error('Error enabling notifications:', error);
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
      });
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

  // Handle removing a device
  const handleRemoveDevice = async (subscription: PushSubscription) => {
    try {
      console.log('[NotificationSettings] Removing device:', {
        id: subscription.id,
        deviceLabel: subscription.deviceLabel,
        endpoint: subscription.endpoint?.substring(0, 50) + '...',
      });
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(
        `/api/notifications/subscriptions/${subscription.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('Failed to unsubscribe'));
      }

      console.log('[NotificationSettings] Device removed from server successfully');

      // Also unsubscribe from browser
      if (subscription.endpoint) {
        console.log('[NotificationSettings] Unsubscribing from browser push...');
        await unsubscribeFromPush(subscription.endpoint).catch((err) => {
          console.warn('[NotificationSettings] Error unsubscribing from browser (non-critical):', err);
        });
      }

      showToast({
        variant: 'success',
        title: t('Success'),
        message: t('Device removed successfully'),
        duration: 3000,
      });

      await fetchData();
    } catch (error: any) {
      console.error('[NotificationSettings] Error removing device:', error);
      showToast({
        variant: 'error',
        title: t('Error'),
        message: error.message || t('Failed to unsubscribe'),
        duration: 5000,
      });
    }
  };

  // Handle preference update
  const handlePreferenceUpdate = async (
    subscriptionId: string,
    babyId: string,
    eventType: NotificationEventType,
    updates: {
      enabled?: boolean;
      activityTypes?: string[] | null;
      timerIntervalMinutes?: number | null;
    }
  ) => {
    try {
      console.log('[NotificationSettings] Updating preference:', {
        subscriptionId,
        babyId,
        eventType,
        updates,
      });
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

      const responseData = await response.json();
      console.log('[NotificationSettings] Preference updated successfully:', responseData);
      await fetchData();
    } catch (error: any) {
      console.error('[NotificationSettings] Error updating preference:', error);
      showToast({
        variant: 'error',
        title: t('Error'),
        message: error.message || t('Failed to save preferences'),
        duration: 5000,
      });
    }
  };

  // Get preference for a subscription, baby, and event type
  const getPreference = (
    subscriptionId: string,
    babyId: string,
    eventType: NotificationEventType
  ): NotificationPreference | undefined => {
    return preferences.find(
      (p) =>
        p.subscriptionId === subscriptionId &&
        p.babyId === babyId &&
        p.eventType === eventType
    );
  };

  // Parse activity types from JSON string
  const parseActivityTypes = (activityTypes: string | null): string[] => {
    if (!activityTypes) return [];
    try {
      return JSON.parse(activityTypes);
    } catch {
      return [];
    }
  };

  if (loading && subscriptions.length === 0) {
    return (
      <div className="border-t border-slate-200 pt-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-200 pt-6">
      <h3 className="form-label mb-4">{t('Push Notifications')}</h3>

      {/* Enable Notifications Button */}
      {!isSubscribed && (
        <div className="mb-6">
          <Button
            onClick={handleEnableNotifications}
            disabled={subscribing || parentLoading}
            className="w-full sm:w-auto"
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
        </div>
      )}

      {/* Device Management */}
      {subscriptions.length > 0 && (
        <div className="space-y-4 mb-6">
          <Label className="form-label">{t('Registered Devices')}</Label>
          <div className="space-y-2">
            {subscriptions.map((subscription) => (
              <div
                key={subscription.id}
                className="flex items-center justify-between p-3 border border-slate-200 rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium">
                    {subscription.deviceLabel || t('Device')}
                  </div>
                  <div className="text-sm text-gray-500">
                    {subscription.lastSuccessAt
                      ? `${t('Last Success')}: ${new Date(
                          subscription.lastSuccessAt
                        ).toLocaleString()}`
                      : subscription.lastFailureAt
                      ? `${t('Last Failure')}: ${new Date(
                          subscription.lastFailureAt
                        ).toLocaleString()}`
                      : ''}
                    {subscription.failureCount > 0 && (
                      <span className="ml-2 text-red-600">
                        ({subscription.failureCount} {t('Failures')})
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveDevice(subscription)}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('Remove Device')}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {subscriptions.length === 0 && isSubscribed && (
        <p className="text-sm text-gray-500 mb-6">{t('No devices registered')}</p>
      )}

      {/* Per-Baby Configuration */}
      {subscriptions.length > 0 && babies.length > 0 && (
        <div className="space-y-6">
          <Label className="form-label">{t('Notification Preferences')}</Label>
          {babies.map((baby) => (
            <div key={baby.id} className="space-y-4 p-4 border border-slate-200 rounded-lg">
              <h4 className="font-medium">
                {baby.firstName} {baby.lastName}
              </h4>

              {subscriptions.map((subscription) => (
                <div key={subscription.id} className="space-y-4 pl-4 border-l-2 border-slate-200">
                  <div className="text-sm text-gray-600">
                    {subscription.deviceLabel || t('Device')}
                  </div>

                  {/* Activity Created Preference */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">{t('Activity Created')}</Label>
                      <Switch
                        checked={
                          getPreference(
                            subscription.id,
                            baby.id,
                            NotificationEventType.ACTIVITY_CREATED
                          )?.enabled ?? false
                        }
                        onCheckedChange={(checked) =>
                          handlePreferenceUpdate(
                            subscription.id,
                            baby.id,
                            NotificationEventType.ACTIVITY_CREATED,
                            { enabled: checked }
                          )
                        }
                        disabled={loading}
                      />
                    </div>
                  </div>

                  {/* Feed Timer Expired Preference */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">{t('Feed Timer Expired')}</Label>
                      <Switch
                        checked={
                          getPreference(
                            subscription.id,
                            baby.id,
                            NotificationEventType.FEED_TIMER_EXPIRED
                          )?.enabled ?? false
                        }
                        onCheckedChange={(checked) =>
                          handlePreferenceUpdate(
                            subscription.id,
                            baby.id,
                            NotificationEventType.FEED_TIMER_EXPIRED,
                            { enabled: checked }
                          )
                        }
                        disabled={loading}
                      />
                    </div>
                    {getPreference(
                      subscription.id,
                      baby.id,
                      NotificationEventType.FEED_TIMER_EXPIRED
                    )?.enabled && (
                      <Select
                        value={
                          getPreference(
                            subscription.id,
                            baby.id,
                            NotificationEventType.FEED_TIMER_EXPIRED
                          )?.timerIntervalMinutes?.toString() || 'null'
                        }
                        onValueChange={(value) =>
                          handlePreferenceUpdate(
                            subscription.id,
                            baby.id,
                            NotificationEventType.FEED_TIMER_EXPIRED,
                            {
                              timerIntervalMinutes:
                                value === 'null' ? null : parseInt(value),
                            }
                          )
                        }
                        disabled={loading}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('Repeat Interval')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="null">
                            {t('Once per expiration')}
                          </SelectItem>
                          <SelectItem value="15">{t('Every 15 minutes')}</SelectItem>
                          <SelectItem value="30">{t('Every 30 minutes')}</SelectItem>
                          <SelectItem value="60">{t('Every hour')}</SelectItem>
                          <SelectItem value="120">{t('Every 2 hours')}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Diaper Timer Expired Preference */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">{t('Diaper Timer Expired')}</Label>
                      <Switch
                        checked={
                          getPreference(
                            subscription.id,
                            baby.id,
                            NotificationEventType.DIAPER_TIMER_EXPIRED
                          )?.enabled ?? false
                        }
                        onCheckedChange={(checked) =>
                          handlePreferenceUpdate(
                            subscription.id,
                            baby.id,
                            NotificationEventType.DIAPER_TIMER_EXPIRED,
                            { enabled: checked }
                          )
                        }
                        disabled={loading}
                      />
                    </div>
                    {getPreference(
                      subscription.id,
                      baby.id,
                      NotificationEventType.DIAPER_TIMER_EXPIRED
                    )?.enabled && (
                      <Select
                        value={
                          getPreference(
                            subscription.id,
                            baby.id,
                            NotificationEventType.DIAPER_TIMER_EXPIRED
                          )?.timerIntervalMinutes?.toString() || 'null'
                        }
                        onValueChange={(value) =>
                          handlePreferenceUpdate(
                            subscription.id,
                            baby.id,
                            NotificationEventType.DIAPER_TIMER_EXPIRED,
                            {
                              timerIntervalMinutes:
                                value === 'null' ? null : parseInt(value),
                            }
                          )
                        }
                        disabled={loading}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('Repeat Interval')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="null">
                            {t('Once per expiration')}
                          </SelectItem>
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
          ))}
        </div>
      )}
    </div>
  );
}
