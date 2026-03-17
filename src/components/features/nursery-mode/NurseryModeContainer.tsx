'use client';

import { useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useBaby } from '@/app/context/baby';
import { useTimezone } from '@/app/context/timezone';
import { useLocalization } from '@/src/context/localization';
import { useWakeLock } from '@/src/hooks/useWakeLock';
import { useFullscreen } from '@/src/hooks/useFullscreen';
import { useNurseryColors } from '@/src/hooks/useNurseryColors';
import { useNurserySettings } from '@/src/hooks/useNurserySettings';
import { ChevronDown } from 'lucide-react';
import { Baby } from '@prisma/client';
import { Clock } from './Clock';
import { FeedTile } from './FeedTile';
import { PumpTile } from './PumpTile';
import { DiaperTile } from './DiaperTile';
import { SleepTile } from './SleepTile';
import { SettingsDrawer } from './SettingsDrawer';
import { TileLog } from './TileShell';
import './nursery-animations.css';

interface TileConfig {
  id: string;
  label: string;
  active: boolean;
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
  const { settings, isLoading, saveSettings } = useNurserySettings(null);

  const [hue, setHue] = useState<number | null>(null);
  const [brightness, setBrightness] = useState<number | null>(null);
  const [saturation, setSaturation] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logs, setLogs] = useState<Record<string, TileLog>>({});
  const [animatingTile, setAnimatingTile] = useState<string | null>(null);
  const [babies, setBabies] = useState<Baby[]>([]);
  const [babySwitcherOpen, setBabySwitcherOpen] = useState(false);
  const [expandedTileId, setExpandedTileId] = useState<string | null>(null);
  const [enableBreastMilkTracking, setEnableBreastMilkTracking] = useState(true);
  const [isLandscape, setIsLandscape] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(orientation: landscape) and (max-height: 500px)').matches
  );
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );

  // Listen for orientation and size changes
  useLayoutEffect(() => {
    const landscapeMql = window.matchMedia('(orientation: landscape) and (max-height: 500px)');
    const mobileMql = window.matchMedia('(max-width: 768px)');
    setIsLandscape(landscapeMql.matches);
    setIsMobile(mobileMql.matches);
    const onLandscape = (e: MediaQueryListEvent) => setIsLandscape(e.matches);
    const onMobile = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    landscapeMql.addEventListener('change', onLandscape);
    mobileMql.addEventListener('change', onMobile);
    return () => {
      landscapeMql.removeEventListener('change', onLandscape);
      mobileMql.removeEventListener('change', onMobile);
    };
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
            // Auto-select first baby if none selected
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
  const lastSeenRef = useRef<Record<string, string>>({});

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
            newLogs.feed = { last: time, note: typeLabels[latest.type] || latest.type };
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
            newLogs.diaper = { last: time, note: typeLabels[latest.type] || latest.type };
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
              newLogs.sleep = { last: time, note: dur ? `${latest.location || 'Sleep'} — ${dur}` : (latest.location || 'Sleep') };
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
            newLogs.pump = { last: time, note: actionLabels[latest.pumpAction] || latest.pumpAction };
          }
        }

        if (Object.keys(newLogs).length > 0) {
          setLogs(prev => ({ ...prev, ...newLogs }));
        }
      } catch (err) {
        console.error('Failed to poll activities:', err);
      }
    };

    // Initial fetch
    fetchRecentActivity();

    // Poll every 10 seconds
    pollRef.current = setInterval(fetchRecentActivity, 10000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedBaby?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize from settings once loaded
  const effectiveHue = hue ?? settings.hue;
  const effectiveBrightness = brightness ?? settings.brightness;
  const effectiveSaturation = saturation ?? settings.saturation;

  const colors = useNurseryColors(effectiveHue, effectiveBrightness, effectiveSaturation);

  const tiles = useMemo<TileConfig[]>(() => {
    const allTiles = [
      { id: 'feed', label: t('Feed') },
      { id: 'pump', label: t('Pump') },
      { id: 'diaper', label: t('Diaper') },
      { id: 'sleep', label: t('Sleep') },
    ];
    return allTiles.map(tile => ({
      ...tile,
      active: settings.visibleTiles.includes(tile.id),
    }));
  }, [settings.visibleTiles, t]);

  const activeTiles = tiles.filter(tile => tile.active);

  const handleLog = useCallback((tileId: string, note: string) => {
    const now = new Date()
      .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      .toLowerCase();
    setLogs(prev => ({ ...prev, [tileId]: { last: now, note } }));
    setAnimatingTile(tileId);
    setTimeout(() => setAnimatingTile(null), 600);
  }, []);

  const currentSettings = useCallback(() => ({
    ...settings,
    hue: hue ?? settings.hue,
    brightness: brightness ?? settings.brightness,
    saturation: saturation ?? settings.saturation,
  }), [settings, hue, brightness, saturation]);

  const handleHueChange = useCallback((newHue: number) => {
    setHue(newHue);
    saveSettings({ ...currentSettings(), hue: newHue });
  }, [currentSettings, saveSettings]);

  const handleBrightnessChange = useCallback((newBrightness: number) => {
    setBrightness(newBrightness);
    saveSettings({ ...currentSettings(), brightness: newBrightness });
  }, [currentSettings, saveSettings]);

  const handleSaturationChange = useCallback((newSaturation: number) => {
    setSaturation(newSaturation);
    saveSettings({ ...currentSettings(), saturation: newSaturation });
  }, [currentSettings, saveSettings]);

  const toggleTile = useCallback((id: string) => {
    const newVisible = settings.visibleTiles.includes(id)
      ? settings.visibleTiles.filter(t => t !== id)
      : [...settings.visibleTiles, id];
    saveSettings({ ...currentSettings(), visibleTiles: newVisible });
  }, [settings.visibleTiles, currentSettings, saveSettings]);

  const handleActiveChange = useCallback((tileId: string, isActive: boolean) => {
    setExpandedTileId(prev => isActive ? tileId : (prev === tileId ? null : prev));
  }, []);

  const handleExit = useCallback(() => {
    wakeLock.release();
    if (fullscreen.isFullscreen) fullscreen.exit();
    router.push(`/${slug}/log-entry`);
  }, [wakeLock, fullscreen, router, slug]);

  // Dim: 0-50% → 0-45% lightness, 50-100% → 45-70% lightness
  const dimL = effectiveBrightness <= 50
    ? (effectiveBrightness / 50) * 45
    : 45 + ((effectiveBrightness - 50) / 50) * 25;
  const sat = effectiveSaturation;

  // Base background gradient
  const baseBg = `linear-gradient(165deg,
    hsl(${effectiveHue}, ${sat}%, ${dimL}%) 0%,
    hsl(${(effectiveHue + 8) % 360}, ${sat * 0.9}%, ${Math.max(dimL - 2, 1)}%) 100%)`;

  // Lava lamp blob colors — wider hue shifts ±25-40 degrees for more color variation
  const h = effectiveHue;
  const blob1Color = `hsla(${(h + 40) % 360}, ${Math.min(sat * 1.4, 100)}%, ${Math.min(dimL + 3, 48)}%, 0.7)`;
  const blob2Color = `hsla(${(h - 30 + 360) % 360}, ${Math.min(sat * 1.2, 100)}%, ${Math.min(dimL + 8, 50)}%, 0.6)`;
  const blob3Color = `hsla(${(h + 25) % 360}, ${Math.min(sat * 1.3, 100)}%, ${Math.min(dimL + 5, 48)}%, 0.55)`;

  const tileComponents: Record<string, React.ComponentType<any>> = {
    feed: FeedTile,
    pump: PumpTile,
    diaper: DiaperTile,
    sleep: SleepTile,
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: '#0a0a1a' }}>
        <div className="text-white/50 text-sm font-sans">{t('Loading')}...</div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none; width: 36px; height: 36px;
          border-radius: 50%; background: white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.25); cursor: pointer;
        }
        * { -webkit-tap-highlight-color: transparent; }
        @supports (padding-top: env(safe-area-inset-top)) {
          .nursery-safe-area {
            padding-top: env(safe-area-inset-top) !important;
            padding-left: env(safe-area-inset-left) !important;
            padding-right: env(safe-area-inset-right) !important;
            padding-bottom: env(safe-area-inset-bottom) !important;
          }
        }
        @supports (backdrop-filter: url(#liquid-glass)) {
          .liquid-glass-tile {
            backdrop-filter: url(#liquid-glass) blur(20px) brightness(1.05) saturate(1.3) !important;
            -webkit-backdrop-filter: url(#liquid-glass) blur(20px) brightness(1.05) saturate(1.3) !important;
          }
          .liquid-glass-btn {
            backdrop-filter: url(#liquid-glass) blur(12px) brightness(1.05) saturate(1.2) !important;
            -webkit-backdrop-filter: url(#liquid-glass) blur(12px) brightness(1.05) saturate(1.2) !important;
          }
        }
        @supports not (backdrop-filter: url(#liquid-glass)) {
          .liquid-glass-tile {
            backdrop-filter: blur(20px) brightness(1.05) saturate(1.3) !important;
            -webkit-backdrop-filter: blur(20px) brightness(1.05) saturate(1.3) !important;
          }
          .liquid-glass-btn {
            backdrop-filter: blur(12px) brightness(1.05) saturate(1.2) !important;
            -webkit-backdrop-filter: blur(12px) brightness(1.05) saturate(1.2) !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .liquid-glass-tile, .liquid-glass-btn {
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
          }
        }
      `}</style>

      <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
        <defs>
          <filter id="liquid-glass" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves={3} seed={2} result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={6} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      <div
        className="fixed inset-0 z-[9999] flex flex-col font-sans overflow-hidden nursery-safe-area"
        style={{
          background: baseBg,
          animation: 'nursery-hueShift 45s ease-in-out infinite',
        }}
      >
        {/* Lava lamp blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div
            className="absolute rounded-full"
            style={{
              width: '130%',
              height: '80%',
              left: '-15%',
              bottom: '-20%',
              background: `radial-gradient(ellipse at center, ${blob1Color}, transparent 70%)`,
              animation: 'nursery-blob1 30s ease-in-out infinite',
              willChange: 'transform',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              width: '100%',
              height: '70%',
              right: '-10%',
              top: '-15%',
              background: `radial-gradient(ellipse at center, ${blob2Color}, transparent 65%)`,
              animation: 'nursery-blob2 25s ease-in-out infinite',
              willChange: 'transform',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              width: '90%',
              height: '60%',
              left: '5%',
              top: '20%',
              background: `radial-gradient(ellipse at center, ${blob3Color}, transparent 60%)`,
              animation: 'nursery-blob3 35s ease-in-out infinite',
              willChange: 'transform',
            }}
          />
        </div>

        {/* Header — landscape: clock + baby inline with buttons; portrait: buttons only */}
        <div
          className="flex items-center flex-shrink-0"
          style={{
            paddingTop: isLandscape ? 'clamp(0.5rem, 1.5vw, 0.75rem)' : 'clamp(1rem, 3vw, 2rem)',
            paddingRight: isLandscape ? 'clamp(1rem, 3vw, 2rem)' : 'clamp(1.25rem, 4vw, 2.5rem)',
            paddingBottom: 0,
            paddingLeft: isLandscape ? 'clamp(1rem, 3vw, 2rem)' : 'clamp(1.25rem, 4vw, 2.5rem)',
            justifyContent: isLandscape ? 'space-between' : 'flex-end',
          }}
        >
          {isLandscape && (
            <div className="flex items-center gap-4">
              <Clock colors={colors} compact />
              <div className="relative flex flex-col items-start">
                <button
                  onClick={() => babies.length > 1 && setBabySwitcherOpen(!babySwitcherOpen)}
                  className="bg-transparent border-none p-0 flex items-center gap-1.5 cursor-pointer text-left"
                  style={{ cursor: babies.length > 1 ? 'pointer' : 'default' }}
                >
                  <div
                    className="text-[clamp(0.8rem,1.8vw,1rem)] font-light tracking-tight font-serif"
                    style={{ color: colors.text, opacity: 0.7 }}
                  >
                    {selectedBaby ? selectedBaby.firstName : t('Sprout Track')}
                  </div>
                  {babies.length > 1 && (
                    <ChevronDown
                      size={14}
                      style={{
                        color: colors.text,
                        opacity: 0.6,
                        transform: babySwitcherOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                      }}
                    />
                  )}
                </button>
                {babySwitcherOpen && babies.length > 1 && (
                  <>
                    <div
                      className="fixed inset-0 z-[100]"
                      onClick={() => setBabySwitcherOpen(false)}
                    />
                    <div
                      className="absolute top-full left-0 mt-2 z-[101] rounded-lg overflow-hidden"
                      style={{
                        background: colors.panelBg,
                        backdropFilter: 'blur(40px)',
                        WebkitBackdropFilter: 'blur(40px)',
                        border: `1px solid ${colors.border}`,
                        minWidth: '140px',
                        animation: 'nursery-fadeIn 0.15s ease',
                      }}
                    >
                      {babies.map((baby) => (
                        <button
                          key={baby.id}
                          onClick={() => {
                            setSelectedBaby(baby);
                            setBabySwitcherOpen(false);
                            setLogs({});
                            lastSeenRef.current = {};
                          }}
                          className="w-full text-left bg-transparent border-none font-serif text-sm py-2.5 px-4 cursor-pointer transition-colors duration-100"
                          style={{
                            color: colors.text,
                            opacity: selectedBaby?.id === baby.id ? 1 : 0.6,
                            background: selectedBaby?.id === baby.id ? colors.btnBg : 'transparent',
                          }}
                        >
                          {baby.firstName}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center gap-6">
            <button
              onClick={() => setSettingsOpen(true)}
              className="bg-transparent border-none font-sans text-[clamp(0.85rem,1.8vw,1rem)] cursor-pointer py-1 px-0 tracking-wide"
              style={{ color: colors.text, opacity: 0.45 }}
            >
              {t('Settings')}
            </button>
            <button
              onClick={handleExit}
              className="bg-transparent border-none font-sans text-[clamp(0.85rem,1.8vw,1rem)] cursor-pointer py-1 px-0 tracking-wide"
              style={{ color: colors.text, opacity: 0.45 }}
            >
              {t('Exit')}
            </button>
          </div>
        </div>

        {/* Clock + Baby Selector — portrait only */}
        {!isLandscape && (
          <div
            className="flex-shrink-0 flex items-center justify-center"
            style={{ padding: 'clamp(1.25rem, 4vw, 3rem) 0 clamp(0.75rem, 2.5vw, 1.5rem)' }}
          >
            <div className="flex items-center gap-8">
              <Clock colors={colors} />
              <div className="relative flex flex-col items-start">
                <button
                  onClick={() => babies.length > 1 && setBabySwitcherOpen(!babySwitcherOpen)}
                  className="bg-transparent border-none p-0 flex items-center gap-1.5 cursor-pointer text-left"
                  style={{ cursor: babies.length > 1 ? 'pointer' : 'default' }}
                >
                  <div
                    className="text-[clamp(1rem,2.2vw,1.2rem)] font-light tracking-tight font-serif"
                    style={{ color: colors.text, opacity: 0.7 }}
                  >
                    {selectedBaby ? selectedBaby.firstName : t('Sprout Track')}
                  </div>
                  {babies.length > 1 && (
                    <ChevronDown
                      size={18}
                      style={{
                        color: colors.text,
                        opacity: 0.6,
                        transform: babySwitcherOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                      }}
                    />
                  )}
                </button>
                {babySwitcherOpen && babies.length > 1 && (
                  <>
                    <div
                      className="fixed inset-0 z-[100]"
                      onClick={() => setBabySwitcherOpen(false)}
                    />
                    <div
                      className="absolute top-full left-0 mt-2 z-[101] rounded-lg overflow-hidden"
                      style={{
                        background: colors.panelBg,
                        backdropFilter: 'blur(40px)',
                        WebkitBackdropFilter: 'blur(40px)',
                        border: `1px solid ${colors.border}`,
                        minWidth: '140px',
                        animation: 'nursery-fadeIn 0.15s ease',
                      }}
                    >
                      {babies.map((baby) => (
                        <button
                          key={baby.id}
                          onClick={() => {
                            setSelectedBaby(baby);
                            setBabySwitcherOpen(false);
                            setLogs({});
                            lastSeenRef.current = {};
                          }}
                          className="w-full text-left bg-transparent border-none font-serif text-sm py-2.5 px-4 cursor-pointer transition-colors duration-100"
                          style={{
                            color: colors.text,
                            opacity: selectedBaby?.id === baby.id ? 1 : 0.6,
                            background: selectedBaby?.id === baby.id ? colors.btnBg : 'transparent',
                          }}
                        >
                          {baby.firstName}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tiles */}
        <div
          className="flex-1 flex justify-center overflow-hidden"
          style={{
            padding: isLandscape
              ? 'clamp(0.25rem, 1vw, 0.5rem) clamp(1rem, 3vw, 2rem)'
              : '0 clamp(1.25rem, 4vw, 2.5rem) clamp(1rem, 2.5vw, 1.5rem)',
            alignItems: isMobile ? 'stretch' : 'flex-start',
          }}
        >
          <div
            className={isMobile ? 'flex flex-col w-full' : 'grid w-full'}
            style={{
              maxWidth: isLandscape ? '100%' : '620px',
              gap: expandedTileId ? '0' : 'clamp(0.5rem, 1.3vw, 0.75rem)',
              ...(!isMobile && {
                gridTemplateColumns: expandedTileId || activeTiles.length === 1 ? '1fr' : '1fr 1fr',
              }),
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {activeTiles.map(tile => {
              const Component = tileComponents[tile.id];
              if (!Component || !selectedBaby) return null;
              const isExpanded = expandedTileId === tile.id;
              const isHidden = expandedTileId != null && !isExpanded;
              return (
                <div
                  key={tile.id}
                  style={{
                    flex: isMobile && !isHidden ? 1 : undefined,
                    minHeight: 0,
                    opacity: isHidden ? 0 : 1,
                    maxHeight: isHidden ? 0 : undefined,
                    overflow: 'hidden',
                    transition: 'opacity 0.3s ease, max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), flex 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  <Component
                    colors={colors}
                    log={logs[tile.id] || null}
                    onLog={handleLog}
                    onActiveChange={handleActiveChange}
                    animating={animatingTile === tile.id}
                    babyId={selectedBaby.id}
                    toUTCString={toUTCString}
                    expanded={isExpanded}
                    enableBreastMilkTracking={enableBreastMilkTracking}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer — hidden in landscape to save space */}
        {!isLandscape && (
          <div className="pb-[clamp(0.75rem,2vw,1.25rem)] text-center flex flex-col items-center gap-1">
            <span
              className="font-sans text-[clamp(0.55rem,1.2vw,0.7rem)] tracking-widest uppercase"
              style={{ color: colors.text, opacity: 0.35 }}
            >
              {t('Nursery Mode')}
            </span>
            <span
              className="font-sans text-[0.6rem] tracking-wider uppercase"
              style={{
                color: colors.text,
                opacity: 0.25,
                animation: wakeLock.isActive ? 'nursery-gentlePulse 4s ease-in-out infinite' : 'none',
              }}
            >
              {wakeLock.isActive ? t('Screen lock active') : wakeLock.isSupported ? t('Requesting wake lock...') : t('Wake lock not supported')}
            </span>
          </div>
        )}

        {/* Settings Drawer */}
        <SettingsDrawer
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          hue={effectiveHue}
          setHue={handleHueChange}
          brightness={effectiveBrightness}
          setBrightness={handleBrightnessChange}
          saturation={effectiveSaturation}
          setSaturation={handleSaturationChange}
          tiles={tiles}
          toggleTile={toggleTile}
          wakeLockActive={wakeLock.isActive}
          wakeLockSupported={wakeLock.isSupported}
          fullscreenActive={fullscreen.isFullscreen}
          fullscreenSupported={fullscreen.isSupported}
          onToggleFullscreen={() => fullscreen.toggle()}
          colors={colors}
        />
      </div>
    </>
  );
}
