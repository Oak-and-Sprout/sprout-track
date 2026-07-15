const MANIFEST_ICONS: Array<{
  src: string;
  sizes: string;
  purpose?: 'any' | 'maskable';
}> = [
  { src: '/sprout-128.png', sizes: '128x128', purpose: 'any' },
  { src: '/sprout-192.png', sizes: '192x192', purpose: 'any' },
  { src: '/sprout-256.png', sizes: '256x256', purpose: 'any' },
  { src: '/sprout-512.png', sizes: '512x512', purpose: 'any' },
  { src: '/sprout-512.png', sizes: '512x512', purpose: 'maskable' },
  { src: '/sprout-1024.png', sizes: '1024x1024', purpose: 'any' },
];

function buildManifestIcons() {
  return MANIFEST_ICONS.map(({ src, sizes, purpose }) => ({
    src,
    sizes,
    type: 'image/png',
    purpose,
  }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug) {
    return Response.json(
      { success: false, error: 'Slug is required' },
      { status: 400 }
    );
  }

  // Relative URLs resolve against the manifest URL origin (same as the page).
  // scope "/" so login (/slug) and all sub-routes are in scope; start_url opens the family login.
  const manifest = {
    id: `/${slug}/`,
    name: 'Sprout Track',
    short_name: 'Sprout Track',
    description: "Track your baby's sleep, feeding, diapers, milestones, and more.",
    start_url: `/${slug}/`,
    scope: '/',
    display: 'standalone',
    background_color: '#0d9488',
    theme_color: '#0d9488',
    icons: buildManifestIcons(),
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'no-cache',
    },
  });
}
