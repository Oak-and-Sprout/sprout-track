# PhotoGallery

The `/[slug]/photos` page: a family-wide (optionally baby-scoped) photo
gallery with month/milestone grouping, live search, type + favorites
filtering, a toggleable captions display, select mode with a floating
selection bar, a full-screen keyboard-navigable lightbox, and a dedicated
Trash view.

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
export type GalleryGrouping = 'month' | 'milestone';

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
Everything downstream is a controlled read of this shape.

- `lightboxPhotoId` opens `Lightbox` for the matching photo. Navigation is
  computed from the photo's index in the current filtered list (falling
  back to a single-item list if the open photo has been filtered out from
  under it, e.g. opened from `PhotoForm`'s Photo Library tab while a search
  filter is active). `PhotoDetail` is still used elsewhere (e.g. Timeline)
  but no longer by the gallery — tile clicks open `Lightbox` instead.
- `view` switches between the main grid and `TrashView`, which does its own
  `fetchPhotos({ trash: true })` and reuses `PhotoGrid` with `selectMode`
  always on. The toolbar's Trash button (with live count badge) sets
  `view: 'trash'`.
- `selectMode` + non-empty `selectedIds` shows the floating `SelectionBar`
  (bulk download/trash, with an inline confirm for delete).

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
  Captions toggle chip, Select/Cancel, and the Trash indicator (switches to
  `view: 'trash'`, clearing select mode). Pure controlled component:
  `state` in, `onStateChange(partial)` out.
- **`PhotoGrid.tsx`** — responsive
  `grid-cols-[repeat(auto-fill,minmax(150px,1fr))]` of square tiles.
  Lazy-loads thumbnails via `useInView` + `useAuthedImage` so only
  on-screen tiles fetch. In select mode, clicking a tile toggles a
  checkmark badge instead of opening the photo; the favorite heart is a
  `span[role=button]` nested inside the tile `button` (kept out of select
  mode and off trashed photos) so the markup stays valid HTML. Captions
  render under the tile when `showCaptions` is true.
- **`Lightbox.tsx`** — full-screen overlay (`role="dialog" aria-modal`)
  with the image on one side (`useAuthedImage` full size, spinner while
  loading) and metadata (caption, taken date/time, type chip, milestone
  chip, linked activity, favorite/download/delete) on the other. Prev/next
  arrow buttons plus `ArrowLeft`/`ArrowRight`/`Escape` keyboard handling,
  computed from the photo's index in the `photos` list prop. Stacks
  vertically under 940px with the image capped at `42vh` (see
  `photo-gallery.css`). Locks `document.body` scroll while mounted. All
  mutations are delegated to `index.tsx` via props — this component only
  renders and manages its own per-button busy state.
- **`SelectionBar.tsx`** — fixed bottom-center pill shown while
  `selectMode` is on and at least one photo is selected. Download loops
  `downloadPhoto` sequentially over the selection; Delete asks for an
  inline two-button confirm (no `window.confirm`) before bulk-trashing.
- **`TrashView.tsx`** — owns its own fetch/pagination/selection state
  (independent of the main gallery's), always renders `PhotoGrid` in
  select mode so tiles toggle selection directly. Restore and Delete
  Forever act on the current selection via `bulkPhotoAction`; Delete
  Forever has an inline confirm. Calls `onChanged()` after any mutation so
  `index.tsx` can refresh quota/trash-count in the header.

## Optimistic favorites

`handleToggleFavorite` in `index.tsx` flips the photo's `isFavorite` in
local state immediately, then calls `togglePhotoFavorite`; on failure it
reverts to the value captured before the flip. No full refetch is needed
for the common case.

## Files

- `index.tsx` — container: state, data fetching, layout
- `GalleryToolbar.tsx` — grouping/search/filter/select/captions controls
- `PhotoGrid.tsx` — tile grid + `GalleryTile`
- `Lightbox.tsx` — full-screen photo viewer with prev/next navigation
- `SelectionBar.tsx` — floating bulk-action bar for select mode
- `TrashView.tsx` — Trash list with restore/purge
- `photo-gallery.types.ts` — `GalleryState`, `GalleryView`,
  `GalleryGrouping`, component prop types
- `photo-gallery.css` — responsive lightbox layout (940px breakpoint) and
  `html.dark` overrides for the hero header, segmented control, chips,
  search input, tiles, trash badge, lightbox, and Trash view
- `README.md` — this file

## Localization keys

New: `"Photos"` (existing), `"Add Photos"`, `"Month"`, `"All"`,
`"Favorites"`, `"Select"`, `"Trash"` (existing), `"Captions"`,
`"Group by"`, `"Load more"`,
`"No photos yet — capture your first moment!"`, `"No photos match"`,
`"Clear filters"`, `"days left"`, `"Photos are not enabled"`, `"NEW"`,
`"selected"`, `"Restore"`, `"Delete Forever"`, `"Delete forever?"`,
`"Trash is empty"`, `"Items are deleted forever after 30 days."`,
`"Previous photo"`, `"Next photo"`, `"Move to Trash?"`,
`"Failed to restore photo"`.
Reuses existing keys: `"Photo"`, `"Milestone"`, `"Milestones"`, `"Bath"`,
`"Feeds"`, `"No milestone"`, `"Cancel"`, `"Selected"`, `"Favorite"`,
`"Favorited"`, `"Untitled photo"`, `"Search captions, milestones…"`,
`"Loading"`, `"Retry"`, `"Close"`, `"Download"`, `"Delete"`, `"Yes"`,
`"No"`, `"Back"`, `"Taken:"`, `"Type:"`, `"Milestone:"`,
`"Linked activity:"`, `"Failed to delete photo"`, `"Failed to load photos"`.
