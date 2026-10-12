# TimerBlocks (Nursery Mode)

Two large, glanceable timers shown between the clock and the activity area in
Nursery Mode (issue #219):

- **Wake** — while the baby is awake, time since the last sleep ended
  ("Awake · 1 hr 23 min"); during an ongoing sleep, the sleeping duration in a
  cooler, dimmer "sleeping" tone.
- **Feed** — time since the last feed, honoring the baby's `feedTimerFrom`
  (start vs end of a breast session) and `feedTimerTypes` (which feed types —
  including food — reset the timer). Turns to a soft rose "warning" tone with an
  "Overdue" pill once `feedWarningTime` is reached. Shows "Feeding" while a
  breastfeed session is running.

Anything 24 h old or more (or no data at all, e.g. a new baby) renders an empty
state ("No recent sleep" / "No recent feed") instead of a misleading duration —
the same cutoff the log-entry status bubbles use.

## Usage

```tsx
<TimerBlocks
  status={timerStatus}            // LatestStatusData | null (null = still loading → renders nothing)
  baby={selectedBaby}             // { feedTimerFrom, feedWarningTime }
  feeding={feedView.active}       // breastfeed in progress
  showWake={settings.timers.wake}
  showFeed={settings.timers.feed}
  iconColor={iconColor}
  iconShape={shape}
/>
```

`TimerBlock` is the presentational card (icon badge, label, duration or word,
optional note / badge) and can be used on its own.

## Data and logic

- `NurseryModeContainer` builds `status` with `computeLatestStatus`
  (`src/utils/latestStatus.ts`) from the feed, sleep and (when food counts
  toward the feed timer) food logs its 10 s poller already fetches — the same
  function the log-entry page's TimelineV2 uses for its status bubbles. It also
  re-polls right after any nursery log so the timers update immediately.
- `wakeTimer` / `feedTimer` / `splitDuration` (`src/utils/nursery/timerBlocks.ts`)
  turn that status into view models. Durations are epoch-based whole minutes,
  so DST transitions don't skew them.
- The component re-renders every 15 s (and on tab visibility) for minute-level
  accuracy.

## Settings

`NurserySettings.timers` (`{ wake, feed }`, both on by default) toggles each
block from the settings drawer's **Timers** section.

## Accessibility

Each block is `role="timer"` (implicit `aria-live="off"`), so the per-minute
tick is never announced. Its `aria-label` holds the full reading — e.g.
"Since last feed, 3 hours 5 minutes, Overdue" — and the visual parts are
`aria-hidden`. The warning state is conveyed by the "Overdue" text, not color
alone.

## Styling

`timer-blocks.styles.ts` (CVA `tone` variant: `normal | sleeping | warning |
empty`) supplies layout utilities; `timer-blocks.css` holds the glass card and
low-light colors, reusing the stage's `--cardbg` / `--cardline` transparency
variables. The nursery stage is dark in both app themes, so no `html.dark`
override is needed.
