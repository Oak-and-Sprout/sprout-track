import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params;

  if (!slug) {
    return NextResponse.json(
      { success: false, error: 'Slug is required' },
      { status: 400 }
    );
  }

  const origin = req.nextUrl.origin;

  const manifest = {
    name: 'Sprout Track',
    short_name: 'Sprout Track',
    description: "Track your baby's sleep, feeding, diapers, milestones, and more.",
    start_url: `${origin}/${slug}/`,
    scope: `${origin}/${slug}/`,
    display: 'standalone',
    background_color: '#0d9488',
    theme_color: '#0d9488',
    icons: [
      { src: `${origin}/sprout-128.png`, sizes: '128x128', type: 'image/png' },
      { src: `${origin}/sprout-256.png`, sizes: '256x256', type: 'image/png' },
      { src: `${origin}/sprout-1024.png`, sizes: '1024x1024', type: 'image/png' },
    ],
  };

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
