import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from '../../types';
import { REFRESH_TOKEN_LIFE } from '../../utils/auth';

/**
 * API endpoint to get the idle time value.
 * Returns REFRESH_TOKEN_LIFE so idle timeout aligns with the refresh token window.
 * Active devices stay logged in indefinitely via refresh token sliding window.
 */
export async function GET(req: NextRequest) {
  // Use REFRESH_TOKEN_LIFE so idle timeout matches the refresh window
  // Falls back to IDLE_TIME env var for backward compatibility if set
  const idleTime = parseInt(process.env.IDLE_TIME || '0', 10) || REFRESH_TOKEN_LIFE;

  return NextResponse.json<ApiResponse<number>>(
    {
      success: true,
      data: idleTime
    }
  );
}
