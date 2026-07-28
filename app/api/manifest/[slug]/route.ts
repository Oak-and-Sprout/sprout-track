import { buildManifestIcons } from '@/src/utils/pwa-icons';

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
