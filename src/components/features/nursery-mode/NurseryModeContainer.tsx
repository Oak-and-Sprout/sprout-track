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
import { Baby } from '@prisma/client';
import { ClockBlock } from './ClockBlock';
import { SceneBackground } from './scenes/SceneBackground';
import { useFeedActions } from './activities/useFeedActions';
import { usePumpActions } from './activities/usePumpActions';
import { useDiaperActions } from './activities/useDiaperActions';
import { useSleepActions } from './activities/useSleepActions';
import { ActivityCard } from './activities/ActivityCard';
import { BigTile } from './activities/BigTile';
import { UndoToast } from './activities/UndoToast';
import { TileLog, UndoInfo } from './activities/types';
import './nursery.css';

const ACT_IDS = ['feed', 'pump', 'diaper', 'sleep'] as const;

const ROW_LABEL: CSSProperties = {
  fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,.5)', marginBottom: 8,
};

function DrawerSlider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={ROW_LABEL}>{label}</div>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} style={{ width: '100%' }} />
    </div>
  );
}

function DrawerSeg({ label, options, value, onChange }: { label: string; options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={ROW_LABEL}>{label}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {options.map(([v, l]) => (
          <button key={v} type="button" onClick={() => onChange(v)}
            style={{ flex: '1 1 auto', minWidth: 70, minHeight: 40, borderRadius: 10, cursor: 'pointer',
              border: '1px solid rgba(255,255,255,.16)', color: '#fff', fontSize: 13,
              background: value === v ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.08)' }}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function DrawerToggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%',
        minHeight: 48, padding: '0 14px', marginBottom: 8, borderRadius: 12, cursor: 'pointer',
        border: '1px solid rgba(255,255,255,.16)', background: 'rgba(255,255,255,.08)', color: '#fff', fontSize: 14 }}>
      <span>{label}</span>
      <span style={{ width: 42, height: 24, borderRadius: 999, position: 'relative', transition: 'background .15s',
        background: on ? '#4ade80' : 'rgba(255,255,255,.2)' }}>
        <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
      </span>
    </button>
  );
}

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

  const handleUndo = useCallback(async () => {
    if (!undo) return;
    const { id, endpoint } = undo;
    const tileId = endpoint.indexOf('diaper') >= 0 ? 'diaper' : 'feed';
    try {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch(`${endpoint}?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: authToken ? `Bearer ${authToken}` : '' },
      });
      const data = await res.json();
      if (data.success) {
        setLogs(prev => {
          const next = { ...prev };
          delete next[tileId];
          return next;
        });
        lastSeenRef.current[tileId] = '';
        if (fetchActivityRef.current) fetchActivityRef.current();
      }
    } catch (err) {
      console.error('Undo failed:', err);
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

  const iconColor = settings.iconColor ?? autoIconColor(settings.hue);
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

      <SceneBackground settings={settings} />

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

      <UndoToast undo={undo} onUndo={handleUndo} onDismiss={() => setUndo(null)} />

      {/* Placeholder drawer — replaced by full SettingsDrawer in Task 12 */}
      {settingsOpen && (
        <>
          <button type="button" aria-label={t('Close')} onClick={() => setSettingsOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,.4)', border: 'none', cursor: 'default' }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 401, width: 'min(360px, 92vw)', overflowY: 'auto',
            padding: 24, background: 'rgba(20,22,31,.96)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            borderLeft: '1px solid rgba(255,255,255,.12)', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('Settings')}</h2>
              <button type="button" className="nursery-ghost" onClick={() => setSettingsOpen(false)}>{t('Close')}</button>
            </div>
            <DrawerSeg label={t('Scene')} value={settings.scene}
              options={[['ambient', t('Ambient')], ['starlit', t('Starlit')], ['tapestry', t('Tapestry')], ['photo', t('Photo')]]}
              onChange={v => updateSettings({ scene: v as any })} />
            <DrawerSeg label={t('Layout')} value={settings.layout}
              options={[['cards', t('Cards')], ['tiles', t('Big Tiles')]]}
              onChange={v => updateSettings({ layout: v as any })} />
            <DrawerSlider label={t('Hue')} value={settings.hue} min={0} max={360} onChange={n => updateSettings({ hue: n })} />
            <DrawerSlider label={t('Dim')} value={settings.dim} min={0} max={100} onChange={n => updateSettings({ dim: n })} />
            <DrawerSlider label={t('Saturation')} value={settings.sat} min={0} max={100} onChange={n => updateSettings({ sat: n })} />
            <DrawerSlider label={t('Button transparency')} value={settings.trans} min={0} max={100} onChange={n => updateSettings({ trans: n })} />
            <div style={ROW_LABEL}>{t('Activities')}</div>
            {ACT_IDS.map(id => (
              <DrawerToggle key={id} label={t(id.charAt(0).toUpperCase() + id.slice(1))} on={settings.acts[id]}
                onClick={() => updateSettings({ acts: { ...settings.acts, [id]: !settings.acts[id] } })} />
            ))}
            <div style={{ ...ROW_LABEL, marginTop: 14 }}>{t('Display')}</div>
            <DrawerToggle label={t('Keep screen awake')} on={wakeLock.isActive}
              onClick={() => (wakeLock.isActive ? wakeLock.release() : wakeLock.request())} />
            {fullscreen.isSupported && (
              <DrawerToggle label={t('Fullscreen')} on={fullscreen.isFullscreen} onClick={() => fullscreen.toggle()} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
