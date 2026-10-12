# FoodForm

A tabbed form for the food tracker (issue #203). Lets caretakers log each food a baby tries — with enjoyment level, common-allergen flag, reaction details, notes, and photo attachments — and view all-time "100 foods before 1" progress, per-food history, and the derived allergen profile.

## Structure

- `index.tsx` — the `FormPage` shell with two tabs; fetches the family food catalog when opened. The footer renders Save/Cancel for the Log Food tab (Save submits the tab's form via the HTML `form` attribute) and a Close button for the Progress tab
- `LogFoodTab.tsx` — log a new food try or edit an existing food log
- `ProgressTab.tsx` — unique-food counter, enjoyment breakdown, allergen list, per-food history
- `food-form.types.ts` — prop types
- `food-form.styles.ts` — CVA/Tailwind light-mode styles (food tags, meal total)
- `food-form.utils.ts` — `completeFoodLogSave()`, the pure post-save sequence (refresh → notify parent → close)
- `food-form.css` — dark-mode overrides via `html.dark` selectors (no `dark:` Tailwind classes)

## Props (`FoodFormProps`)

| Prop | Type | Description |
| --- | --- | --- |
| `isOpen` | `boolean` | Whether the form is open |
| `onClose` | `() => void` | Called when the form should close |
| `babyId` | `string \| undefined` | The baby to log food tries for |
| `initialTime` | `string` | Default date/time for a new log entry |
| `onSuccess` | `() => void` (optional) | Called after a log is saved/updated (e.g. to refresh the timeline) |
| `activity` | `FoodLogResponse` (optional) | Existing food log to edit; omit for a new entry |

## Behavior

### Log Food tab

- **Food combobox** over the family catalog (`GET /api/food`). Typing a name that doesn't match an existing food (case-insensitively) creates the catalog entry on save (`POST /api/food`); a duplicate-name race is tolerated by refetching and matching.
- **Common allergen** checkbox is user-controlled for new foods, with helper text explaining when to check it (keyword auto-suggestion was removed — it only worked for English food names). For existing foods it mirrors the catalog flag and is read-only here.
- **Amount** is an optional stepper input with a TBSP / G unit toggle (defaults to the family's `defaultSolidsUnit` setting, falling back to TBSP). It round-trips when editing and is sent as `amount`/`unitAbbr` (null when empty).
- **Enjoyment** is an optional 5-option segmented picker (Hated / Disliked / Neutral / Liked / Loved); tapping the selected option clears it.
- **Reaction occurred** switch reveals a description textarea; the description is only sent when the switch is on. With several foods it reveals a per-food checklist instead, so each reaction is attributed to the food that caused it.
- **Per-food amounts (#271).** Each selected food is a small bordered tag showing its name and amount ("Carrot 15 g ×"). With two or more foods, tapping a tag's name selects that food (highlighted, `aria-pressed`) and the Amount stepper and TBSP / G buttons edit its amount, labelled "Amount (g) — Carrot". Changes are pending until **Update** (shown next to the unit buttons, highlighted only while the value differs from the tag's) commits them to the tag; switching tags, removing another food, and the footer Save also commit a pending amount so nothing typed is lost. A newly added food becomes the selected one; removing the selected food selects a neighbour; × still removes. The meal total appears next to the Foods label ("Foods · 25 g total", mixed units "15 g, 2 tbsp"); the server derives the row `amount`/`unitAbbr` from the foods (null amount when units are mixed). Going from one food to two moves the meal amount onto the first food's tag; removing foods back down to one folds that food's amount into the meal fields. A single-food entry never stores per-food details (`buildMealItems`) and has no Update button. Enjoyment, notes, photos and date/time stay meal-level; per-food enjoyment already stored on an entry is kept on edit. The state transitions are pure helpers in `src/utils/foodMealComposer.ts`.
- **Photos** use the shared `PhotoAttachments` component with `activityType: 'foodLog'` links (only rendered when the deployment has photos enabled).
- Saves via `POST /api/food-log` (or `PUT /api/food-log?id=` when editing). Times go through `toUTCString()`.
- The Save/Cancel buttons live in the `FormPage` footer (`index.tsx`); the tab reports `{ isSubmitting, canSubmit }` up via `onFormStateChange` so the footer can disable them.
- A successful save closes the tracker (`completeFoodLogSave()`), matching Diaper/Bath/Feed and the rest of the single-purpose forms. It previously stayed open, which stranded the user on the form when saving from the Log Entry page (issue #254).

### Progress tab

- Fetches `GET /api/food-log/progress?babyId=` (all-time counter, enjoyment breakdown, allergens) and `GET /api/food-log?babyId=` (per-food history via the pure `buildFoodTryList()` helper in `src/utils/foodLogUtils.ts`). History rows include per-unit amount totals (e.g. "3 tbsp, 20 g") when tries recorded amounts.
- Progress bar caps at 100% but the counter keeps counting past the 100-food goal.
- Refreshes automatically after a save in the Log Food tab (`refreshTrigger`).

## Usage

```tsx
<FoodForm
  isOpen={showFoodModal}
  onClose={() => setShowFoodModal(false)}
  babyId={selectedBaby?.id}
  initialTime={localTime}
  onSuccess={() => triggerRefresh()}
/>
```

Editing from the timeline (see `TimelineV2/index.tsx`):

```tsx
<FoodForm
  isOpen={editModalType === 'food'}
  onClose={...}
  babyId={selectedActivity.babyId}
  initialTime={String(selectedActivity.time)}
  activity={selectedActivity as FoodLogResponse}
  onSuccess={handleFormSuccess}
/>
```
