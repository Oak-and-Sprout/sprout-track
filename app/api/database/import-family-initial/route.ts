import { NextRequest, NextResponse } from 'next/server';
import { withAuthContext, ApiResponse, AuthResult } from '../../utils/auth';
import { readManifest } from '@/src/utils/migration-parse';
import {
  importMigration,
  toPreview,
  type MigrationPreview,
  type ImportMigrationResult,
} from '../../utils/family-migration-import';

/**
 * Setup-wizard family-migration import (first-run). Always `new-family` mode
 * (empty instance → no dedup toggle, no family picker). Auth mirrors
 * `restore-initial/route.ts`: `withAuthContext`, which permits a setup-token
 * session as well as a system administrator.
 *
 * Request: multipart/form-data
 *   file       (.zip, required both steps)
 *   step       'preview' | 'confirm'   (default 'preview')
 *   newFamily  JSON '{"name","slug"}'  (confirm; defaults to the manifest's source family)
 *
 * Response data:
 *   preview → { preview: MigrationPreview }
 *   confirm → { report: MigrationReport, targetFamilyId: string }
 */
async function handler(req: NextRequest, _authContext: AuthResult): Promise<NextResponse<ApiResponse<any>>> {
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

    const manifest = await readManifest(buffer);

    if (step !== 'confirm') {
      const preview: MigrationPreview = toPreview(manifest);
      return NextResponse.json<ApiResponse<{ preview: MigrationPreview }>>({ success: true, data: { preview } });
    }

    // Confirm — always new-family. Name/slug default to the source family.
    const rawNewFamily = form.get('newFamily') as string | null;
    let newFamily = { name: manifest.family.name, slug: manifest.family.slug };
    if (rawNewFamily) {
      try {
        const parsed = JSON.parse(rawNewFamily);
        if (typeof parsed?.name === 'string' && parsed.name) newFamily.name = parsed.name;
        if (typeof parsed?.slug === 'string' && parsed.slug) newFamily.slug = parsed.slug;
      } catch {
        return NextResponse.json({ success: false, error: 'newFamily must be JSON with name and slug' }, { status: 400 });
      }
    }

    const result: ImportMigrationResult = await importMigration(buffer, { mode: 'new-family', newFamily, dedup: false });
    return NextResponse.json<ApiResponse<ImportMigrationResult>>({ success: true, data: result });
  } catch (error) {
    console.error('Initial setup family-migration import failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Family migration import failed' },
      { status: 500 },
    );
  }
}

export const POST = withAuthContext(handler);
