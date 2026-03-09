import { NextResponse } from 'next/server';
import { isNotificationsEnabled } from '../../../../src/lib/notifications/config';

/**
 * GET handler for lightweight cron pre-check
 * Returns whether notifications are enabled so the cron shell script
 * can skip the main cron endpoint when disabled.
 * No auth required — only returns a boolean, no sensitive data.
 */
export async function GET() {
  try {
    const enabled = await isNotificationsEnabled();
    return NextResponse.json({ enabled });
  } catch {
    // If we can't determine, report disabled so cron exits silently
    return NextResponse.json({ enabled: false });
  }
}
