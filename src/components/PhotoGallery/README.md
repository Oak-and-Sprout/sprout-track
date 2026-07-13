# PhotoGallery

The `/[slug]/photos` page: a family-wide (optionally baby-scoped) photo
gallery with month/milestone/all grouping, live search, type + favorites
filtering, a toggleable captions display, and select mode. Lightbox,
floating selection bar, and the dedicated Trash view land in a follow-up
task — this component's state shape already carries the fields they need.

## Props

```typescript
export interface PhotoGalleryProps {
  babyId: string | undefined;
}
```

`babyId` comes straight from `useBaby().selectedBaby?.id`. When
`undefined`, `fetchPhotos` returns every photo in the family; when set, the
list narrows to that baby.

## State contract (`photo-gallery.types.ts`)

```typescript
export type GalleryView = 'gallery' | 'trash';
export type GalleryGrouping = 'month' | 'milestone' | 'all';

export interface GalleryState {
  grouping: GalleryGrouping;
  query: string;
  typeFilter: GalleryTypeFilter;       // from photoGalleryUtils
  favoritesOnly: boolean;
  selectMode: boolean;
  selectedIds: Set<string>;
  view: GalleryView;
  lightboxPhotoId: string | null;      // drives PhotoDetail today, the lightbox next
  showCaptions: boolean;
}
```

`PhotoGallery/index.tsx` owns the single `GalleryState` object and passes
it, plus a `Partial<GalleryState>` merge setter, down to `GalleryToolbar`.
Everything downstream is a controlled read of this shape so the next task
(lightbox navigation, multi-select bulk actions, a dedicated Trash view)
can extend behavior without restructuring state.

- `lightboxPhotoId` currently opens `PhotoDetail` for the matching photo
  (found by id in the already-fetched list); a future lightbox component
  swaps in on the same field.
- `view` switches `fetchPhotos({ trash: view === 'trash' })`; the Trash
  toolbar button is present with a live count badge but inert this task
  (no dedicated Trash UI yet — flipping `view` still works and grid tiles
  already render the deleted-photo "N days left" badge).

## Components

- **`index.tsx`** — container. Owns `GalleryState`, the fetched
  `PhotoResponse[]`, quota, `trashCount`, and cursor pagination
  (`fetchPhotos({ babyId, trash, cursor })`). Reloads from scratch when
  `babyId` or `state.view` changes. Derives the filtered/grouped view with
  `useMemo` over `filterGalleryPhotos` → `groupByMonth` /
  `groupByMilestone` / a flat "all" pass. Renders the teal-gradient hero
  header (title, `PhotoQuotaMeter variant="dark"`, "Add Photos" →
  `PhotoForm`), `GalleryToolbar`, a `PhotoGrid` per group with a heading,
  a "Load more" button when `nextCursor` is set, and the two empty states
  (no photos at all vs. filtered to nothing).
- **`GalleryToolbar.tsx`** — grouping segmented control, search input,
  type chips (All/Photos/Feeds/Bath/Milestones), a Favorites heart chip, a
  Captions toggle chip, Select/Cancel, and the (inert) Trash indicator.
  Pure controlled component: `state` in, `onStateChange(partial)` out.
- **`PhotoGrid.tsx`** — responsive
  `grid-cols-[repeat(auto-fill,minmax(150px,1fr))]` of square tiles.
  Lazy-loads thumbnails via `useInView` + `useAuthedImage` so only
  on-screen tiles fetch. In select mode, clicking a tile toggles a
  checkmark badge instead of opening the photo; the favorite heart is a
  `span[role=button]` nested inside the tile `button` (kept out of select
  mode and off trashed photos) so the markup stays valid HTML. Captions
  render under the tile when `showCaptions` is true.

## Optimistic favorites

`handleToggleFavorite` in `index.tsx` flips the photo's `isFavorite` in
local state immediately, then calls `togglePhotoFavorite`; on failure it
reverts to the value captured before the flip. No full refetch is needed
for the common case.

## Files

- `index.tsx` — container: state, data fetching, layout
- `GalleryToolbar.tsx` — grouping/search/filter/select/captions controls
- `PhotoGrid.tsx` — tile grid + `GalleryTile`
- `photo-gallery.types.ts` — `GalleryState`, `GalleryView`,
  `GalleryGrouping`, component prop types
- `photo-gallery.css` — `html.dark` overrides for the hero header,
  segmented control, chips, search input, tiles, and trash badge
- `README.md` — this file

## Localization keys

New: `"Photos"` (existing), `"Add Photos"`, `"Month"`, `"All"`,
`"Favorites"`, `"Select"`, `"Trash"` (existing), `"Captions"`,
`"Group by"`, `"Load more"`,
`"No photos yet — capture your first moment!"`, `"No photos match"`,
`"Clear filters"`, `"days left"`, `"Photos are not enabled"`, `"NEW"`.
Reuses existing keys: `"Photo"`, `"Milestone"`, `"Milestones"`, `"Bath"`,
`"Feeds"`, `"No milestone"`, `"Cancel"`, `"Selected"`, `"Favorite"`,
`"Untitled photo"`, `"Search captions, milestones…"`, `"Loading"`.
