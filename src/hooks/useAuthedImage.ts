import { useEffect, useRef, useState } from 'react';

// Session-wide object-URL cache so grids don't refetch thumbnails.
const objectUrlCache = new Map<string, string>();
const MAX_CACHE_ENTRIES = 500;

function cacheSet(url: string, objectUrl: string) {
  if (objectUrlCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = objectUrlCache.keys().next().value;
    if (oldest) {
      URL.revokeObjectURL(objectUrlCache.get(oldest)!);
      objectUrlCache.delete(oldest);
    }
  }
  objectUrlCache.set(url, objectUrl);
}

function cacheGet(url: string): string | undefined {
  const cached = objectUrlCache.get(url);
  if (cached !== undefined) {
    // LRU touch: move to the end so in-use URLs aren't evicted first
    objectUrlCache.delete(url);
    objectUrlCache.set(url, cached);
  }
  return cached;
}

export function photoFileUrl(id: string, size: 'thumb' | 'full', trash = false): string {
  return `/api/photos/file/${id}?size=${size}${trash ? '&trash=true' : ''}`;
}

/** IntersectionObserver helper for lazy thumbnail loading. */
export function useInView<T extends Element>(): { ref: React.RefObject<T | null>; inView: boolean } {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, inView };
}

/**
 * Fetch a protected image with the Bearer token and expose an object URL.
 * <img> tags cannot send Authorization headers, so every photo render
 * goes through this hook (same pattern as chat-conversation attachments).
 */
export function useAuthedImage(url: string | null, enabled = true): { src: string | null; loading: boolean; error: boolean } {
  const [src, setSrc] = useState<string | null>(url ? cacheGet(url) || null : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url || !enabled) return;
    const cached = cacheGet(url);
    if (cached) {
      setSrc(cached);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    const token = localStorage.getItem('authToken');
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        cacheSet(url, objectUrl);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url, enabled]);

  return { src, loading, error };
}
