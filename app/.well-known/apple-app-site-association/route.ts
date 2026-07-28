import { NextResponse } from 'next/server';

/** Universal Link paths claimed by the iOS shell.
 *  /account is deliberately absent: MANAGE_SUBSCRIPTION_URL points there so
 *  openExternal pushes subscription management into the system browser for App
 *  Store compliance. Claiming it would bounce the user back into the app. */
export function claimedPaths(): string[] {
  return ['/setup/*', '/verify*', '/passwordreset*'];
}

const APP_ID = `${process.env.APPLE_TEAM_ID ?? 'TEAMID'}.com.sprouttrack.app`;

export const APPLE_APP_SITE_ASSOCIATION = {
  applinks: {
    details: [{ appIDs: [APP_ID], components: claimedPaths().map((p) => ({ '/': p })) }],
  },
};

export async function GET() {
  return NextResponse.json(APPLE_APP_SITE_ASSOCIATION, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
  });
}
