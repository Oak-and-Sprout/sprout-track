import { NextRequest, NextResponse } from 'next/server';
import { withSysAdminAuth, ApiResponse } from '../../utils/auth';
import { readManifest } from '@/src/utils/migration-parse';
import {
  importMigration,
  toPreview,
  type MigrationPreview,
  type ImportMigrationResult,
} from '../../utils/family-migration-import';
import type { ImportMode } from '@/src/types/family-migration';

/**
 * Sysadmin family-migration import — two-step.
 *
 * Request: multipart/form-data
 *   file       (.zip, required both steps)
 *   step       'preview' | 'confirm'   (default 'preview')
 *   -- confirm only --
 *   mode         'new-family' | 'append'
 *   targetFamilyId   string             (required when mode = 'append')
 *   newFamily    JSON '{"name","slug"}' (required when mode = 'new-family')
 *   dedup        'true' | 'false'       (append only; default 'true')
 *
 * Response data:
 *   preview → { preview: MigrationPreview }
 *   confirm → { report: MigrationReport, targetFamilyId: string }
 */
async function handler(req: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }
    if (!file.name.endsWith('.zip')) {
      return NextResponse.json({ success: false, error: 'Expected a .zip migration archive' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const step = (form.get('step') as string | null) ?? 'preview';

    // --- Step 1: parse-only preview (no import) ----------------------------
    if (step !== 'confirm') {
      const manifest = await readManifest(buffer);
      const preview: MigrationPreview = toPreview(manifest);
      return NextResponse.json<ApiResponse<{ preview: MigrationPreview }>>({ success: true, data: { preview } });
    }

    // --- Step 2: confirm → import ------------------------------------------
    const mode = (form.get('mode') as string | null) as ImportMode | null;
    if (mode !== 'new-family' && mode !== 'append') {
      return NextResponse.json({ success: false, error: 'Invalid or missing mode' }, { status: 400 });
    }

    if (mode === 'append') {
      const targetFamilyId = form.get('targetFamilyId') as string | null;
      if (!targetFamilyId) {
        return NextResponse.json({ success: false, error: 'targetFamilyId is required for append mode' }, { status: 400 });
      }
      const dedup = (form.get('dedup') as string | null) !== 'false'; // default true
      const result: ImportMigrationResult = await importMigration(buffer, { mode, targetFamilyId, dedup });
      return NextResponse.json<ApiResponse<ImportMigrationResult>>({ success: true, data: result });
    }

    // new-family
    const rawNewFamily = form.get('newFamily') as string | null;
    let newFamily: { name: string; slug: string };
    try {
      const parsed = rawNewFamily ? JSON.parse(rawNewFamily) : null;
      if (!parsed || typeof parsed.name !== 'string' || typeof parsed.slug !== 'string' || !parsed.name || !parsed.slug) {
        throw new Error('bad newFamily');
      }
      newFamily = { name: parsed.name, slug: parsed.slug };
    } catch {
      return NextResponse.json({ success: false, error: 'newFamily (JSON with name and slug) is required for new-family mode' }, { status: 400 });
    }

    const result: ImportMigrationResult = await importMigration(buffer, { mode, newFamily, dedup: false });
    return NextResponse.json<ApiResponse<ImportMigrationResult>>({ success: true, data: result });
  } catch (error) {
    console.error('Family migration import failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Family migration import failed' },
      { status: 500 },
    );
  }
}

export const POST = withSysAdminAuth(handler);
