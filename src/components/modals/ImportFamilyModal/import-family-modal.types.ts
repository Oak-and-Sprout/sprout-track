export interface ImportFamilyModalProps {
  /** Whether the modal is open. */
  isOpen: boolean;
  /** Close handler. */
  onClose: () => void;
  /** Called after a successful import so the caller can refresh the family list. */
  onImported?: () => void;
  /**
   * A migration export the unified import button already detected. When provided,
   * the modal opens with it pre-loaded and previewed, skipping the initial pick.
   */
  file?: File | null;
}
