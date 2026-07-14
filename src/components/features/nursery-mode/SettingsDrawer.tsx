'use client';

import { useRef, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { useLocalization } from '@/src/context/localization';
import {
  NurserySettings,
  NurseryScene,
  NurseryLayout,
  PALETTES,
  BASE_CHIPS,
  ICON_SWATCHES,
  CSS_BACKDROPS,
} from '@/src/utils/nursery/settings';
import { SPRITE_SETS, RUGS, rugUrl } from './spriteManifest';
import { backdropStyle, isRug } from './scenes/backdropStyle';
import { baseGrad } from './scenes/SceneBackground';
import { photoIdFromSrc } from './scenes/PhotoScene';
import { Icon, IconName } from './icons';
import { SpriteThumb } from './drawer/SpriteThumb';
import { RugThumb, RugPreviewDiv } from './drawer/RugThumb';
import { PhotoPicker, PickerThumb } from './PhotoPicker';

export interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  settings: NurserySettings;
  updateSettings: (patch: Partial<NurserySettings>) => void;
  wakeLockActive: boolean;
  wakeLockSupported: boolean;
  onToggleWakeLock: () => void;
  fullscreenActive: boolean;
  fullscreenSupported: boolean;
  onToggleFullscreen: () => void;
  /** Deployment-wide photos feature flag; the Photo section shows a disabled note when false. */
  photosEnabled: boolean;
}

const AMBIENT_PATTERNS: [string, string][] = [
  ['aurora', 'Aurora'],
  ['waves', 'Waves'],
  ['bubbles', 'Bubbles'],
];

const SCENES: [NurseryScene, string][] = [
  ['ambient', 'Ambient'],
  ['starlit', 'Starlit'],
  ['tapestry', 'Tapestry'],
  ['photo', 'Photo'],
];

const ACT_ROWS: { id: keyof NurserySettings['acts']; icon: IconName; label: string }[] = [
  { id: 'feed', icon: 'bottle', label: 'Feed' },
  { id: 'pump', icon: 'pump', label: 'Pump' },
  { id: 'diaper', icon: 'diaper', label: 'Diaper' },
  { id: 'sleep', icon: 'moon', label: 'Sleep' },
];

/** Flat gray thumb-drag track used by most contextual sliders (nursery.jsx:566 etc). */
const NEUTRAL_TRACK: CSSProperties = { background: 'linear-gradient(90deg,rgba(255,255,255,.1),rgba(255,255,255,.45))' };

/** Layered wave SVG data-URI for the Waves pattern preview swatch. Duplicated (tiny) from AmbientScene's wavesUri — nursery.jsx:219. */
const wavesPreviewUri = (h: number): string => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100' preserveAspectRatio='none'><path d='M0 50 C22 40 38 60 55 50 S86 40 100 50 L100 100 0 100Z' fill='hsl(${h},40%,44%)'/><path d='M0 63 C22 54 40 74 56 63 S86 54 100 63 L100 100 0 100Z' fill='hsl(${(h + 18) % 360},42%,38%)'/><path d='M0 77 C24 69 40 88 58 77 S86 69 100 77 L100 100 0 100Z' fill='hsl(${(h + 34) % 360},44%,31%)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

/** Small (46px) preview style for the Ambient background pattern swatches. Ported from nursery.jsx:309-314 (patternStyle), aurora/waves/bubbles branches only. */
function patternPreviewStyle(pattern: string, h: number): CSSProperties {
  if (pattern === 'waves') {
    return { background: `${wavesPreviewUri(h)} bottom/cover no-repeat, ${baseGrad(h)}` };
  }
  if (pattern === 'bubbles') {
    return {
      background: `radial-gradient(circle at 24% 78%, hsla(${h},60%,88%,.16) 0 26px, transparent 27px), radial-gradient(circle at 62% 40%, hsla(${h},60%,88%,.13) 0 15px, transparent 16px), radial-gradient(circle at 84% 72%, hsla(${h},60%,88%,.15) 0 20px, transparent 21px), ${baseGrad(h)}`,
    };
  }
  return {
    background: `radial-gradient(58% 58% at 18% 18%, oklch(0.68 0.16 ${(h + 20) % 360}/.85), transparent 60%), radial-gradient(60% 60% at 86% 26%, oklch(0.6 0.17 ${(h + 70) % 360}/.75), transparent 60%), radial-gradient(70% 70% at 55% 108%, oklch(0.58 0.15 ${(h - 40 + 360) % 360}/.7), transparent 62%), ${baseGrad(h)}`,
  };
}

/** Scene-tile preview style for Ambient/Starlit/Photo. Ported exactly from nursery.jsx scenePrev (507-512). Tapestry is handled separately (rug/backdrop). */
function scenePreviewStyle(m: NurseryScene, hue: number): CSSProperties {
  if (m === 'ambient') return patternPreviewStyle('aurora', hue);
  if (m === 'starlit') {
    return {
      background: `radial-gradient(1px 1px at 22% 34%,#fff,transparent),radial-gradient(1px 1px at 62% 22%,#fff,transparent),radial-gradient(1.4px 1.4px at 78% 60%,#fff,transparent),radial-gradient(1px 1px at 40% 70%,#fff,transparent),radial-gradient(120% 90% at 50% 10%, oklch(0.3 0.09 ${hue}), oklch(0.1 0.05 ${hue}))`,
    };
  }
  return { background: `linear-gradient(180deg,oklch(0.3 0.05 ${hue}),oklch(0.16 0.05 ${hue}))` };
}

/** "NONE" object-picker placeholder swatch. Ported from nursery.jsx:607/612. */
const noneSwatchStyle = (base: string): CSSProperties => ({
  background: base,
  display: 'grid',
  placeItems: 'center',
  color: 'rgba(0,0,0,.45)',
  fontSize: 12,
  fontWeight: 700,
});

const rugFileForBackdrop = (id: string): string => {
  const rug = RUGS.find(r => r.id === id);
  return rug ? rugUrl(rug.file) : '';
};

export function SettingsDrawer({
  open,
  onClose,
  settings,
  updateSettings,
  wakeLockActive,
  wakeLockSupported,
  onToggleWakeLock,
  fullscreenActive,
  fullscreenSupported,
  onToggleFullscreen,
  photosEnabled,
}: SettingsDrawerProps): ReactElement | null {
  const { t } = useLocalization();
  // Tracks whether the caretaker manually touched Primary/Accent this session,
  // so picking a CSS backdrop only auto-restores the default objects the
  // first time (PRD §5.3) — not after the caretaker has deliberately cleared them.
  const objectsTouchedRef = useRef(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!open) return null;

  const tapestry = settings.tapestry;
  const ambient = settings.ambient;

  const handleBackdropSelect = (id: string) => {
    if (tapestry.primary === null && tapestry.accent === null && !objectsTouchedRef.current) {
      updateSettings({ tapestry: { ...tapestry, backdrop: id, primary: 'teddy', accent: 'stars' } });
    } else {
      updateSettings({ tapestry: { ...tapestry, backdrop: id } });
    }
  };

  const handleRugSelect = (id: string) => {
    updateSettings({ tapestry: { ...tapestry, backdrop: id, primary: null, accent: null } });
  };

  const handleObjectSelect = (which: 'primary' | 'accent', value: string | null) => {
    objectsTouchedRef.current = true;
    updateSettings({ tapestry: { ...tapestry, [which]: value } });
  };

  const handlePaletteSelect = (palette: 'boys' | 'girls') => {
    updateSettings({ tapestry: { ...tapestry, palette, base: PALETTES[palette].base, colors: PALETTES[palette].colors } });
  };

  return (
    <>
      <div className="nursery-ovl" onClick={onClose} />
      <div className="nursery-drawer">
        <div className="nursery-dw-h">
          <h2>{t('Settings')}</h2>
          <button type="button" className="close" onClick={onClose}>{t('Close')}</button>
        </div>
        <div className="nursery-dw-b">

          {/* Scene */}
          <div className="nursery-sect">
            <div className="nursery-slabel">{t('Scene')}</div>
            <div className="nursery-scenes">
              {SCENES.map(([m, labelKey]) => (
                <button key={m} type="button" className={'nursery-scene' + (settings.scene === m ? ' on' : '')} onClick={() => updateSettings({ scene: m })}>
                  {m === 'tapestry' ? (
                    isRug(tapestry.backdrop) ? (
                      <RugPreviewDiv file={rugFileForBackdrop(tapestry.backdrop)} base={tapestry.base} colors={tapestry.colors} className="prev" />
                    ) : (
                      <div className="prev" style={backdropStyle(tapestry.backdrop, tapestry.base)} />
                    )
                  ) : (
                    <div className="prev" style={scenePreviewStyle(m, settings.hue)}>
                      {m === 'photo' && <Icon n="image" s={22} />}
                    </div>
                  )}
                  <div className="nm">{t(labelKey)}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Layout */}
          <div className="nursery-sect">
            <div className="nursery-slabel">{t('Layout')}</div>
            <div className="nursery-seg">
              {(['cards', 'tiles'] as NurseryLayout[]).map(v => (
                <button key={v} type="button" className={settings.layout === v ? 'on' : ''} onClick={() => updateSettings({ layout: v })}>
                  {t(v === 'cards' ? 'Cards' : 'Big Tiles')}
                </button>
              ))}
            </div>
          </div>

          {/* Ambient background */}
          {settings.scene === 'ambient' && (
            <div className="nursery-sect">
              <div className="nursery-slabel">{t('Background')}</div>
              <div className="nursery-patts">
                {AMBIENT_PATTERNS.map(([v, labelKey]) => (
                  <button key={v} type="button" className={'nursery-patt' + (ambient.pattern === v ? ' on' : '')} onClick={() => updateSettings({ ambient: { ...ambient, pattern: v } })}>
                    <div className="pp" style={patternPreviewStyle(v, settings.hue)} />
                    <div className="pl">{t(labelKey)}</div>
                  </button>
                ))}
                {SPRITE_SETS.map(s => (
                  <SpriteThumb
                    key={s.id}
                    setId={s.id}
                    mode="outline"
                    hue={settings.hue}
                    selected={ambient.pattern === 'sprite:' + s.id}
                    onClick={() => updateSettings({ ambient: { ...ambient, pattern: 'sprite:' + s.id } })}
                    label={t(s.label)}
                  />
                ))}
              </div>

              {ambient.pattern === 'aurora' && (
                <>
                  <div className="nursery-slabel" style={{ marginTop: 18 }}>{t('Color range')}</div>
                  <input
                    className="nursery-srange"
                    style={{ background: `linear-gradient(90deg, oklch(0.6 0.15 ${settings.hue}), oklch(0.65 0.17 ${(settings.hue + 60) % 360}), oklch(0.65 0.17 ${(settings.hue + 140) % 360}))` }}
                    type="range" min={0} max={100} value={ambient.auroraRange}
                    onChange={e => updateSettings({ ambient: { ...ambient, auroraRange: Number(e.target.value) } })}
                  />
                  <div className="nursery-sval">
                    {ambient.auroraRange < 15 ? t('Subtle') : ambient.auroraRange > 80 ? t('Full spectrum') : `${ambient.auroraRange}%`}
                  </div>
                </>
              )}

              {ambient.pattern === 'waves' && (
                <>
                  <div className="nursery-slabel" style={{ marginTop: 18 }}>{t('Motion')}</div>
                  <input
                    className="nursery-srange" style={NEUTRAL_TRACK}
                    type="range" min={0} max={100} value={ambient.waveMotion}
                    onChange={e => updateSettings({ ambient: { ...ambient, waveMotion: Number(e.target.value) } })}
                  />
                  <div className="nursery-sval">{ambient.waveMotion === 0 ? t('Still') : `${ambient.waveMotion}%`}</div>
                </>
              )}

              {ambient.pattern.indexOf('sprite:') === 0 && (
                <>
                  <div className="nursery-slabel" style={{ marginTop: 18 }}>{t('Rotation')}</div>
                  <input
                    className="nursery-srange" style={NEUTRAL_TRACK}
                    type="range" min={0} max={100} value={ambient.rot}
                    onChange={e => updateSettings({ ambient: { ...ambient, rot: Number(e.target.value) } })}
                  />
                  <div className="nursery-sval">{ambient.rot === 0 ? t('Upright') : `${ambient.rot}%`}</div>

                  <div className="nursery-slabel" style={{ marginTop: 14 }}>{t('Movement')}</div>
                  <input
                    className="nursery-srange" style={NEUTRAL_TRACK}
                    type="range" min={0} max={100} value={ambient.move}
                    onChange={e => updateSettings({ ambient: { ...ambient, move: Number(e.target.value) } })}
                  />
                  <div className="nursery-sval">{ambient.move === 0 ? t('Pattern — static') : `${t('Free float')} ${ambient.move}%`}</div>

                  <div className="nursery-slabel" style={{ marginTop: 14 }}>{t('Icon size')}</div>
                  <input
                    className="nursery-srange" style={NEUTRAL_TRACK}
                    type="range" min={0} max={100} value={ambient.size}
                    onChange={e => updateSettings({ ambient: { ...ambient, size: Number(e.target.value) } })}
                  />
                  <div className="nursery-sval">{ambient.size <= 2 ? t('Fixed size') : `${t('Varied')} ${ambient.size}%`}</div>
                </>
              )}

              {ambient.pattern === 'bubbles' && (
                <>
                  <div className="nursery-slabel" style={{ marginTop: 18 }}>{t('Bubbles')}</div>
                  <input
                    className="nursery-srange" style={NEUTRAL_TRACK}
                    type="range" min={4} max={80} value={ambient.bubbles.count}
                    onChange={e => updateSettings({ ambient: { ...ambient, bubbles: { ...ambient.bubbles, count: Number(e.target.value) } } })}
                  />
                  <div className="nursery-sval">{ambient.bubbles.count} {t('bubbles')}</div>

                  <div className="nursery-slabel" style={{ marginTop: 14 }}>{t('Min size')}</div>
                  <input
                    className="nursery-srange" style={NEUTRAL_TRACK}
                    type="range" min={4} max={80} value={ambient.bubbles.min}
                    onChange={e => updateSettings({ ambient: { ...ambient, bubbles: { ...ambient.bubbles, min: Number(e.target.value) } } })}
                  />
                  <div className="nursery-sval">{ambient.bubbles.min}px</div>

                  <div className="nursery-slabel" style={{ marginTop: 14 }}>{t('Max size')}</div>
                  <input
                    className="nursery-srange" style={NEUTRAL_TRACK}
                    type="range" min={10} max={160} value={ambient.bubbles.max}
                    onChange={e => updateSettings({ ambient: { ...ambient, bubbles: { ...ambient.bubbles, max: Number(e.target.value) } } })}
                  />
                  <div className="nursery-sval">{ambient.bubbles.max}px</div>
                </>
              )}
            </div>
          )}

          {/* Tapestry */}
          {settings.scene === 'tapestry' && (
            <div className="nursery-sect">
              <div className="nursery-slabel">{t('Backdrop')}</div>
              <div className="nursery-patts">
                {CSS_BACKDROPS.map(b => (
                  <button key={b.id} type="button" className={'nursery-patt' + (tapestry.backdrop === b.id ? ' on' : '')} onClick={() => handleBackdropSelect(b.id)}>
                    <div className="pp" style={backdropStyle(b.id, tapestry.base)} />
                    <div className="pl">{t(b.label)}</div>
                  </button>
                ))}
                {RUGS.map(r => (
                  <RugThumb
                    key={r.id}
                    file={rugUrl(r.file)}
                    base={tapestry.base}
                    colors={tapestry.colors}
                    selected={tapestry.backdrop === r.id}
                    onClick={() => handleRugSelect(r.id)}
                    label={t(r.label)}
                  />
                ))}
              </div>

              <div className="nursery-slabel" style={{ marginTop: 18 }}>{t('Primary object')}</div>
              <div className="nursery-patts">
                <button type="button" className={'nursery-patt' + (tapestry.primary === null ? ' on' : '')} onClick={() => handleObjectSelect('primary', null)}>
                  <div className="pp" style={noneSwatchStyle(tapestry.base)}>{t('NONE')}</div>
                  <div className="pl">{t('None')}</div>
                </button>
                {SPRITE_SETS.map(s => (
                  <SpriteThumb
                    key={s.id}
                    setId={s.id}
                    mode="recolored"
                    base={tapestry.base}
                    colors={tapestry.colors}
                    selected={tapestry.primary === s.id}
                    onClick={() => handleObjectSelect('primary', s.id)}
                    label={t(s.label)}
                  />
                ))}
              </div>

              <div className="nursery-slabel" style={{ marginTop: 18 }}>{t('Accent object')}</div>
              <div className="nursery-patts">
                <button type="button" className={'nursery-patt' + (tapestry.accent === null ? ' on' : '')} onClick={() => handleObjectSelect('accent', null)}>
                  <div className="pp" style={noneSwatchStyle(tapestry.base)}>{t('NONE')}</div>
                  <div className="pl">{t('None')}</div>
                </button>
                {SPRITE_SETS.map(s => (
                  <SpriteThumb
                    key={s.id}
                    setId={s.id}
                    mode="recolored"
                    base={tapestry.base}
                    colors={tapestry.colors}
                    selected={tapestry.accent === s.id}
                    onClick={() => handleObjectSelect('accent', s.id)}
                    label={t(s.label)}
                  />
                ))}
              </div>

              <div className="nursery-slabel" style={{ marginTop: 18 }}>{t('Palette')}</div>
              <div className="nursery-seg">
                {(['boys', 'girls'] as const).map(v => (
                  <button key={v} type="button" className={tapestry.palette === v ? 'on' : ''} onClick={() => handlePaletteSelect(v)}>
                    {t(v === 'boys' ? 'Boys' : 'Girls')}
                  </button>
                ))}
              </div>

              <div className="nursery-slabel" style={{ marginTop: 18 }}>{t('Base color')}</div>
              <div className="nursery-chips">
                {BASE_CHIPS[tapestry.palette].map(c => (
                  <button
                    key={c} type="button" className={'nursery-chip' + (tapestry.base === c ? ' on' : '')}
                    style={{ background: c }} onClick={() => updateSettings({ tapestry: { ...tapestry, base: c } })}
                  />
                ))}
                <label className="nursery-cwell" style={{ background: tapestry.base }} title={t('Custom base')}>
                  <input type="color" value={tapestry.base} onChange={e => updateSettings({ tapestry: { ...tapestry, base: e.target.value } })} />
                </label>
              </div>

              <div className="nursery-slabel" style={{ marginTop: 18 }}>{t('Pattern colors')}</div>
              <div className="nursery-chips">
                {tapestry.colors.map((c, i) => (
                  <label key={i} className="nursery-cwell" style={{ background: c }}>
                    <input
                      type="color" value={c}
                      onChange={e => {
                        const next = [...tapestry.colors] as [string, string, string, string, string];
                        next[i] = e.target.value;
                        updateSettings({ tapestry: { ...tapestry, colors: next } });
                      }}
                    />
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.5)', marginTop: 12, lineHeight: 1.5 }}>
                {t('Tap a swatch to recolor it — every color is adjustable.')}
              </div>
            </div>
          )}

          {/* Starlit */}
          {settings.scene === 'starlit' && (
            <div className="nursery-sect">
              <div className="nursery-slabel">{t('Starfield')}</div>
              <div className="nursery-trow">
                <span className="tn"><Icon n="star" s={20} />{t('Aura')}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className={'nursery-tstate' + (settings.starlit.aura ? ' on' : '')}>{settings.starlit.aura ? t('ON') : t('OFF')}</span>
                  <button
                    type="button" className={'nursery-sw-toggle' + (settings.starlit.aura ? ' on' : '')}
                    onClick={() => updateSettings({ starlit: { ...settings.starlit, aura: !settings.starlit.aura } })}
                  />
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.5)', marginTop: 9, lineHeight: 1.5 }}>
                {t('Renders a glowing aurora curtain across the night sky.')}
              </div>
              <div className="nursery-slabel" style={{ marginTop: 18 }}>{t('Star density')}</div>
              <input
                className="nursery-srange" style={{ background: 'linear-gradient(90deg,#1a2035,#c7d2fe)' }}
                type="range" min={30} max={400} value={settings.starlit.density}
                onChange={e => updateSettings({ starlit: { ...settings.starlit, density: Number(e.target.value) } })}
              />
              <div className="nursery-sval">{settings.starlit.density} {t('stars')}</div>
            </div>
          )}

          {/* Photo */}
          {settings.scene === 'photo' && (
            <div className="nursery-sect">
              <div className="nursery-slabel">{t('Photo')}</div>
              {photosEnabled ? (
                <>
                  {photoIdFromSrc(settings.photo.src) && (
                    <div style={{ width: 88, height: 88, borderRadius: 12, overflow: 'hidden', marginBottom: 14, background: 'rgba(255,255,255,.06)' }}>
                      <PickerThumb id={photoIdFromSrc(settings.photo.src)!} />
                    </div>
                  )}
                  <button type="button" className="nursery-togcard" onClick={() => setPickerOpen(true)}>
                    <div className="v">{t('Choose from gallery')}</div>
                  </button>

                  <div className="nursery-trow" style={{ marginTop: 12 }}>
                    <span className="tn">{t('Auto icon color')}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className={'nursery-tstate' + (settings.photo.autoTint ? ' on' : '')}>{settings.photo.autoTint ? t('ON') : t('OFF')}</span>
                      <button
                        type="button" className={'nursery-sw-toggle' + (settings.photo.autoTint ? ' on' : '')}
                        onClick={() => updateSettings({ photo: { ...settings.photo, autoTint: !settings.photo.autoTint } })}
                      />
                    </span>
                  </div>

                  <PhotoPicker
                    open={pickerOpen}
                    onClose={() => setPickerOpen(false)}
                    onPick={(id) => updateSettings({ photo: { ...settings.photo, src: 'gallery:' + id } })}
                  />
                </>
              ) : (
                <div className="nursery-togcard">
                  <div className="v">{t('Photos are disabled for this family')}</div>
                </div>
              )}
            </div>
          )}

          {/* Wake lock / fullscreen */}
          <div className="nursery-sect">
            <button
              type="button"
              className={'nursery-togcard' + (wakeLockActive ? ' on' : '')}
              onClick={onToggleWakeLock}
              disabled={!wakeLockSupported}
              style={wakeLockSupported ? undefined : { opacity: 0.55, cursor: 'default' }}
            >
              <div className="k">{t('Screen wake lock')}</div>
              <div className="v">
                {!wakeLockSupported
                  ? t('Wake lock not supported')
                  : wakeLockActive
                    ? t('Active — screen will stay on')
                    : t('Off — screen may sleep')}
              </div>
            </button>
            {fullscreenSupported && (
              <button type="button" className={'nursery-togcard' + (fullscreenActive ? ' on' : '')} onClick={onToggleFullscreen}>
                <div className="k">{t('Fullscreen')}</div>
                <div className="v">{fullscreenActive ? t('Active — immersive') : t('Inactive — tap to enter')}</div>
              </button>
            )}
          </div>

          {/* Background hue / dim / saturation */}
          <div className="nursery-sect">
            <div className="nursery-slabel">{t('Background hue')}</div>
            <input
              className="nursery-srange nursery-hue-track" type="range" min={0} max={360} value={settings.hue}
              onChange={e => updateSettings({ hue: Number(e.target.value) })}
            />
            <div className="nursery-sval">{settings.hue}°</div>
          </div>
          <div className="nursery-sect">
            <div className="nursery-slabel">{t('Dim')}</div>
            <input
              className="nursery-srange" style={{ background: `linear-gradient(90deg,#0b0d16,oklch(0.7 0.12 ${settings.hue}))` }}
              type="range" min={0} max={100} value={settings.dim}
              onChange={e => updateSettings({ dim: Number(e.target.value) })}
            />
            <div className="nursery-sval">{settings.dim}%</div>
          </div>
          <div className="nursery-sect">
            <div className="nursery-slabel">{t('Saturation')}</div>
            <input
              className="nursery-srange" style={{ background: `linear-gradient(90deg,#6b7280,oklch(0.6 0.2 ${settings.hue}))` }}
              type="range" min={0} max={100} value={settings.sat}
              onChange={e => updateSettings({ sat: Number(e.target.value) })}
            />
            <div className="nursery-sval">{settings.sat}%</div>
          </div>

          {/* Button transparency */}
          <div className="nursery-sect">
            <div className="nursery-slabel">{t('Button transparency')}</div>
            <input
              className="nursery-srange" style={{ background: `linear-gradient(90deg, oklch(0.7 0.1 ${settings.hue}), rgba(255,255,255,.12))` }}
              type="range" min={0} max={100} value={settings.trans}
              onChange={e => updateSettings({ trans: Number(e.target.value) })}
            />
            <div className="nursery-sval">{settings.trans}%</div>
          </div>

          {/* Icon shape / color */}
          <div className="nursery-sect">
            <div className="nursery-slabel">{t('Icon shape')}</div>
            <div className="nursery-seg">
              {(['circle', 'square'] as const).map(v => (
                <button key={v} type="button" className={settings.iconShape === v ? 'on' : ''} onClick={() => updateSettings({ iconShape: v })}>
                  {t(v === 'circle' ? 'Circle' : 'Square')}
                </button>
              ))}
            </div>
            <div className="nursery-slabel" style={{ marginTop: 16 }}>{t('Icon color')}</div>
            <div className="nursery-swatches">
              {ICON_SWATCHES.map((c, i) => (
                c === null ? (
                  <button key="auto" type="button" className={'nursery-sw auto' + (settings.iconColor === null ? ' on' : '')} onClick={() => updateSettings({ iconColor: null })}>
                    {t('AUTO')}
                  </button>
                ) : (
                  <button
                    key={i} type="button" className={'nursery-sw' + (settings.iconColor === c ? ' on' : '')}
                    style={{ background: c }} onClick={() => updateSettings({ iconColor: c })}
                  />
                )
              ))}
            </div>
          </div>

          {/* Activity tiles */}
          <div className="nursery-sect">
            <div className="nursery-slabel">{t('Activity tiles')}</div>
            {ACT_ROWS.map(a => (
              <div key={a.id} className="nursery-trow">
                <span className="tn"><Icon n={a.icon} s={20} />{t(a.label)}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className={'nursery-tstate' + (settings.acts[a.id] ? ' on' : '')}>{settings.acts[a.id] ? t('ON') : t('OFF')}</span>
                  <button
                    type="button" className={'nursery-sw-toggle' + (settings.acts[a.id] ? ' on' : '')}
                    onClick={() => updateSettings({ acts: { ...settings.acts, [a.id]: !settings.acts[a.id] } })}
                  />
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </>
  );
}
