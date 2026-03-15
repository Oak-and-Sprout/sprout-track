import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '../../db';

/**
 * Returns true if the hostname is a private/local network address.
 * Allows HTTP for loopback, RFC 1918, link-local, and IPv6 ULA/link-local.
 */
function isPrivateNetwork(hostname: string): boolean {
  if (hostname === 'localhost') return true;

  // IPv6 loopback and private ranges
  if (hostname === '::1') return true;
  const cleanIPv6 = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (cleanIPv6.startsWith('fc') || cleanIPv6.startsWith('fd') || cleanIPv6.startsWith('fe80')) return true;

  // IPv4 checks
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p))) return false;

  if (parts[0] === 127) return true;                                      // 127.0.0.0/8 loopback
  if (parts[0] === 10) return true;                                       // 10.0.0.0/8
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;  // 172.16.0.0/12
  if (parts[0] === 192 && parts[1] === 168) return true;                  // 192.168.0.0/16
  if (parts[0] === 169 && parts[1] === 254) return true;                  // 169.254.0.0/16 link-local

  return false;
}

export interface ApiKeyContext {
  familyId: string;
  keyId: string;
  restrictedBabyId: string | null;
  scopes: string[];
}

export function withApiKeyAuth(
  handler: (req: NextRequest, ctx: ApiKeyContext, params?: any) => Promise<NextResponse>,
  requiredScope: 'read' | 'write'
) {
  return async (req: NextRequest, routeContext?: any): Promise<NextResponse> => {
    // Require HTTPS unless request is from a private/local network address
    const url = new URL(req.url);
    const host = url.hostname;
    if (!isPrivateNetwork(host) && url.protocol !== 'https:') {
      return NextResponse.json(
        { success: false, error: { code: 'HTTPS_REQUIRED', message: 'API requests must use HTTPS' } },
        { status: 403 }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header. Use: Bearer st_live_...' } },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    if (!token.startsWith('st_live_')) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_KEY', message: 'Invalid API key format' } },
        { status: 401 }
      );
    }

    const keyHash = crypto.createHash('sha256').update(token).digest('hex');

    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
    });

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_KEY', message: 'API key not found' } },
        { status: 401 }
      );
    }

    if (apiKey.revoked) {
      return NextResponse.json(
        { success: false, error: { code: 'KEY_REVOKED', message: 'This API key has been revoked' } },
        { status: 401 }
      );
    }

    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      return NextResponse.json(
        { success: false, error: { code: 'KEY_EXPIRED', message: 'This API key has expired' } },
        { status: 401 }
      );
    }

    const scopes: string[] = JSON.parse(apiKey.scopes);
    if (!scopes.includes(requiredScope)) {
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_SCOPE', message: `This key does not have '${requiredScope}' scope` } },
        { status: 403 }
      );
    }

    // Update lastUsedAt (fire and forget)
    prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    const ctx: ApiKeyContext = {
      familyId: apiKey.familyId,
      keyId: apiKey.id,
      restrictedBabyId: apiKey.babyId,
      scopes,
    };

    return handler(req, ctx, routeContext);
  };
}

/**
 * Validates that the babyId in the URL belongs to the family and matches any key restriction.
 */
export async function validateBabyAccess(
  babyId: string,
  ctx: ApiKeyContext
): Promise<{ valid: boolean; error?: NextResponse }> {
  if (ctx.restrictedBabyId && ctx.restrictedBabyId !== babyId) {
    return {
      valid: false,
      error: NextResponse.json(
        { success: false, error: { code: 'BABY_ACCESS_DENIED', message: 'This API key is restricted to a different baby' } },
        { status: 403 }
      ),
    };
  }

  const baby = await prisma.baby.findFirst({
    where: { id: babyId, familyId: ctx.familyId, inactive: false },
  });

  if (!baby) {
    return {
      valid: false,
      error: NextResponse.json(
        { success: false, error: { code: 'BABY_NOT_FOUND', message: 'Baby not found in this family' } },
        { status: 404 }
      ),
    };
  }

  return { valid: true };
}
