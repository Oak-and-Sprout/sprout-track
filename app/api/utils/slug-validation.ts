/**
 * Slug validation utilities
 * Contains reserved URLs and validation functions for family slugs
 */

// Reserved URLs used by the main app that cannot be used as family slugs
export const RESERVED_URLS = [
  'account',
  'api',
  'coming-soon',
  'family-manager',
  'family-select',
  'setup',
  'sphome',
  'login',
  'auth',
  'context',
  'globals',
  'layout',
  'metadata',
  'page',
  'template',
  // ST-Guardian reserved URLs
  'health',
  'logs',
  'maintenance',
  'status',
  'update',
  'uptime',
  'version'
] as const;

/**
 * Check if a slug is reserved by the system
 * @param slug The slug to check
 * @returns True if the slug is reserved, false otherwise
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_URLS.includes(slug.toLowerCase() as any);
}

/**
 * Validate a slug format and check for reserved words
 * @param slug The slug to validate
 * @returns Object with validation result and error message if invalid
 */
export function validateSlug(slug: string): { isValid: boolean; error?: string } {
  if (!slug || slug.trim() === '') {
    return { isValid: false, error: 'Slug cannot be empty' };
  }

  // Basic slug validation
  const slugPattern = /^[a-z0-9-]+$/;
  if (!slugPattern.test(slug)) {
    return { isValid: false, error: 'Slug can only contain lowercase letters, numbers, and hyphens' };
  }

  if (slug.length < 3) {
    return { isValid: false, error: 'Slug must be at least 3 characters long' };
  }

  if (slug.length > 50) {
    return { isValid: false, error: 'Slug must be less than 50 characters' };
  }

  // Check for reserved URLs
  if (isReservedSlug(slug)) {
    return { isValid: false, error: 'This URL is reserved by the system and cannot be used' };
  }

  return { isValid: true };
}
