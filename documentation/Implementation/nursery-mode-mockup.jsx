import { useState, useEffect, useRef } from "react";

/*
  Sprout Track — Nursery Mode v2
  Inline sub-action tiles, stateful sleep toggle,
  pump timers, ambient night-light dashboard.
*/

const DEFAULT_TILES = [
  { id: "feed", label: "Feed", active: true },
  { id: "pump", label: "Pump", active: true },
  { id: "diaper", label: "Diaper", active: true },
  { id: "sleep", label: "Sleep", active: true },
];

const INITIAL_LOGS = {
  feed: { last: "11:42 pm", note: "4 oz bottle" },
  pump: { last: "9:15 pm", note: "6 oz total" },
  diaper: { last: "10:58 pm", note: "wet" },
  sleep: { last: "11:50 pm", note: "fell asleep" },
};

function formatTime(date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).toLowerCase();
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function useColors(hue, brightness) {
  const isLight = brightness > 55;
  return {
    isLight,
    text: isLight ? `hsla(${hue}, 15%, 15%, 0.85)` : `hsla(${hue}, 15%, 95%, 0.85)`,
    subtext: isLight ? `hsla(${hue}, 10%, 30%, 0.5)` : `hsla(${hue}, 10%, 80%, 0.4)`,
    border: isLight ? `hsla(${hue}, 20%, 40%, 0.12)` : `hsla(${hue}, 20%, 80%, 0.08)`,
    tileBg: isLight ? `hsla(${hue}, 20%, 97%, 0.5)` : `hsla(${hue}, 20%, 18%, 0.35)`,
    tilePressed: isLight ? `hsla(${hue}, 25%, 92%, 0.7)` : `hsla(${hue}, 25%, 25%, 0.5)`,
    logText: isLight ? `hsla(${hue}, 12%, 25%, 0.6)` : `hsla(${hue}, 12%, 75%, 0.5)`,
    btnBg: isLight ? `hsla(${hue}, 18%, 90%, 0.55)` : `hsla(${hue}, 18%, 24%, 0.45)`,
    btnHover: isLight ? `hsla(${hue}, 22%, 84%, 0.7)` : `hsla(${hue}, 22%, 30%, 0.6)`,
    btnActive: isLight ? `hsla(${hue}, 28%, 78%, 0.8)` : `hsla(${hue}, 28%, 35%, 0.7)`,
    accent: isLight ? `hsla(${hue}, 30%, 45%, 0.7)` : `hsla(${hue}, 30%, 70%, 0.7)`,
    panelBg: isLight ? `hsla(${hue}, 15%, 96%, 0.92)` : `hsla(${hue}, 15%, 12%, 0.92)`,
    label: isLight ? `hsla(${hue}, 8%, 35%, 0.6)` : `hsla(${hue}, 8%, 70%, 0.5)`,
    sleepGlow: isLight ? `hsla(${hue}, 25%, 75%, 0.2)` : `hsla(${hue}, 25%, 40%, 0.15)`,
  };
}

function Clock({ colors }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).toLowerCase();

  const date = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div style={{ textAlign: "center", userSelect: "none" }}>
      <div style={{
        fontFamily: "'Newsreader', 'Georgia', serif",
        fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
        fontWeight: 300,
        letterSpacing: "-0.02em",
        lineHeight: 1.1,
        opacity: 0.9,
        color: colors.text,
      }}>
        {time}
      </div>
      <div style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: "clamp(0.75rem, 1.8vw, 1rem)",
        fontWeight: 400,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        opacity: 0.5,
        marginTop: "0.25rem",
        color: colors.text,
      }}>
        {date}
      </div>
    </div>
  );
}

function SubButton({ label, onClick, colors, active, timerText }) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        flex: 1,
        padding: timerText ? "0.45rem 0.4rem" : "0.55rem 0.4rem",
        borderRadius: "0.55rem",
        border: `1px solid ${active ? colors.accent : colors.border}`,
        background: pressed ? colors.btnActive : active ? colors.btnHover : colors.btnBg,
        cursor: "pointer",
        fontFamily: "'DM Sans', sans-serif",
        fontSize: "clamp(0.65rem, 1.3vw, 0.78rem)",
        fontWeight: 500,
        color: active ? colors.accent : colors.text,
        outline: "none",
        transition: "all 0.15s ease",
        transform: pressed ? "scale(0.96)" : "scale(1)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.1rem",
        minWidth: 0,
      }}
    >
      <span>{label}</span>
      {timerText && (
        <span style={{
          fontFamily: "'Newsreader', serif",
          fontSize: "clamp(0.7rem, 1.4vw, 0.85rem)",
          fontWeight: 400,
          fontStyle: "italic",
          color: colors.accent,
          letterSpacing: "0.02em",
        }}>
          {timerText}
        </span>
      )}
    </button>
  );
}

function TileShell({ label, colors, log, animating, sleeping, statusText, children }) {
  return (
    <div
      style={{
        background: colors.tileBg,
        border: `1px solid ${sleeping ? colors.accent : colors.border}`,
        borderRadius: "1rem",
        padding: "clamp(0.85rem, 2.5vw, 1.4rem)",
        display: "flex",
        flexDirection: "column",
        minHeight: "clamp(130px, 24vw, 195px)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        position: "relative",
        overflow: "hidden",
        transition: "all 0.3s ease",
        boxShadow: sleeping ? `0 0 25px ${colors.sleepGlow}, inset 0 0 15px ${colors.sleepGlow}` : "none",
      }}
    >
      {animating && (
        <div style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at center, ${colors.sleepGlow}, transparent 70%)`,
          animation: "tileFlash 0.6s ease-out",
          pointerEvents: "none",
        }} />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "clamp(1rem, 2.2vw, 1.35rem)",
            fontWeight: 500,
            color: colors.text,
            letterSpacing: "-0.01em",
          }}>
            {label}
          </div>
          {statusText && (
            <div style={{
              fontFamily: "'Newsreader', serif",
              fontSize: "clamp(0.65rem, 1.3vw, 0.78rem)",
              fontWeight: 400,
              fontStyle: "italic",
              color: colors.accent,
              marginTop: "0.1rem",
              animation: "gentlePulse 3s ease-in-out infinite",
            }}>
              {statusText}
            </div>
          )}
        </div>

        {log && !statusText && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{
              fontFamily: "'Newsreader', serif",
              fontSize: "clamp(0.72rem, 1.5vw, 0.88rem)",
              fontWeight: 400,
              color: colors.logText,
              fontStyle: "italic",
            }}>
              {log.last}
            </div>
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "clamp(0.55rem, 1.1vw, 0.65rem)",
              fontWeight: 400,
              color: colors.subtext,
              marginTop: "0.05rem",
              letterSpacing: "0.01em",
            }}>
              {log.note}
            </div>
          </div>
        )}
      </div>

      {children}
    </div>
  );
}

function FeedTile({ colors, log, onLog, animating }) {
  return (
    <TileShell label="Feed" colors={colors} log={log} animating={animating}>
      <div style={{ display: "flex", gap: "0.4rem", marginTop: "auto", paddingTop: "0.5rem" }}>
        <SubButton label="Bottle" onClick={() => onLog("feed", "bottle")} colors={colors} />
        <SubButton label="Breast L" onClick={() => onLog("feed", "breast left")} colors={colors} />
        <SubButton label="Breast R" onClick={() => onLog("feed", "breast right")} colors={colors} />
      </div>
    </TileShell>
  );
}

function PumpTile({ colors, log, onLog, animating }) {
  const [activeTimer, setActiveTimer] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (activeTimer) {
      setElapsed(0);
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [activeTimer]);

  const handleStart = (side) => {
    if (activeTimer === side) {
      const duration = formatDuration(elapsed);
      onLog("pump", `${side} — ${duration}`);
      setActiveTimer(null);
      setElapsed(0);
    } else {
      setActiveTimer(side);
    }
  };

  return (
    <TileShell label="Pump" colors={colors} log={log} animating={animating}
      statusText={activeTimer ? `${activeTimer} side running` : null}>
      <div style={{ display: "flex", gap: "0.4rem", marginTop: "auto", paddingTop: "0.5rem" }}>
        <SubButton
          label={activeTimer === "left" ? "Stop" : "Start Left"}
          onClick={() => handleStart("left")}
          colors={colors}
          active={activeTimer === "left"}
          timerText={activeTimer === "left" ? formatDuration(elapsed) : null}
        />
        <SubButton
          label={activeTimer === "right" ? "Stop" : "Start Right"}
          onClick={() => handleStart("right")}
          colors={colors}
          active={activeTimer === "right"}
          timerText={activeTimer === "right" ? formatDuration(elapsed) : null}
        />
      </div>
    </TileShell>
  );
}

function DiaperTile({ colors, log, onLog, animating }) {
  return (
    <TileShell label="Diaper" colors={colors} log={log} animating={animating}>
      <div style={{ display: "flex", gap: "0.4rem", marginTop: "auto", paddingTop: "0.5rem" }}>
        <SubButton label="Wet" onClick={() => onLog("diaper", "wet")} colors={colors} />
        <SubButton label="Dirty" onClick={() => onLog("diaper", "dirty")} colors={colors} />
        <SubButton label="Both" onClick={() => onLog("diaper", "wet + dirty")} colors={colors} />
      </div>
    </TileShell>
  );
}

function SleepTile({ colors, log, onLog, animating }) {
  const [sleeping, setSleeping] = useState(false);
  const [sleepStart, setSleepStart] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (sleeping) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - sleepStart) / 1000));
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [sleeping, sleepStart]);

  const handleToggle = () => {
    if (sleeping) {
      const duration = formatDuration(elapsed);
      onLog("sleep", `woke up — slept ${duration}`);
      setSleeping(false);
      setSleepStart(null);
      setElapsed(0);
    } else {
      setSleepStart(Date.now());
      setSleeping(true);
      onLog("sleep", "fell asleep");
    }
  };

  return (
    <TileShell
      label="Sleep"
      colors={colors}
      log={log}
      animating={animating}
      sleeping={sleeping}
      statusText={sleeping ? `Sleeping — ${formatDuration(elapsed)}` : null}
    >
      <div style={{ display: "flex", gap: "0.4rem", marginTop: "auto", paddingTop: "0.5rem" }}>
        <SubButton
          label={sleeping ? "Wake Up" : "Start Sleep"}
          onClick={handleToggle}
          colors={colors}
          active={sleeping}
          timerText={sleeping ? formatDuration(elapsed) : null}
        />
      </div>
    </TileShell>
  );
}

function SettingsDrawer({ open, onClose, hue, setHue, brightness, setBrightness, tiles, setTiles, wakeLock, colors }) {
  const toggleTile = (id) => {
    setTiles(prev => prev.map(t => t.id === id ? { ...t, active: !t.active } : t));
  };

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            zIndex: 90,
            animation: "fadeIn 0.25s ease",
          }}
        />
      )}
      <div style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "min(360px, 85vw)",
        background: colors.panelBg,
        backdropFilter: "blur(40px)",
        WebkitBackdropFilter: "blur(40px)",
        zIndex: 100,
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
        padding: "clamp(1.5rem, 4vw, 2.5rem)",
        boxSizing: "border-box",
        overflowY: "auto",
        borderLeft: `1px solid ${colors.border}`,
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "1.1rem",
            fontWeight: 500,
            color: colors.text,
            letterSpacing: "-0.01em",
          }}>
            Settings
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "0.85rem",
              color: colors.label,
              cursor: "pointer",
              padding: "0.3rem 0.6rem",
            }}
          >
            Close
          </button>
        </div>

        <div style={{
          padding: "0.75rem 1rem",
          borderRadius: "0.6rem",
          background: wakeLock
            ? (colors.isLight ? `hsla(150, 30%, 90%, 0.6)` : `hsla(150, 30%, 20%, 0.3)`)
            : (colors.isLight ? `hsla(40, 30%, 90%, 0.6)` : `hsla(40, 30%, 20%, 0.3)`),
          border: `1px solid ${colors.border}`,
        }}>
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.75rem",
            fontWeight: 500,
            color: colors.text,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            marginBottom: "0.2rem",
          }}>
            Screen Wake Lock
          </div>
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.8rem",
            color: colors.label,
          }}>
            {wakeLock ? "Active — screen will stay on" : "Inactive — enable in browser"}
          </div>
        </div>

        <div>
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.7rem",
            fontWeight: 500,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: colors.label,
            marginBottom: "0.75rem",
          }}>
            Background Hue
          </div>
          <input
            type="range" min="0" max="360" value={hue}
            onChange={(e) => setHue(Number(e.target.value))}
            style={{
              width: "100%", height: "6px",
              WebkitAppearance: "none", appearance: "none",
              borderRadius: "3px",
              background: `linear-gradient(to right,
                hsl(0,25%,${brightness>55?70:40}%),hsl(60,25%,${brightness>55?70:40}%),
                hsl(120,25%,${brightness>55?70:40}%),hsl(180,25%,${brightness>55?70:40}%),
                hsl(240,25%,${brightness>55?70:40}%),hsl(300,25%,${brightness>55?70:40}%),
                hsl(360,25%,${brightness>55?70:40}%))`,
              outline: "none", cursor: "pointer",
            }}
          />
          <div style={{ fontFamily: "'Newsreader', serif", fontSize: "0.85rem", color: colors.label, marginTop: "0.4rem", fontStyle: "italic" }}>
            {hue}°
          </div>
        </div>

        <div>
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.7rem",
            fontWeight: 500,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: colors.label,
            marginBottom: "0.75rem",
          }}>
            Brightness
          </div>
          <input
            type="range" min="5" max="90" value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            style={{
              width: "100%", height: "6px",
              WebkitAppearance: "none", appearance: "none",
              borderRadius: "3px",
              background: `linear-gradient(to right, hsl(${hue},20%,5%), hsl(${hue},20%,90%))`,
              outline: "none", cursor: "pointer",
            }}
          />
          <div style={{ fontFamily: "'Newsreader', serif", fontSize: "0.85rem", color: colors.label, marginTop: "0.4rem", fontStyle: "italic" }}>
            {brightness}%
          </div>
        </div>

        <div>
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.7rem",
            fontWeight: 500,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: colors.label,
            marginBottom: "0.75rem",
          }}>
            Activity Tiles
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {tiles.map(tile => (
              <button
                key={tile.id}
                onClick={() => toggleTile(tile.id)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.65rem 0.9rem",
                  borderRadius: "0.5rem",
                  border: `1px solid ${colors.border}`,
                  background: tile.active ? colors.btnBg : "transparent",
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "0.85rem",
                  color: colors.text,
                  outline: "none",
                  transition: "all 0.15s ease",
                }}
              >
                <span>{tile.label}</span>
                <span style={{ fontSize: "0.7rem", letterSpacing: "0.04em", textTransform: "uppercase", color: colors.label }}>
                  {tile.active ? "On" : "Off"}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div style={{
          padding: "0.75rem 1rem",
          borderRadius: "0.6rem",
          background: colors.isLight ? `hsla(${hue}, 10%, 93%, 0.5)` : `hsla(${hue}, 10%, 15%, 0.3)`,
          border: `1px solid ${colors.border}`,
          marginTop: "auto",
        }}>
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.75rem",
            fontWeight: 500,
            color: colors.text,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            marginBottom: "0.2rem",
          }}>
            Session
          </div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.8rem", color: colors.label }}>
            Refresh token active — session persists while Nursery Mode is running
          </div>
        </div>
      </div>
    </>
  );
}

export default function NurseryMode() {
  const [hue, setHue] = useState(230);
  const [brightness, setBrightness] = useState(15);
  const [tiles, setTiles] = useState(DEFAULT_TILES);
  const [logs, setLogs] = useState(INITIAL_LOGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [animatingTile, setAnimatingTile] = useState(null);
  const [wakeLock, setWakeLock] = useState(false);

  const colors = useColors(hue, brightness);

  useEffect(() => {
    const timer = setTimeout(() => setWakeLock(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const activeTiles = tiles.filter(t => t.active);

  const bgGradient = `
    radial-gradient(ellipse 120% 80% at 20% 90%,
      hsla(${(hue + 20) % 360}, 25%, ${Math.max(brightness - 3, 3)}%, 0.6),
      transparent 70%),
    radial-gradient(ellipse 100% 60% at 85% 15%,
      hsla(${(hue - 15 + 360) % 360}, 20%, ${Math.max(brightness + 4, 8)}%, 0.4),
      transparent 60%),
    linear-gradient(165deg,
      hsl(${hue}, 20%, ${brightness}%) 0%,
      hsl(${(hue + 8) % 360}, 18%, ${Math.max(brightness - 2, 3)}%) 100%)
  `;

  const handleLog = (tileId, note) => {
    const now = formatTime(new Date());
    setLogs(prev => ({ ...prev, [tileId]: { last: now, note } }));
    setAnimatingTile(tileId);
    setTimeout(() => setAnimatingTile(null), 600);
  };

  const tileComponents = { feed: FeedTile, pump: PumpTile, diaper: DiaperTile, sleep: SleepTile };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,300;0,400;1,400&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tileFlash { from { opacity: 1; } to { opacity: 0; } }
        @keyframes gentlePulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none; width: 18px; height: 18px;
          border-radius: 50%; background: white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.25); cursor: pointer;
        }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>

      <div style={{
        position: "fixed", inset: 0, background: bgGradient,
        transition: "background 0.8s ease",
        display: "flex", flexDirection: "column",
        fontFamily: "'DM Sans', sans-serif", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          padding: "clamp(1rem, 3vw, 2rem) clamp(1.25rem, 4vw, 2.5rem)", paddingBottom: 0,
        }}>
          <div>
            <div style={{
              fontFamily: "'Newsreader', serif", fontSize: "clamp(0.85rem, 1.8vw, 1rem)",
              fontWeight: 300, color: colors.text, letterSpacing: "0.01em", opacity: 0.7,
            }}>
              Sprout Track
            </div>
            <div style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: "clamp(0.55rem, 1.2vw, 0.7rem)",
              fontWeight: 400, letterSpacing: "0.08em", textTransform: "uppercase",
              color: colors.text, opacity: 0.35, marginTop: "0.15rem",
            }}>
              Nursery Mode
            </div>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            style={{
              background: "none", border: "none", fontFamily: "'DM Sans', sans-serif",
              fontSize: "clamp(0.7rem, 1.4vw, 0.82rem)", color: colors.text, opacity: 0.45,
              cursor: "pointer", padding: "0.3rem 0", letterSpacing: "0.04em",
            }}
          >
            Settings
          </button>
        </div>

        {/* Clock */}
        <div style={{
          flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center",
          padding: "clamp(1.25rem, 4vw, 3rem) 0 clamp(0.75rem, 2.5vw, 1.5rem)",
        }}>
          <Clock colors={colors} />
        </div>

        {/* Tiles */}
        <div style={{
          flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center",
          padding: "0 clamp(1.25rem, 4vw, 2.5rem) clamp(1rem, 2.5vw, 1.5rem)", overflow: "hidden",
        }}>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: "clamp(0.5rem, 1.3vw, 0.75rem)", width: "100%", maxWidth: "620px",
          }}>
            {activeTiles.map(tile => {
              const Component = tileComponents[tile.id];
              return <Component key={tile.id} colors={colors} log={logs[tile.id]} onLog={handleLog} animating={animatingTile === tile.id} />;
            })}
          </div>
        </div>

        {/* Wake lock */}
        <div style={{ padding: "0 0 clamp(0.75rem, 2vw, 1.25rem)", textAlign: "center" }}>
          <span style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: "0.6rem",
            letterSpacing: "0.06em", textTransform: "uppercase",
            color: colors.text, opacity: 0.25,
            animation: wakeLock ? "gentlePulse 4s ease-in-out infinite" : "none",
          }}>
            {wakeLock ? "Screen lock active" : "Requesting wake lock..."}
          </span>
        </div>

        <SettingsDrawer
          open={settingsOpen} onClose={() => setSettingsOpen(false)}
          hue={hue} setHue={setHue} brightness={brightness} setBrightness={setBrightness}
          tiles={tiles} setTiles={setTiles} wakeLock={wakeLock} colors={colors}
        />
      </div>
    </>
  );
}
