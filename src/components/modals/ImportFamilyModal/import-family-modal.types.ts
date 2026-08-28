export interface ImportFamilyModalProps {
  /** Whether the modal is open. */
  isOpen: boolean;
  /** Close handler. */
  onClose: () => void;
  /** Called after a successful import so the caller can refresh the family list. */
  onImported?: () => void;
}
