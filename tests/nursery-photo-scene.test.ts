import { describe, it, expect } from 'vitest';
import { photoIdFromSrc } from '@/src/components/features/nursery-mode/scenes/PhotoScene';

describe('photoIdFromSrc', () => {
  it('strips the gallery: prefix', () => {
    expect(photoIdFromSrc('gallery:abc123')).toBe('abc123');
  });
  it('strips the upload: prefix', () => {
    expect(photoIdFromSrc('upload:xyz789')).toBe('xyz789');
  });
  it('returns null for null', () => {
    expect(photoIdFromSrc(null)).toBeNull();
  });
  it('returns null for an empty string', () => {
    expect(photoIdFromSrc('')).toBeNull();
  });
  it('passes through a plain id without a prefix', () => {
    expect(photoIdFromSrc('plain-id')).toBe('plain-id');
  });
  it('only strips the prefix once, at the start', () => {
    expect(photoIdFromSrc('gallery:gallery:abc')).toBe('gallery:abc');
    expect(photoIdFromSrc('not-gallery:abc')).toBe('not-gallery:abc');
  });
});
