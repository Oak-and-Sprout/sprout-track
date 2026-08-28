/**
 * Styles for ImportFamilyModal. Light-mode Tailwind utilities here; dark-mode
 * overrides live in import-family-modal.css under html.dark selectors.
 */

export const importFamilyModalStyles = {
  uploadRow: 'flex items-center gap-3 flex-wrap',
  fileName: 'text-sm text-gray-600 truncate max-w-[60%] import-family-modal-filename',
  error: 'flex items-center p-3 rounded-md border border-red-200 bg-red-50 text-sm text-red-700 import-family-modal-error',
  fields: 'space-y-3 rounded-md border border-gray-200 p-3 import-family-modal-fields',
  select:
    'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 import-family-modal-select',
} as const;
