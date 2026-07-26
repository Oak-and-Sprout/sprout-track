# PhotoDetail

Single-photo viewer/editor drawer. Opened from the Photo Library tab,
timeline thumbnails, and record views to inspect, favorite, caption,
download, or trash one photo.

## Props

```typescript
export interface PhotoDetailProps {
  isOpen: boolean;
  onClose: () => void;
  photo: PhotoResponse | null; // parent supplies the loaded photo
  onChanged?: () => void; // fired after favorite/caption/delete so parents refetch
}
```

The parent always already holds the loaded `PhotoResponse` (from a list
fetch or a record's attachments), so `PhotoDetail` takes the photo object
directly rather than an id + an internal fetch. This keeps it a pure
presentational drawer with no data-fetching of its own beyond the image
bytes.

## Features

- Full-size image via `useAuthedImage(photoFileUrl(photo.id, 'full'))`,
  with a loading skeleton and an `ImageOff` fallback on error.
- Favorite overlay button on the image (heart, top-right, `aria-pressed`,
  dynamic `aria-label` — "Favorite" / "Remove from favorites").
- Inline-editable caption: a pencil button toggles an `Input`; saves on
  blur or Enter via `updatePhoto(id, { caption })`, Escape cancels
  without saving. No-op saves (unchanged text) skip the network call.
- Metadata rows: Taken (localized date • time via `formatDateLong` /
  `formatTimeDisplay` + `useTimezone()`), Type, Milestone (chip, only
  when tagged), Linked activity.
- Action row: Favorite / Download (`downloadPhoto`) / Delete
  (`trashPhoto` → `onChanged?.()` → `onClose()`), with a hint that
  trashed photos auto-purge after 30 days.
- All mutations (`updatePhoto`, `togglePhotoFavorite`, `downloadPhoto`,
  `trashPhoto`) are wrapped in try/catch with a localized inline error
  message — no unhandled promise rejections.
- Local `caption`/`isFavorite` state re-syncs from the `photo` prop
  whenever `photo.id`, `photo.caption`, or `photo.isFavorite` change, so
  edits reflect immediately and external refetches (via `onChanged`)
  don't leave stale text/heart state behind.

## Type / Linked activity rows — design note

`PhotoResponse.links` only carries `{ activityType, activityId }` pairs
(no readable title/time for the linked record), so the two rows are
derived from the same `links` array but answer different questions:

- **Type** — the first link's `activityType`, mapped through
  `TYPE_LABEL_KEYS` (`photo` → "Photo", `feed` → "Feed", `milestone` →
  "Milestone", `bath` → "Bath", `play` → "Activity", `measurement` →
  "Measurement"). This is "what kind of entry is this photo part of."
- **Linked activity** — the first link whose `activityType` is *not*
  `'photo'` (the standalone Photo Library/quick-log entry) or
  `'milestone'` (already shown by its own chip row). This surfaces a
  genuine cross-reference to a Feed/Bath/Activity/Measurement record, or
  an em dash (`—`) when there isn't one.

For a photo tagged only to a milestone, Type shows "Milestone" and
Linked activity shows "—". For a photo attached inside a Feed entry,
both show "Feed" — that overlap is expected since a feed-attached photo
genuinely is both a "Feed"-typed entry and linked to a feed record.

## Usage

```tsx
import PhotoDetail from '@/src/components/PhotoDetail';

<PhotoDetail
  isOpen={detailOpen}
  onClose={() => setDetailOpen(false)}
  photo={selectedPhoto}
  onChanged={() => refetchPhotos()}
/>
```

## Files

- `index.tsx` — component implementation
- `photo-detail.types.ts` — `PhotoDetailProps`
- `photo-detail.css` — `html.dark` overrides for row labels, hint text,
  image skeleton/background, favorite overlay, and the milestone chip
- `README.md` — this file

## Localization keys

`"Taken:"`, `"Type:"`, `"Milestone:"`, `"Linked activity:"`,
`"Favorited"`, `"Edit caption"`,
`"Deleted photos move to Trash and auto-delete after 30 days."`,
`"Failed to update caption"`, `"Failed to update favorite"`,
`"Failed to download photo"`, `"Failed to delete photo"`. Reuses
existing keys: `"Photo"`, `"Feed"`, `"Milestone"`, `"Bath"`, `"Activity"`,
`"Measurement"`, `"Favorite"`, `"Remove from favorites"`, `"Download"`,
`"Delete"`, `"Close"`, `"Untitled photo"`.
