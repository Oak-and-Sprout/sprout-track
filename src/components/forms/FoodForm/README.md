# FoodForm

A tabbed form for the food tracker (issue #203). Lets caretakers log each food a baby tries — with enjoyment level, common-allergen flag, reaction details, notes, and photo attachments — and view all-time "100 foods before 1" progress, per-food history, and the derived allergen profile.

## Structure

- `index.tsx` — the `FormPage` shell with two tabs; fetches the family food catalog when opened
- `LogFoodTab.tsx` — log a new food try or edit an existing food log
- `ProgressTab.tsx` — unique-food counter, enjoyment breakdown, allergen list, per-food history
- `food-form.types.ts` — prop types
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
- **Common allergen** checkbox is pre-suggested for new foods via `isLikelyCommonAllergen()` (big-9 keyword match) until the user toggles it. For existing foods it mirrors the catalog flag and is read-only here.
- **Enjoyment** is an optional 5-option segmented picker (Hated / Disliked / Neutral / Liked / Loved); tapping the selected option clears it.
- **Reaction occurred** switch reveals a description textarea; the description is only sent when the switch is on.
- **Photos** use the shared `PhotoAttachments` component with `activityType: 'foodLog'` links (only rendered when the deployment has photos enabled).
- Saves via `POST /api/food-log` (or `PUT /api/food-log?id=` when editing). Times go through `toUTCString()`.

### Progress tab

- Fetches `GET /api/food-log/progress?babyId=` (all-time counter, enjoyment breakdown, allergens) and `GET /api/food-log?babyId=` (per-food history via the pure `buildFoodTryList()` helper in `src/utils/foodLogUtils.ts`).
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
