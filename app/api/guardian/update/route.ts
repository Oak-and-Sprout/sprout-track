import { NextRequest, NextResponse } from 'next/server';
import { withSysAdminAuth } from '../../utils/auth';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const getGuardianUrl = () => {
  const port = process.env.ST_GUARDIAN_PORT || '3001';
  return `http://127.0.0.1:${port}`;
};

const getGuardianKey = () => {
  return process.env.ST_GUARDIAN_KEY || '';
};

async function getHandler(req: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
  const key = getGuardianKey();
  if (!key) {
    return NextResponse.json(
      { success: false, error: 'ST_GUARDIAN_KEY not configured in environment' },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const endpoint = url.searchParams.get('endpoint') || 'status';

  const guardianUrl = getGuardianUrl();
  let targetPath: string;

  switch (endpoint) {
    case 'status':
      targetPath = '/status';
      break;
    case 'update-status':
      targetPath = '/update/status';
      break;
    case 'version':
      targetPath = '/version';
      break;
    default:
      targetPath = '/status';
  }

  try {
    const response = await fetch(`${guardianUrl}${targetPath}`, {
      headers: { 'X-Guardian-Key': key },
      signal: AbortSignal.timeout(5000),
    });

    const data = await response.json();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unable to connect to ST-Guardian service' },
      { status: 503 }
    );
  }
}

async function postHandler(req: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
  const key = getGuardianKey();
  if (!key) {
    return NextResponse.json(
      { success: false, error: 'ST_GUARDIAN_KEY not configured in environment' },
      { status: 500 }
    );
  }

  const guardianUrl = getGuardianUrl();

  try {
    const response = await fetch(`${guardianUrl}/update`, {
      method: 'POST',
      headers: {
        'X-Guardian-Key': key,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    const data = await response.json();

    if (response.status === 409) {
      return NextResponse.json(
        { success: false, error: 'An update is already in progress' },
        { status: 409 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data.error || 'Update request failed' },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unable to connect to ST-Guardian service' },
      { status: 503 }
    );
  }
}

export const GET = withSysAdminAuth(getHandler);
export const POST = withSysAdminAuth(postHandler);
