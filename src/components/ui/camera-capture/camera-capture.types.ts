import { CameraFacingMode } from '@/src/utils/photoUtils';

export type CameraPhase = 'requesting' | 'streaming' | 'captured' | 'error';

export interface CameraCaptureModalProps {
  /** Whether the capture dialog is open. */
  open: boolean;
  /** Called when the dialog should close (backdrop, X, or after capture). */
  onClose: () => void;
  /** Receives the captured photo as a JPEG File. */
  onCapture: (file: File) => void;
  /** Camera to start with. Defaults to 'user' (desktop webcams). */
  initialFacingMode?: CameraFacingMode;
}
