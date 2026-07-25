import { NextResponse } from 'next/server';

/** ANDROID_CERT_SHA256 must be the Play App Signing fingerprint from the Play
 *  Console — NOT the local upload key. Using the upload key is the single most
 *  common reason App Links silently fail to verify. */
export const ASSET_LINKS = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.sprouttrack.app',
      sha256_cert_fingerprints: [process.env.ANDROID_CERT_SHA256 ?? ''],
    },
  },
];

export async function GET() {
  return NextResponse.json(ASSET_LINKS, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
  });
}
