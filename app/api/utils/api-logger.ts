import { NextRequest } from 'next/server';
import logPrisma from '../../../prisma/log-db';

export interface ApiLogEntry {
  method: string;
  path: string;
  status?: number;
  durationMs?: number;
  ip?: string;
  userAgent?: string;
  caretakerId?: string;
  familyId?: string;
  error?: string;
  requestBody?: any;
  responseBody?: any;
}

export async function logApiCall(entry: ApiLogEntry): Promise<void> {
  try {
    await logPrisma.apiLog.create({
      data: {
        method: entry.method,
        path: entry.path,
        status: entry.status ?? null,
        durationMs: entry.durationMs ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        caretakerId: entry.caretakerId ?? null,
        familyId: entry.familyId ?? null,
        error: entry.error ?? null,
        requestBody: entry.requestBody ? JSON.stringify(entry.requestBody) : null,
        responseBody: entry.responseBody ? JSON.stringify(entry.responseBody) : null,
      },
    });
  } catch (error) {
    // Don't let logging errors break the API
    console.error('Failed to write API log:', error);
  }
}

export function getClientInfo(req: NextRequest) {
  return {
    ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
    userAgent: req.headers.get('user-agent') || 'unknown',
  };
}
