import { NextRequest, NextResponse } from 'next/server';
import { logApiCall, getClientInfo, ApiLogEntry } from './api-logger';
import { AuthResult } from './auth';

/**
 * Middleware wrapper that adds automatic API logging to route handlers
 * Captures request/response data, timing, and errors
 */
export function withLogging<T = any>(
  handler: (req: NextRequest, authContext?: AuthResult) => Promise<NextResponse<T>>
) {
  return async (req: NextRequest, authContext?: AuthResult): Promise<NextResponse<T>> => {
    const startTime = Date.now();
    const { ip, userAgent } = getClientInfo(req);
    const url = new URL(req.url);

    let requestBody: any = null;
    let response: NextResponse<T>;
    let status: number | undefined;
    let error: string | undefined;
    let responseBody: any = null;

    try {
      // Try to capture request body (for POST/PUT/PATCH)
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        try {
          const clonedReq = req.clone();
          requestBody = await clonedReq.json();
        } catch {
          // Body might not be JSON or already consumed
        }
      }

      // Call the actual handler
      response = await handler(req, authContext);
      status = response.status;

      // Try to capture response body
      try {
        const clonedRes = response.clone();
        responseBody = await clonedRes.json();
      } catch {
        // Response might not be JSON
      }

      return response;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      status = 500;
      throw err;
    } finally {
      // Only log if logging is enabled
      if (process.env.ENABLE_LOG === 'true') {
        // Log the API call asynchronously (don't await to avoid slowing down response)
        const durationMs = Date.now() - startTime;

        const logEntry: ApiLogEntry = {
          method: req.method,
          path: url.pathname,
          status,
          durationMs,
          ip,
          userAgent,
          caretakerId: authContext?.caretakerId ?? undefined,
          familyId: authContext?.familyId ?? undefined,
          error,
          requestBody,
          responseBody,
        };

        // Don't await - fire and forget
        logApiCall(logEntry).catch((logError) => {
          console.error('Failed to log API call:', logError);
        });
      }
    }
  };
}

/**
 * Combined middleware that applies both auth and logging
 * Use this for authenticated endpoints that need logging
 */
export function withAuthAndLogging<T = any>(
  handler: (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<T>>,
  authWrapper: (
    handler: (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<T>>
  ) => (req: NextRequest) => Promise<NextResponse<T>>
) {
  return authWrapper((req: NextRequest, authContext: AuthResult) => {
    return withLogging<T>((reqInner) => handler(reqInner, authContext))(req, authContext);
  });
}
