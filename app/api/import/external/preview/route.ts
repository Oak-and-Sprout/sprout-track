import { NextRequest, NextResponse } from 'next/server';
import {
  ApiResponse,
  AuthResult,
  withAuthContext,
} from '../../../utils/auth';
import {
  ExternalImportProviderPreview,
  getExternalImportRuntimeProvider,
} from '@/src/lib/importers/runtime-registry';
import {
  readExternalImportUpload,
} from '@/src/lib/importers/upload';

async function handlePost(
  request: NextRequest,
  authContext: AuthResult,
): Promise<
  NextResponse<
    ApiResponse<ExternalImportProviderPreview>
  >
> {
  const hasImportPermission =
    authContext.isSysAdmin ||
    authContext.isSetupAuth ||
    authContext.isAccountOwner ||
    authContext.caretakerRole === 'ADMIN' ||
    authContext.caretakerRole === 'OWNER';

  if (!hasImportPermission) {
    return NextResponse.json(
      {
        success: false,
        error: 'Administrator access is required to import external data.',
      },
      { status: 403 },
    );
  }

  try {
    const formData = await request.formData();
    const upload = await readExternalImportUpload(
      formData,
    );

    const provider =
      getExternalImportRuntimeProvider(
        upload.providerId,
      );

    if (!provider) {
      return NextResponse.json<
        ApiResponse<ExternalImportProviderPreview>
      >(
        {
          success: false,
          error: `Unsupported import provider: ${upload.providerId}`,
        },
        { status: 400 },
      );
    }

    const preview = provider.previewFiles(
      upload.files,
    );

    return NextResponse.json<
      ApiResponse<ExternalImportProviderPreview>
    >({
      success: true,
      data: preview,
    });
  } catch (error) {
    return NextResponse.json<
      ApiResponse<ExternalImportProviderPreview>
    >(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to preview import files',
      },
      { status: 400 },
    );
  }
}

export const POST = withAuthContext(handlePost);
