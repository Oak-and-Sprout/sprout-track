'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logs, setLogs] = useState<Record<string, TileLog>>({});
  const [animatingTile, setAnimatingTile] = useState<string | null>(null);
  const [babies, setBabies] = useState<Baby[]>([]);
  const [babySwitcherOpen, setBabySwitcherOpen] = useState(false);
  const [expandedTileId, setExpandedTileId] = useState<string | null>(null);

  // Fetch babies list
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
            setBabies(data.data.filter((b: Baby) => !b.inactive));
          }
        }
      } catch (err) {
        console.error('Failed to fetch babies:', err);
      }
    };
    fetchBabies();
  }, []);

  // Initialize from settings once loaded
  const effectiveHue = hue ?? settings.hue;
  const effectiveBrightness = brightness ?? settings.brightness;

  const colors = useNurseryColors(effectiveHue, effectiveBrightness);

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

  const handleHueChange = useCallback((newHue: number) => {
    setHue(newHue);
    saveSettings({ ...settings, hue: newHue, brightness: brightness ?? settings.brightness });
  }, [settings, brightness, saveSettings]);

  const handleBrightnessChange = useCallback((newBrightness: number) => {
    setBrightness(newBrightness);
    saveSettings({ ...settings, hue: hue ?? settings.hue, brightness: newBrightness });
  }, [settings, hue, saveSettings]);

  const toggleTile = useCallback((id: string) => {
    const newVisible = settings.visibleTiles.includes(id)
      ? settings.visibleTiles.filter(t => t !== id)
      : [...settings.visibleTiles, id];
    saveSettings({
      hue: hue ?? settings.hue,
      brightness: brightness ?? settings.brightness,
      visibleTiles: newVisible,
    });
  }, [settings, hue, brightness, saveSettings]);

  const handleActiveChange = useCallback((tileId: string, isActive: boolean) => {
    setExpandedTileId(prev => isActive ? tileId : (prev === tileId ? null : prev));
  }, []);

  const handleExit = useCallback(() => {
    wakeLock.release();
    if (fullscreen.isFullscreen) fullscreen.exit();
    router.push(`/${slug}/log-entry`);
  }, [wakeLock, fullscreen, router, slug]);

  // Base background gradient
  const baseBg = `linear-gradient(165deg,
    hsl(${effectiveHue}, 20%, ${effectiveBrightness}%) 0%,
    hsl(${(effectiveHue + 8) % 360}, 18%, ${Math.max(effectiveBrightness - 2, 3)}%) 100%)`;

  // Lava lamp blob colors — hue shifts ±8-20 degrees, higher saturation for visibility
  const b = effectiveBrightness;
  const h = effectiveHue;
  const blob1Color = `hsla(${(h + 20) % 360}, 35%, ${Math.max(b + 3, 8)}%, 0.7)`;
  const blob2Color = `hsla(${(h - 15 + 360) % 360}, 30%, ${Math.max(b + 8, 12)}%, 0.6)`;
  const blob3Color = `hsla(${(h + 10) % 360}, 32%, ${Math.max(b + 5, 10)}%, 0.55)`;

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
          -webkit-appearance: none; width: 18px; height: 18px;
          border-radius: 50%; background: white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.25); cursor: pointer;
        }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>

      <div
        className="fixed inset-0 z-[9999] flex flex-col font-sans overflow-hidden"
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

        {/* Header */}
        <div
          className="flex justify-between items-start"
          style={{ padding: 'clamp(1rem, 3vw, 2rem) clamp(1.25rem, 4vw, 2.5rem)', paddingBottom: 0 }}
        >
          <div className="relative">
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
            <div
              className="text-[clamp(0.55rem,1.2vw,0.7rem)] font-normal tracking-widest uppercase mt-0.5 font-sans"
              style={{ color: colors.text, opacity: 0.35 }}
            >
              {t('Nursery Mode')}
            </div>

            {/* Baby switcher dropdown */}
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

        {/* Clock */}
        <div
          className="flex-shrink-0 flex items-center justify-center"
          style={{ padding: 'clamp(1.25rem, 4vw, 3rem) 0 clamp(0.75rem, 2.5vw, 1.5rem)' }}
        >
          <Clock colors={colors} />
        </div>

        {/* Tiles */}
        <div
          className="flex-1 flex items-start justify-center overflow-hidden"
          style={{ padding: '0 clamp(1.25rem, 4vw, 2.5rem) clamp(1rem, 2.5vw, 1.5rem)' }}
        >
          <div
            className="grid w-full max-w-[620px]"
            style={{
              gap: expandedTileId ? '0' : 'clamp(0.5rem, 1.3vw, 0.75rem)',
              gridTemplateColumns: expandedTileId || activeTiles.length === 1 ? '1fr' : '1fr 1fr',
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
                    opacity: isHidden ? 0 : 1,
                    maxHeight: isHidden ? 0 : '500px',
                    overflow: 'hidden',
                    transition: 'opacity 0.3s ease, max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
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
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Wake lock status */}
        <div className="pb-[clamp(0.75rem,2vw,1.25rem)] text-center">
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

        {/* Settings Drawer */}
        <SettingsDrawer
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          hue={effectiveHue}
          setHue={handleHueChange}
          brightness={effectiveBrightness}
          setBrightness={handleBrightnessChange}
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
