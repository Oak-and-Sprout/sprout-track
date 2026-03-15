import { NextResponse } from 'next/server';

interface Meta {
  timestamp: string;
  familyId?: string;
  babyId?: string;
}

export function hookSuccess(data: any, meta?: Partial<Meta>, headers?: Record<string, string>) {
  const body = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
  return NextResponse.json(body, { status: 200, headers });
}

export function hookError(code: string, message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    },
    { status, headers }
  );
}
