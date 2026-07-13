# Photo Attachments Component

A reusable photo attachment strip component that manages locally-pending files and displays existing photos. Used across activity forms (Feeding, Diaper, Sleep, Mood, Activity) and the dedicated PhotoForm.

## Features

- Display existing photo thumbnails with optional remove button
- Show pending (not-yet-uploaded) photo thumbnails with remove functionality
- Add new photos via camera or photo library picker
- Enforce maximum photo count (default 4 per activity)
- Object URL management: creates and revokes URLs automatically for pending thumbnails
- Disabled state to prevent new additions while maintaining display
- Accessible controls with proper ARIA labels
- Dark mode support
- Localization-aware labels and hints

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `pendingFiles` | `File[]` | Required | Array of File objects pending upload |
| `onPendingFilesChange` | `(files: File[]) => void` | Required | Callback fired when pending files change (add or remove) |
| `existingPhotos` | `AttachedPhotoInfo[]` | `[]` | Array of already-linked photos (edit mode) |
| `onRemoveExisting` | `(photoId: string) => void` | `undefined` | Optional callback to remove existing photo; omit to hide remove buttons |
| `onPhotoClick` | `(photoId: string) => void` | `undefined` | Optional callback when tapping existing photo (e.g., navigate to PhotoDetail) |
| `maxPhotos` | `number` | `MAX_PHOTOS_PER_ACTIVITY` (4) | Maximum number of photos allowed |
| `disabled` | `boolean` | `false` | When true, prevents adding new photos and disables remove on existing |

## Types

```typescript
export interface AttachedPhotoInfo {
  id: string;
  caption: string | null;
}

export interface PhotoAttachmentsProps {
  pendingFiles: File[];
  onPendingFilesChange: (files: File[]) => void;
  existingPhotos?: AttachedPhotoInfo[];
  onRemoveExisting?: (photoId: string) => void;
  onPhotoClick?: (photoId: string) => void;
  maxPhotos?: number;
  disabled?: boolean;
}
```

## Usage Examples

### Basic Usage (New Activity)

```tsx
import { useState } from 'react';
import { PhotoAttachments } from '@/src/components/ui/photo-attachments';

export function FeedingForm() {
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);

  return (
    <form>
      <input type="text" placeholder="Notes" />
      <PhotoAttachments
        pendingFiles={pendingPhotos}
        onPendingFilesChange={setPendingPhotos}
      />
      <button type="submit">Save</button>
    </form>
  );
}
```

### Edit Mode with Existing Photos

```tsx
import { useState } from 'react';
import { PhotoAttachments } from '@/src/components/ui/photo-attachments';

export function ActivityEditor() {
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState([
    { id: 'photo-1', caption: 'Before nap' },
    { id: 'photo-2', caption: null },
  ]);

  const handleRemoveExisting = (photoId: string) => {
    setExistingPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  const handlePhotoClick = (photoId: string) => {
    // Navigate to photo detail/viewer
    console.log('View photo:', photoId);
  };

  return (
    <PhotoAttachments
      pendingFiles={pendingPhotos}
      onPendingFilesChange={setPendingPhotos}
      existingPhotos={existingPhotos}
      onRemoveExisting={handleRemoveExisting}
      onPhotoClick={handlePhotoClick}
    />
  );
}
```

### Disabled/Read-Only State

```tsx
<PhotoAttachments
  pendingFiles={[]}
  onPendingFilesChange={() => {}}
  existingPhotos={activity.photos}
  disabled
/>
```

## Implementation Details

### Component Structure

- `index.tsx` - Main component with ExistingThumb and PendingThumb subcomponents
- `photo-attachments.styles.ts` - CVA style definitions (light mode)
- `photo-attachments.css` - Dark mode overrides using `html.dark` selectors
- `photo-attachments.types.ts` - TypeScript interfaces
- `README.md` - This file

### Key Behaviors

1. **Max Photo Enforcement**: Total count includes both existing and pending files. New selections are sliced to fit remaining capacity.

2. **Object URL Management**: 
   - Pending thumbnails use `URL.createObjectURL()` to display local files
   - URLs are automatically revoked in a cleanup effect when the component unmounts or file changes
   - This prevents memory leaks when files are removed

3. **Accessibility**:
   - All interactive elements have aria-labels
   - File input hidden and triggered via button click
   - Remove badges use small round button pattern with X icon

4. **iOS Camera Behavior**:
   - The input has `capture="environment"` to force camera on iOS
   - Note: In some iOS versions, `capture="environment"` restricts to camera-only, blocking library access
   - If needed, remove `capture` attribute to allow both camera and library via native picker

5. **Dark Mode**: Uses `html.dark` class selectors in `.css` file (not Tailwind `dark:` classes) to honor the app's in-app theme toggle

## Localization Keys

Required translation keys in `en.json`:
- `"View photo"` - aria-label for existing photo thumbnails
- `"Remove photo"` - aria-label for remove buttons
- `"Add photo"` - aria-label for add tile button
- `"Attach up to 4 photos — they'll show on the timeline and in the gallery."` - Hint text below thumbnails

## File Upload Handling

Photos are **not uploaded** when selected. Files are held locally in component state until:
- The activity is saved to the database
- Then images are uploaded via a separate flow (e.g., on form submission)

This prevents orphaned photos in the storage if the user cancels the activity form without saving.

## Styling

### Light Mode (Tailwind CVA)
- Thumbnails: 84x84px, rounded corners, gray background
- Remove badge: 23x23px circle, top-right corner, slate background
- Add tile: dashed border, teal hover state
- Hint text: small gray text below thumbnails

### Dark Mode (html.dark CSS)
- Thumbnails: unchanged (inherited)
- Add tile: slate background, teal hover state
- Hint text: lighter gray for dark backgrounds

## Error Handling

- Failed thumbnail loads (e.g., deleted photo): Shows ImageOff icon instead of broken image
- Invalid files (non-images): Native file picker handles — this component trusts `accept="image/*"`
- Network errors on existing photos: Falls back to ImageOff icon via `useAuthedImage` hook

## Performance

- Memoizes object URLs via `useMemo` to avoid recreating on every render
- Cleanup effect properly revokes URLs to prevent memory leaks
- File removal filters in place to avoid re-rendering all thumbnails
