# TimerBlocks (Nursery Mode)

Up to three glanceable timers shown in a single row between the clock and the
activity area in Nursery Mode (issue #219):

- **Wake** — while the baby is awake, time since the last sleep ended
  ("Awake · 1 hr 23 min"); during an ongoing sleep, the sleeping duration in a
  cooler, dimmer "sleeping" tone.
- **Feed** — time since the last feed, honoring the baby's `feedTimerFrom`
  (start vs end of a breast session) and `feedTimerTypes` (which feed types —
  including food — reset the timer). Turns to a soft rose "warning" tone with an
  "Overdue" pill once `feedWarningTime` is reached. Shows "Feeding" while a
  breastfeed session is running.
- **Diaper** — time since the last diaper change (the same `lastDiaperTime` the
  log-entry diaper status bubble uses), with the same warning tone and
  "Overdue" pill once the baby's `diaperWarningTime` is reached.

Anything 24 h old or more (or no data at all, e.g. a new baby) renders an empty
state ("No recent sleep" / "No recent feed" / "No recent diaper") instead of a misleading duration —
the same cutoff the log-entry status bubbles use.

## Usage

```tsx
<TimerBlocks
  status={timerStatus}            // LatestStatusData | null (null = still loading → renders nothing)
  baby={selectedBaby}             // { feedTimerFrom, feedWarningTime, diaperWarningTime }
  feeding={feedView.active}       // breastfeed in progress
  showWake={settings.timers.wake}
  showFeed={settings.timers.feed}
  showDiaper={settings.timers.diaper}
  iconColor={iconColor}
  iconShape={shape}
/>
```

`TimerBlock` is the presentational card (icon badge, label, duration or word,
optional note / badge) and can be used on its own.

## Data and logic

- `NurseryModeContainer` builds `status` with `computeLatestStatus`
  (`src/utils/latestStatus.ts`) from the feed, sleep, diaper and (when food
  counts toward the feed timer) food logs its 10 s poller already fetches
  (diaper logs are always polled, so the diaper timer works with the diaper tile hidden) — the same
  function the log-entry page's TimelineV2 uses for its status bubbles. It also
  re-polls right after any nursery log so the timers update immediately.
- `wakeTimer` / `feedTimer` / `diaperTimer` / `splitDuration` (`src/utils/nursery/timerBlocks.ts`)
  turn that status into view models. Durations are epoch-based whole minutes,
  so DST transitions don't skew them.
- The component re-renders every 15 s (and on tab visibility) for minute-level
  accuracy.

## Settings

`NurserySettings.timers` (`{ wake, feed, diaper }`, all on by default; a key
missing from older saved settings reads as on) toggles each block from the
settings drawer's **Timers** section.

## Accessibility

Each block is `role="timer"` (implicit `aria-live="off"`), so the per-minute
tick is never announced. The visible labels are short ("Awake", "Feed",
"Diaper") so three blocks fit a phone row; its `aria-label` holds the full reading — e.g.
"Since last feed, 3 hours 5 minutes, Overdue" — and the visual parts are
`aria-hidden`. The warning state is conveyed by the "Overdue" text, not color
alone.

## Styling

`timer-blocks.styles.ts` (CVA `tone` variant: `normal | sleeping | warning |
empty`) supplies layout utilities; `timer-blocks.css` holds the glass card and
low-light colors, reusing the stage's `--cardbg` / `--cardline` transparency
variables. Blocks are equal-width (`flex: 1`) and capped at a third of the row,
so one or two enabled blocks keep the three-up size, centered; on phones
(≤ 680px) padding, type and the pill shrink so all three fit at ~360px wide.
The nursery stage is dark in both app themes, so no `html.dark`
override is needed.
