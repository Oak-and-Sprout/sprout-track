import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../db';
import {
  ApiResponse,
  AuthResult,
  withAuthContext,
} from '../../../utils/auth';
import {
  checkWritePermission,
} from '../../../utils/writeProtection';
import {
  executeExternalImport,
} from '@/src/lib/importers/execute';
import {
  parseExternalImportExecuteConfiguration,
} from '@/src/lib/importers/execution-request';
import {
  getExternalImportRuntimeProvider,
} from '@/src/lib/importers/runtime-registry';
import {
  readExternalImportUpload,
} from '@/src/lib/importers/upload';
import {
  ExternalImportExecutionResult,
} from '@/src/types/external-import';

async function handlePost(
  request: NextRequest,
  authContext: AuthResult,
): Promise<
  NextResponse<
    ApiResponse<ExternalImportExecutionResult>
  >
> {
  const writeCheck = checkWritePermission(authContext);

  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

  const familyId = authContext.familyId;

  if (!familyId) {
    return NextResponse.json<
      ApiResponse<ExternalImportExecutionResult>
    >(
      {
        success: false,
        error:
          'User is not associated with a family.',
      },
      { status: 403 },
    );
  }

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
        ApiResponse<ExternalImportExecutionResult>
      >(
        {
          success: false,
          error: `Unsupported import provider: ${upload.providerId}`,
        },
        { status: 400 },
      );
    }

    const configuration =
      parseExternalImportExecuteConfiguration(
        formData.get('configuration'),
      );

    const records = provider.buildRecords(
      upload.files,
      configuration.provider,
    );

    const result = await prisma.$transaction(
      tx =>
        executeExternalImport(tx, {
          familyId,
          caretakerId: authContext.caretakerId,
          records,
          configuration: configuration.execution,
        }),
    );

    return NextResponse.json<
      ApiResponse<ExternalImportExecutionResult>
    >({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(
      'External import execution failed:',
      error,
    );

    return NextResponse.json<
      ApiResponse<ExternalImportExecutionResult>
    >(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to execute external import',
      },
      { status: 400 },
    );
  }
}

export const POST = withAuthContext(handlePost);
