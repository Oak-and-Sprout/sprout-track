# CameraCaptureModal

In-app webcam capture dialog for devices where the file input's `capture` attribute does nothing (desktops and touch laptops). Presents a viewfinder with a live `getUserMedia` preview, a circular shutter, retake/use-photo controls, and a camera-flip button when more than one camera is present. Emits a single JPEG `File` (quality 0.9, named `capture-YYYY-MM-DD-HH-mm-ss.jpg`).

## Usage

Most surfaces should not use the modal directly — use the co-located `useTakePhoto` hook, which picks the right mechanism per device via `useCameraStrategy` / `decideCameraStrategy` (`src/utils/photoUtils.ts`):

```tsx
import { CameraCaptureModal, useTakePhoto } from '@/src/components/ui/camera-capture';

const camera = useTakePhoto((files) => appendFiles(files));

<button onClick={camera.takePhoto}>{t('Take Photo')}</button>
<button onClick={() => camera.libraryInputRef.current?.click()}>{t('Library')}</button>

<input ref={camera.captureInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFiles} />
<input ref={camera.libraryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
<CameraCaptureModal open={camera.cameraOpen} onClose={camera.closeCamera} onCapture={camera.handleCapture} />
```

Strategies: `native-capture` (coarse pointer + touch — the OS camera opens via the capture input), `webcam-modal` (fine pointer with `mediaDevices`), `library-only` (no camera path, e.g. insecure context — `takePhoto()` falls through to the library input).

## Props (`CameraCaptureModalProps`)

| Prop | Type | Description |
| --- | --- | --- |
| `open` | `boolean` | Whether the dialog is open. |
| `onClose` | `() => void` | Close requested (backdrop, X, or after capture). |
| `onCapture` | `(file: File) => void` | Receives the captured JPEG. |
| `initialFacingMode` | `'user' \| 'environment'` | Camera to start with; defaults to `'user'`. |

## Implementation notes

- Stream lifecycle lives in one effect keyed `[open, facingMode, retryNonce]` with a cancelled flag, so StrictMode double-invokes and closing during the permission prompt never leak a live track. All tracks stop on close/unmount.
- `enumerateDevices` runs only after `getUserMedia` resolves (labels/counts are unreliable before permission) to decide whether the flip button shows.
- The live preview is CSS-mirrored for the front camera and the mirror is baked into the captured canvas frame, so preview and result match.
- The shutter stays disabled until `loadedmetadata` (`videoWidth > 0`); `canvas.toBlob` null results are ignored.
- The stream stays live during the captured preview so Retake is instant.
- The viewfinder well and its controls are intentionally dark with white chrome in both themes (they sit on video); `camera-capture.css` documents why there are no `html.dark` overrides.
- getUserMedia requires a secure context (HTTPS or localhost). Elsewhere, `useCameraStrategy` degrades to `library-only` and this modal is never opened.
