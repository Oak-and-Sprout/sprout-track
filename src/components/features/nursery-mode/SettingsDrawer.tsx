'use client';

import { NurseryColors } from '@/src/hooks/useNurseryColors';
import { useLocalization } from '@/src/context/localization';

interface TileConfig {
  id: string;
  label: string;
  active: boolean;
}

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  hue: number;
  setHue: (hue: number) => void;
  brightness: number;
  setBrightness: (brightness: number) => void;
  saturation: number;
  setSaturation: (saturation: number) => void;
  tiles: TileConfig[];
  toggleTile: (id: string) => void;
  wakeLockActive: boolean;
  wakeLockSupported: boolean;
  fullscreenActive: boolean;
  fullscreenSupported: boolean;
  onToggleFullscreen: () => void;
  colors: NurseryColors;
}

export function SettingsDrawer({
  open, onClose, hue, setHue, brightness, setBrightness,
  saturation, setSaturation,
  tiles, toggleTile, wakeLockActive, wakeLockSupported,
  fullscreenActive, fullscreenSupported, onToggleFullscreen, colors,
}: SettingsDrawerProps) {
  const { t } = useLocalization();

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-[90]"
          style={{ background: 'transparent' }}
        />
      )}
      <div
        className="fixed top-0 right-0 bottom-0 z-[100] overflow-y-auto flex flex-col gap-8 box-border"
        style={{
          width: 'min(360px, 85vw)',
          background: colors.panelBg,
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          padding: 'clamp(1.5rem, 4vw, 2.5rem)',
          borderLeft: `1px solid ${colors.border}`,
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="text-lg font-medium font-sans" style={{ color: colors.text }}>
            {t('Settings')}
          </div>
          <button
            onClick={onClose}
            className="font-sans text-sm cursor-pointer bg-transparent border-none px-2 py-1"
            style={{ color: colors.label }}
          >
            {t('Close')}
          </button>
        </div>

        {/* Wake Lock Status */}
        <div
          className="p-3 rounded-lg"
          style={{
            background: wakeLockActive
              ? (colors.isLight ? 'hsla(150, 30%, 90%, 0.6)' : 'hsla(150, 30%, 20%, 0.3)')
              : (colors.isLight ? 'hsla(40, 30%, 90%, 0.6)' : 'hsla(40, 30%, 20%, 0.3)'),
            border: `1px solid ${colors.border}`,
          }}
        >
          <div
            className="text-xs font-medium tracking-wide uppercase mb-1 font-sans"
            style={{ color: colors.text }}
          >
            {t('Screen Wake Lock')}
          </div>
          <div className="text-sm font-sans" style={{ color: colors.label }}>
            {!wakeLockSupported
              ? t('Wake lock not supported')
              : wakeLockActive
                ? t('Active — screen will stay on')
                : t('Inactive — enable in browser')
            }
          </div>
        </div>

        {/* Fullscreen Toggle */}
        {fullscreenSupported && (
          <button
            onClick={onToggleFullscreen}
            className="p-3 rounded-lg cursor-pointer font-sans text-left outline-none border-none"
            style={{
              background: fullscreenActive
                ? (colors.isLight ? 'hsla(210, 30%, 90%, 0.6)' : 'hsla(210, 30%, 20%, 0.3)')
                : (colors.isLight ? 'hsla(40, 30%, 90%, 0.6)' : 'hsla(40, 30%, 20%, 0.3)'),
              border: `1px solid ${colors.border}`,
            }}
          >
            <div
              className="text-xs font-medium tracking-wide uppercase mb-1"
              style={{ color: colors.text }}
            >
              {t('Fullscreen')}
            </div>
            <div className="text-sm" style={{ color: colors.label }}>
              {fullscreenActive ? t('Active — tap to exit') : t('Inactive — tap to enter')}
            </div>
          </button>
        )}

        {/* Hue Slider */}
        <div>
          <div
            className="text-[0.7rem] font-medium tracking-wider uppercase mb-3 font-sans"
            style={{ color: colors.label }}
          >
            {t('Background Hue')}
          </div>
          <input
            type="range" min="0" max="360" value={hue}
            onChange={(e) => setHue(Number(e.target.value))}
            className="w-full h-3 rounded-sm outline-none cursor-pointer"
            style={{
              WebkitAppearance: 'none',
              appearance: 'none' as any,
              background: `linear-gradient(to right,
                hsl(0,${saturation}%,${colors.isLight ? 70 : 40}%),hsl(60,${saturation}%,${colors.isLight ? 70 : 40}%),
                hsl(120,${saturation}%,${colors.isLight ? 70 : 40}%),hsl(180,${saturation}%,${colors.isLight ? 70 : 40}%),
                hsl(240,${saturation}%,${colors.isLight ? 70 : 40}%),hsl(300,${saturation}%,${colors.isLight ? 70 : 40}%),
                hsl(360,${saturation}%,${colors.isLight ? 70 : 40}%))`,
            }}
          />
          <div className="text-sm italic mt-1 font-serif" style={{ color: colors.label }}>
            {hue}&deg;
          </div>
        </div>

        {/* Dim Slider */}
        <div>
          <div
            className="text-[0.7rem] font-medium tracking-wider uppercase mb-3 font-sans"
            style={{ color: colors.label }}
          >
            {t('Dim')}
          </div>
          <input
            type="range" min="2" max="100" value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="w-full h-3 rounded-sm outline-none cursor-pointer"
            style={{
              WebkitAppearance: 'none',
              appearance: 'none' as any,
              background: `linear-gradient(to right, hsl(${hue},${saturation}%,1%), hsl(${hue},${saturation}%,45%), hsl(${hue},${saturation}%,70%))`,
            }}
          />
          <div className="text-sm italic mt-1 font-serif" style={{ color: colors.label }}>
            {brightness}%
          </div>
        </div>

        {/* Saturation Slider */}
        <div>
          <div
            className="text-[0.7rem] font-medium tracking-wider uppercase mb-3 font-sans"
            style={{ color: colors.label }}
          >
            {t('Saturation')}
          </div>
          <input
            type="range" min="0" max="100" value={saturation}
            onChange={(e) => setSaturation(Number(e.target.value))}
            className="w-full h-3 rounded-sm outline-none cursor-pointer"
            style={{
              WebkitAppearance: 'none',
              appearance: 'none' as any,
              background: `linear-gradient(to right, hsl(${hue},0%,${brightness <= 50 ? (brightness / 50) * 45 : 45 + ((brightness - 50) / 50) * 25}%), hsl(${hue},100%,${brightness <= 50 ? (brightness / 50) * 45 : 45 + ((brightness - 50) / 50) * 25}%))`,
            }}
          />
          <div className="text-sm italic mt-1 font-serif" style={{ color: colors.label }}>
            {saturation}%
          </div>
        </div>

        {/* Activity Tile Toggles */}
        <div>
          <div
            className="text-[0.7rem] font-medium tracking-wider uppercase mb-3 font-sans"
            style={{ color: colors.label }}
          >
            {t('Activity Tiles')}
          </div>
          <div className="flex flex-col gap-2">
            {tiles.map(tile => (
              <button
                key={tile.id}
                onClick={() => toggleTile(tile.id)}
                className="flex justify-between items-center py-2.5 px-3.5 rounded-lg cursor-pointer font-sans text-sm outline-none transition-all duration-150 border-none"
                style={{
                  border: `1px solid ${colors.border}`,
                  background: tile.active ? colors.btnBg : 'transparent',
                  color: colors.text,
                }}
              >
                <span>{tile.label}</span>
                <span
                  className="text-[0.7rem] tracking-wide uppercase"
                  style={{ color: colors.label }}
                >
                  {tile.active ? t('On') : t('Off')}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
