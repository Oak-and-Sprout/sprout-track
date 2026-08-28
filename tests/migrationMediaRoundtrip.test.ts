import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';

// AES-256-GCM key = Buffer.from(ENC_HASH, 'hex') -> 32 bytes -> 64 hex chars.
// Set before the file-encryption helpers read it (they read env at call time).
process.env.ENC_HASH = '0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0';

import {
  exportPhoto,
  exportVaccineDoc,
  importPhoto,
  importVaccineDoc,
} from '@/app/api/utils/family-migration-media';
import { photoSubdir } from '@/app/api/photos/photo-service';

const FILES_DIR = path.join(process.cwd(), 'Files');
const TEST_FAMILY = 'mig-media-test-family';

const createdVaccineNames: string[] = [];

afterAll(() => {
  // Remove the per-family photo subdir and any vaccine-doc files we wrote.
  fs.rmSync(path.join(FILES_DIR, photoSubdir(TEST_FAMILY)), { recursive: true, force: true });
  for (const name of createdVaccineNames) {
    fs.rmSync(path.join(FILES_DIR, name), { force: true });
  }
});

const bytes = (s: string) => new Uint8Array(Buffer.from(s, 'utf8'));

describe('family-migration-media round-trip', () => {
  it('re-encrypts and decrypts a photo (display + thumb) back to the original bytes', () => {
    const display = bytes('the-original-display-image-bytes');
    const thumb = bytes('the-original-thumbnail-bytes');

    const stored = importPhoto(display, thumb, TEST_FAMILY);
    expect(stored.storedName).toMatch(/\.enc$/);
    expect(stored.thumbStoredName).toMatch(/\.enc$/);
    expect(stored.storedName).not.toBe(stored.thumbStoredName);

    const exported = exportPhoto(
      { storedName: stored.storedName, thumbStoredName: stored.thumbStoredName },
      TEST_FAMILY
    );
    expect(exported).not.toBeNull();
    expect(Buffer.from(exported!.display)).toEqual(Buffer.from(display));
    expect(exported!.thumb).toBeDefined();
    expect(Buffer.from(exported!.thumb!)).toEqual(Buffer.from(thumb));
  });

  it('re-encrypts and decrypts a vaccine document (no subdir) back to the original bytes', () => {
    const data = bytes('%PDF-1.4 vaccine record contents');
    const storedName = importVaccineDoc(data);
    createdVaccineNames.push(storedName);
    expect(storedName).toMatch(/\.enc$/);

    // File lives in the root Files/ dir (no subdir).
    expect(fs.existsSync(path.join(FILES_DIR, storedName))).toBe(true);

    const exported = exportVaccineDoc({ storedName });
    expect(exported).not.toBeNull();
    expect(Buffer.from(exported!)).toEqual(Buffer.from(data));
  });

  it('returns null (skipped, not fatal) when a photo file is missing', () => {
    const exported = exportPhoto(
      { storedName: 'does-not-exist.enc', thumbStoredName: 'nope.enc' },
      TEST_FAMILY
    );
    expect(exported).toBeNull();
  });

  it('returns null (skipped, not fatal) when a vaccine document file is missing', () => {
    expect(exportVaccineDoc({ storedName: 'missing-vaccine.enc' })).toBeNull();
  });

  it('omits thumb but keeps display when only the thumbnail is missing', () => {
    const display = bytes('display-present');
    const thumb = bytes('thumb-present');
    const stored = importPhoto(display, thumb, TEST_FAMILY);

    // Delete only the thumbnail on disk.
    fs.rmSync(path.join(FILES_DIR, photoSubdir(TEST_FAMILY), stored.thumbStoredName), { force: true });

    const exported = exportPhoto(
      { storedName: stored.storedName, thumbStoredName: stored.thumbStoredName },
      TEST_FAMILY
    );
    expect(exported).not.toBeNull();
    expect(Buffer.from(exported!.display)).toEqual(Buffer.from(display));
    expect(exported!.thumb).toBeUndefined();
  });
});
