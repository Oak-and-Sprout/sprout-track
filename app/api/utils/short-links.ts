import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { ApiResponse } from './auth';
import { bytesToSlug, isValidDestinationUrl } from '@/src/utils/short-link-utils';

export function shortLinkSaasGate(): NextResponse<ApiResponse<never>> | null {
  const deploymentMode = process.env.DEPLOYMENT_MODE || 'selfhosted';
  if (deploymentMode !== 'saas') {
    return NextResponse.json(
      { success: false, error: 'Short links are disabled in self-hosted mode' },
      { status: 404 }
    ) as NextResponse<ApiResponse<never>>;
  }
  return null;
}

export function generateSlug(): string {
  return bytesToSlug(randomBytes(4));
}

export interface ParsedShortLinkInput {
  url: string;
  name: string;
  description: string | null;
  tag: string | null;
}

export function parseShortLinkInput(body: unknown): ParsedShortLinkInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const url = typeof b.url === 'string' ? b.url.trim() : '';
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const description = typeof b.description === 'string' ? b.description.trim() : '';
  const tag = typeof b.tag === 'string' ? b.tag.trim() : '';

  if (!url || !isValidDestinationUrl(url)) throw new Error('A valid http(s) destination URL is required');
  if (url.length > 2000) throw new Error('Destination URL must be under 2000 characters');
  if (!name) throw new Error('A name is required');
  if (name.length > 200) throw new Error('Name must be under 200 characters');
  if (description.length > 500) throw new Error('Description must be under 500 characters');
  if (tag.length > 100) throw new Error('Tag must be under 100 characters');

  return { url, name, description: description || null, tag: tag || null };
}

export interface ShortLinkRow {
  id: string;
  slug: string;
  url: string;
  name: string;
  description: string | null;
  tag: string | null;
  enabled: boolean;
  clickCount: number;
  clicks7d: number;
  createdAt: string;
  updatedAt: string;
}

export function toShortLinkRow(
  link: {
    id: string; slug: string; url: string; name: string; description: string | null; tag: string | null;
    enabled: boolean; clickCount: number; createdAt: Date; updatedAt: Date;
  },
  clicks7d: number
): ShortLinkRow {
  return {
    id: link.id,
    slug: link.slug,
    url: link.url,
    name: link.name,
    description: link.description,
    tag: link.tag,
    enabled: link.enabled,
    clickCount: link.clickCount,
    clicks7d,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
  };
}
