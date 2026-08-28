/**
 * Media migration shell (family export/import).
 *
 * Photos and vaccine documents are encrypted at rest under a per-instance
 * `ENC_HASH`. Source and target instances have different keys, so bytes cannot
 * be copied as-is: export **decrypts** to raw bytes and import **re-encrypts**
 * them under the target key with freshly minted stored names.
 *
 * Reuses the encryption/photo helpers verbatim (`src/lib/file-encryption.ts`,
 * `app/api/photos/photo-service.ts`) — no crypto is reimplemented here.
 *
 * Photo files live under `Files/photos/<familyId>/`; vaccine documents live in
 * the root `Files/` directory (no subdir), matching the live download routes.
 *
 * Decrypt/read failures on export (file missing or corrupt) are **skipped and
 * reported** by returning `null` — never fatal.
 */

import { decryptFile, encryptAndStore, generateStoredName } from '@/src/lib/file-encryption';
import { photoSubdir } from '@/app/api/photos/photo-service';
import type { MediaBytes } from '@/src/types/family-migration';

/** The stored-name fields the exporter needs from a Photo row. */
export interface ExportablePhoto {
  storedName: string;
  thumbStoredName: string;
}

/** The stored-name field the exporter needs from a VaccineDocument row. */
export interface ExportableVaccineDoc {
  storedName: string;
}

/** Fresh stored names produced when a photo is re-encrypted on import. */
export interface ImportedPhotoStored {
  storedName: string;
  thumbStoredName: string;
}

/**
 * Decrypt a photo's display image (and thumbnail when present) to raw bytes.
 * Returns `null` when the display image is missing/corrupt (skip the photo).
 * A missing/corrupt thumbnail is tolerated: the display bytes are returned with
 * `thumb` omitted.
 */
export function exportPhoto(photo: ExportablePhoto, sourceFamilyId: string): MediaBytes | null {
  const subdir = photoSubdir(sourceFamilyId);
  let display: Uint8Array;
  try {
    display = decryptFile(photo.storedName, subdir);
  } catch (error) {
    console.error(`Migration export: failed to decrypt photo ${photo.storedName}:`, error);
    return null;
  }

  let thumb: Uint8Array | undefined;
  try {
    thumb = decryptFile(photo.thumbStoredName, subdir);
  } catch (error) {
    console.error(
      `Migration export: failed to decrypt photo thumbnail ${photo.thumbStoredName}:`,
      error
    );
    thumb = undefined;
  }

  return thumb ? { display, thumb } : { display };
}

/**
 * Decrypt a vaccine document to raw bytes. Vaccine docs have no subdir.
 * Returns `null` when the file is missing/corrupt (skip the document).
 */
export function exportVaccineDoc(doc: ExportableVaccineDoc): Uint8Array | null {
  try {
    return decryptFile(doc.storedName);
  } catch (error) {
    console.error(`Migration export: failed to decrypt vaccine document ${doc.storedName}:`, error);
    return null;
  }
}

/**
 * Re-encrypt a photo's decrypted bytes under the target key with fresh stored
 * names. Returns the new `storedName`/`thumbStoredName` to persist on the Photo
 * row. When no thumbnail was carried, `thumbStoredName` is an empty string.
 */
export function importPhoto(
  display: Uint8Array,
  thumb: Uint8Array | undefined,
  targetFamilyId: string
): ImportedPhotoStored {
  const subdir = photoSubdir(targetFamilyId);
  const storedName = generateStoredName();
  encryptAndStore(Buffer.from(display), storedName, subdir);

  let thumbStoredName = '';
  if (thumb) {
    thumbStoredName = generateStoredName();
    encryptAndStore(Buffer.from(thumb), thumbStoredName, subdir);
  }

  return { storedName, thumbStoredName };
}

/**
 * Re-encrypt a vaccine document's decrypted bytes under the target key with a
 * fresh stored name (no subdir). Returns the new `storedName`.
 */
export function importVaccineDoc(bytes: Uint8Array): string {
  const storedName = generateStoredName();
  encryptAndStore(Buffer.from(bytes), storedName);
  return storedName;
}
