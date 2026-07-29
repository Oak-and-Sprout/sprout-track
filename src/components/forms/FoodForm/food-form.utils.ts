/**
 * What the Food Tracker does once a food log saves.
 *
 * The tracker used to refresh and notify the parent but never close, so a save
 * from the Log Entry page left the user parked on the form with nothing to do
 * but dismiss it by hand (issue #254). Every single-purpose form (Diaper, Bath,
 * Feed, ...) closes itself on save; this keeps the tracker consistent with them.
 *
 * Order matters: refresh the tabs and let the parent re-fetch before the close
 * unmounts anything.
 */
export interface FoodLogSaveCompletion {
  refreshData: () => void;
  onSuccess?: () => void;
  onClose: () => void;
}

export function completeFoodLogSave({ refreshData, onSuccess, onClose }: FoodLogSaveCompletion): void {
  refreshData();
  onSuccess?.();
  onClose();
}
