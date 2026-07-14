'use client';

import { useState, useCallback, useEffect, useLayoutEffect, useRef, CSSProperties } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useBaby } from '@/app/context/baby';
import { useTimezone } from '@/app/context/timezone';
import { useLocalization } from '@/src/context/localization';
import { useWakeLock } from '@/src/hooks/useWakeLock';
import { useFullscreen } from '@/src/hooks/useFullscreen';
import { useNurserySettings } from '@/src/hooks/useNurserySettings';
import { autoIconColor } from '@/src/utils/nursery/colorMath';
import { fetchPhotosEnabled } from '@/src/utils/photoClientApi';
import { Baby } from '@prisma/client';
import { ClockBlock } from './ClockBlock';
import { SceneBackground } from './scenes/SceneBackground';
import { SettingsDrawer } from './SettingsDrawer';
import { useFeedActions } from './activities/useFeedActions';
import { usePumpActions } from './activities/usePumpActions';
import { useDiaperActions } from './activities/useDiaperActions';
import { useSleepActions } from './activities/useSleepActions';
import { ActivityCard } from './activities/ActivityCard';
import { BigTile } from './activities/BigTile';
import { UndoToast } from './activities/UndoToast';
import { TileLog, UndoInfo } from './activities/types';
import './nursery.css';

export function NurseryModeContainer() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;
  const { selectedBaby, setSelectedBaby } = useBaby();
  const { toUTCString } = useTimezone();
  const { t } = useLocalization();
  const wakeLock = useWakeLock();
  const fullscreen = useFullscreen();
  const { settings, isLoading, updateSettings } = useNurserySettings();

  const [logs, setLogs] = useState<Record<string, TileLog>>({});
  const [babies, setBabies] = useState<Baby[]>([]);
  const [undo, setUndo] = useState<UndoInfo | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [enableBreastMilkTracking, setEnableBreastMilkTracking] = useState(true);
  const [photosEnabled, setPhotosEnabled] = useState(false);
  const [photoTint, setPhotoTint] = useState<string | null>(null);
  const [isLandscape, setIsLandscape] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(orientation: landscape) and (max-height: 500px)').matches
  );

  const lastSeenRef = useRef<Record<string, string>>({});
  const fetchActivityRef = useRef<(() => void) | null>(null);

  // Listen for orientation changes
  useLayoutEffect(() => {
    const mql = window.matchMedia('(orientation: landscape) and (max-height: 500px)');
    setIsLandscape(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsLandscape(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Fetch family settings for breast milk tracking flag
  useEffect(() => {
    const fetchFamilySettings = async () => {
      try {
        const authToken = localStorage.getItem('authToken');
        const res = await fetch('/api/settings', {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setEnableBreastMilkTracking(data.data?.enableBreastMilkTracking ?? true);
          }
        }
      } catch (err) {
        // Default to enabled on error
      }
    };
    fetchFamilySettings();
  }, []);

  // Deployment-wide photos feature flag (Task 13 wires the actual picker)
  useEffect(() => {
    fetchPhotosEnabled().then(setPhotosEnabled);
  }, []);

  // Fetch babies list and auto-select if needed
  useEffect(() => {
    const fetchBabies = async () => {
      try {
        const authToken = localStorage.getItem('authToken');
        const res = await fetch('/api/baby', {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            const activeBabies = data.data.filter((b: Baby) => !b.inactive);
            setBabies(activeBabies);
            if (!selectedBaby && activeBabies.length > 0) {
              setSelectedBaby(activeBabies[0]);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch babies:', err);
      }
    };
    fetchBabies();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for recent activity updates every 10 seconds
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!selectedBaby) return;

    const fetchRecentActivity = async () => {
      try {
        const authToken = localStorage.getItem('authToken');
        const headers: Record<string, string> = authToken ? { Authorization: `Bearer ${authToken}` } : {};
        const babyId = selectedBaby.id;

        const [feedRes, diaperRes, sleepRes, pumpRes] = await Promise.all([
          fetch(`/api/feed-log?babyId=${babyId}`, { headers }),
          fetch(`/api/diaper-log?babyId=${babyId}`, { headers }),
          fetch(`/api/sleep-log?babyId=${babyId}`, { headers }),
          fetch(`/api/pump-log?babyId=${babyId}`, { headers }),
        ]);

        const [feedData, diaperData, sleepData, pumpData] = await Promise.all([
          feedRes.ok ? feedRes.json() : null,
          diaperRes.ok ? diaperRes.json() : null,
          sleepRes.ok ? sleepRes.json() : null,
          pumpRes.ok ? pumpRes.json() : null,
        ]);

        const newLogs: Record<string, TileLog> = {};

        // Latest feed
        if (feedData?.success && feedData.data?.length > 0) {
          const latest = feedData.data[0];
          const id = latest.id;
          if (id !== lastSeenRef.current.feed) {
            lastSeenRef.current.feed = id;
            const time = new Date(latest.time || latest.startTime)
              .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
              .toLowerCase();
            const typeLabels: Record<string, string> = {
              BREAST: 'Breast', BOTTLE: 'Bottle', FOOD: 'Food',
              FORMULA: 'Formula', PUMPED_BOTTLE: 'Pumped Bottle',
            };
            newLogs.feed = { last: time, note: t(typeLabels[latest.type]) || latest.type };
          }
        }

        // Latest diaper
        if (diaperData?.success && diaperData.data?.length > 0) {
          const latest = diaperData.data[0];
          const id = latest.id;
          if (id !== lastSeenRef.current.diaper) {
            lastSeenRef.current.diaper = id;
            const time = new Date(latest.time)
              .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
              .toLowerCase();
            const typeLabels: Record<string, string> = { WET: 'Wet', DIRTY: 'Dirty', BOTH: 'Both' };
            newLogs.diaper = { last: time, note: t(typeLabels[latest.type]) || latest.type };
          }
        }

        // Latest sleep (completed only)
        if (sleepData?.success && sleepData.data?.length > 0) {
          const latest = sleepData.data.find((s: any) => s.endTime);
          if (latest) {
            const id = latest.id;
            if (id !== lastSeenRef.current.sleep) {
              lastSeenRef.current.sleep = id;
              const time = new Date(latest.endTime)
                .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                .toLowerCase();
              const dur = latest.duration ? `${latest.duration} min` : '';
              newLogs.sleep = { last: time, note: [t(latest.location || 'Sleep'), dur].filter(Boolean).join(' — ') };
            }
          }
        }

        // Latest pump
        if (pumpData?.success && pumpData.data?.length > 0) {
          const latest = pumpData.data[0];
          const id = latest.id;
          if (id !== lastSeenRef.current.pump) {
            lastSeenRef.current.pump = id;
            const time = new Date(latest.startTime)
              .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
              .toLowerCase();
            const actionLabels: Record<string, string> = { STORED: 'Stored', FED: 'Fed', DISCARDED: 'Discarded' };
            newLogs.pump = { last: time, note: t(actionLabels[latest.pumpAction]) || latest.pumpAction };
          }
        }

        if (Object.keys(newLogs).length > 0) {
          setLogs(prev => ({ ...prev, ...newLogs }));
        }
      } catch (err) {
        console.error('Failed to poll activities:', err);
      }
    };

    fetchActivityRef.current = fetchRecentActivity;
    fetchRecentActivity();
    pollRef.current = setInterval(fetchRecentActivity, 10000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedBaby?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLog = useCallback((tileId: string, note: string) => {
    const now = new Date()
      .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      .toLowerCase();
    setLogs(prev => ({ ...prev, [tileId]: { last: now, note } }));
  }, []);

  // Stable identity: the container re-renders every second while an activity
  // timer runs, and UndoToast's auto-dismiss effect depends on this callback —
  // an inline arrow would re-arm the 6s timeout on every tick.
  const dismissUndo = useCallback(() => setUndo(null), []);

  const handleUndo = useCallback(async () => {
    if (!undo) return;
    const ok = await undo.undo();
    if (ok) {
      setLogs(prev => {
        const next = { ...prev };
        delete next[undo.tileId];
        return next;
      });
      lastSeenRef.current[undo.tileId] = '';
      if (fetchActivityRef.current) fetchActivityRef.current();
    }
    setUndo(null);
  }, [undo]);

  const handleExit = useCallback(() => {
    wakeLock.release();
    if (fullscreen.isFullscreen) fullscreen.exit();
    router.push(`/${slug}/log-entry`);
  }, [wakeLock, fullscreen, router, slug]);

  const handleSelectBaby = useCallback((id: string) => {
    const baby = babies.find(b => b.id === id);
    if (!baby) return;
    setSelectedBaby(baby);
    setLogs({});
    lastSeenRef.current = {};
  }, [babies, setSelectedBaby]);

  // Activity hooks — always called unconditionally (rules of hooks)
  const hookArgs = { babyId: selectedBaby?.id ?? '', toUTCString, onLog: handleLog, onUndoable: setUndo, enableBreastMilkTracking };
  const feedView = useFeedActions(hookArgs);
  const pumpView = usePumpActions(hookArgs);
  const diaperView = useDiaperActions(hookArgs);
  const sleepView = useSleepActions(hookArgs);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: '#0a0a1a' }}>
        <div className="text-white/50 text-sm font-sans">{t('Loading')}...</div>
      </div>
    );
  }

  const trans = settings.trans;
  const cardBg = (0.16 - (trans / 100) * 0.15).toFixed(3);
  const btnBg = (0.2 - (trans / 100) * 0.16).toFixed(3);
  const line = (0.24 - (trans / 100) * 0.16).toFixed(3);
  const stageVars = { '--cardbg': cardBg, '--btnbg': btnBg, '--cardline': line, '--btnline': line } as CSSProperties;

  const iconColor = settings.iconColor ?? (settings.scene === 'photo' && photoTint ? photoTint : autoIconColor(settings.hue));
  const shape = settings.iconShape;
  const clockBabies = babies.map(b => ({ id: b.id, firstName: b.firstName }));
  const babyName = selectedBaby?.firstName ?? t('Sprout Track');

  const views = [feedView, pumpView, diaperView, sleepView];
  const visible = views.filter(v => settings.acts[v.id]);

  const activityArea = settings.layout === 'tiles' ? (
    <div className={`nursery-tilegrid${visible.length <= 2 ? ' two' : ''}`}>
      {visible.map(v => (
        <BigTile key={v.id} view={v} log={logs[v.id] || null} iconColor={iconColor} iconShape={shape} />
      ))}
    </div>
  ) : (
    <div className="nursery-grid">
      {visible.map(v => (
        <ActivityCard key={v.id} view={v} log={logs[v.id] || null} iconColor={iconColor} iconShape={shape} />
      ))}
    </div>
  );

  const wakeStatus = wakeLock.isActive
    ? t('Screen lock active')
    : wakeLock.isSupported
      ? t('Requesting wake lock...')
      : t('Wake lock not supported');

  return (
    <div className="nursery-stage" style={stageVars}>
      <style>{`* { -webkit-tap-highlight-color: transparent; }
        .nursery-stage input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 28px; height: 28px; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.25); cursor: pointer; }`}</style>

      <SceneBackground settings={settings} onPhotoTint={setPhotoTint} />

      <div className="nursery-fg">
        <div className="nursery-topbar" style={isLandscape ? { justifyContent: 'space-between' } : undefined}>
          {isLandscape && (
            <ClockBlock babyName={babyName} babies={clockBabies} selectedBabyId={selectedBaby?.id} onSelectBaby={handleSelectBaby} compact />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(20px, 2.5vw, 40px)' }}>
            <button type="button" className="nursery-ghost" onClick={() => setSettingsOpen(true)}>{t('Settings')}</button>
            <button type="button" className="nursery-ghost" onClick={handleExit}>{t('Exit')}</button>
          </div>
        </div>

        <div className="nursery-center">
          {!isLandscape && (
            <ClockBlock babyName={babyName} babies={clockBabies} selectedBabyId={selectedBaby?.id} onSelectBaby={handleSelectBaby} />
          )}
          {selectedBaby && activityArea}
        </div>
      </div>

      {!isLandscape && (
        <div className="nursery-footer">
          <div className="m" style={{ textTransform: 'uppercase' }}>{t('Nursery Mode')}</div>
          <div className="l" style={{ textTransform: 'uppercase' }}>
            {wakeLock.isActive && <span className="nursery-dotlock" />}
            {wakeStatus}
          </div>
        </div>
      )}

      <UndoToast undo={undo} onUndo={handleUndo} onDismiss={dismissUndo} />

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        updateSettings={updateSettings}
        wakeLockActive={wakeLock.isActive}
        wakeLockSupported={wakeLock.isSupported}
        onToggleWakeLock={() => (wakeLock.isActive ? wakeLock.release() : wakeLock.request())}
        fullscreenActive={fullscreen.isFullscreen}
        fullscreenSupported={fullscreen.isSupported}
        onToggleFullscreen={() => fullscreen.toggle()}
        photosEnabled={photosEnabled}
      />
    </div>
  );
}
