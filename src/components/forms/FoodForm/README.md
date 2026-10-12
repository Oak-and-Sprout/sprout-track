# FoodForm

A tabbed form for the food tracker (issue #203). Lets caretakers log each food a baby tries — with enjoyment level, common-allergen flag, reaction details, notes, and photo attachments — and view all-time "100 foods before 1" progress, per-food history, and the derived allergen profile.

## Structure

- `index.tsx` — the `FormPage` shell with two tabs; fetches the family food catalog when opened. The footer renders Save/Cancel for the Log Food tab (Save submits the tab's form via the HTML `form` attribute) and a Close button for the Progress tab
- `LogFoodTab.tsx` — log a new food try or edit an existing food log
- `FoodEntryBox.tsx` — the bordered entry box where one food is composed (name combobox, amount, unit, Save) or a tag is edited
- `ProgressTab.tsx` — unique-food counter, enjoyment breakdown, allergen list, per-food history
- `food-form.types.ts` — prop types
- `food-form.styles.ts` — CVA/Tailwind light-mode styles (food tags, entry box, stepper, meal total)
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

- **Composing foods (#271).** Foods are added one at a time in a bordered **entry box** (`FoodEntryBox`): the food name combobox over the family catalog (`GET /api/food`), the Amount stepper, the TBSP / G unit buttons (the unit defaults to the family's `defaultSolidsUnit`, falling back to TBSP, and sticks between foods), and a **Save** button. Picking a catalog food only fills the name; Save (or Enter / the keyboard's action key in the name or amount field) adds the food as a tag above the box, then clears the box and releases focus. Typing a name not in the catalog (case-insensitively) shows a "New food" hint and a **Common allergen** checkbox; the catalog entry is created on the footer Save (`POST /api/food`, a duplicate-name race is tolerated by refetching). Saving a name already in the meal merges into that tag rather than duplicating it.
- **Editing a food.** Each tag shows the food's name and amount ("Carrot 15 g ×"). Tapping the name loads that food's name, amount and unit into the box (the tag is highlighted, `aria-pressed`, and the box reads "Editing Carrot" with a Cancel button; tapping the tag again also cancels). Save writes the changes back to that tag in place — a new name swaps the food (catalog or new) but keeps its position, reaction and stored enjoyment. × removes a tag (and clears the box if it was being edited).
- **Footer Save** first commits a food still in the box (new or an edit in progress), so nothing typed is silently lost; it is enabled once the meal has a food or the box names one.
- **Storage.** One food is stored as a single-food entry (row `amount`/`unitAbbr` = that food's, no per-food details — `buildMealItems`). Two or more foods store each food's amount/unit in the `foods` JSON and the server derives the row amount (null amount for mixed units). The meal total sits next to the label ("Foods · 25 g total", mixed units "15 g, 2 tbsp"); a pre-#271 multi-food entry with only a shared amount keeps and shows it until a food gets its own, and folds it onto the last food when removing down to one. Editing a log loads its foods as tags with the box empty. The transitions are pure helpers in `src/utils/foodMealComposer.ts`.
- **Enjoyment** is an optional 5-option segmented picker (Hated / Disliked / Neutral / Liked / Loved); tapping the selected option clears it. It is meal-level; per-food enjoyment already stored on an entry is kept on edit.
- **Reaction occurred** switch reveals a description textarea; the description is only sent when the switch is on. With several foods it reveals a per-food checklist instead, so each reaction is attributed to the food that caused it.
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
