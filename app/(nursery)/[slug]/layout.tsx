import { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  return {
    manifest: `/api/manifest/${encodeURIComponent(slug)}`,
    other: {
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'black-translucent',
    },
  };
}

export default function NurserySlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
