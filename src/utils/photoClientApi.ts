import { PhotoListResponse, PhotoLogCreate, PhotoLogResponse, PhotoResponse, PhotoUploadResult } from '@/app/api/types';
import { photosZipFileName, uniqueFileNames } from '@/src/utils/photoUtils';

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...init?.headers, ...authHeaders() },
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || 'Request failed');
  }
  return payload.data as T;
}

export async function uploadPhotos(
  files: File[],
  options: { babyId: string; takenAt?: string; caption?: string; milestoneId?: string }
): Promise<PhotoUploadResult> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  formData.append('babyId', options.babyId);
  if (options.takenAt) formData.append('takenAt', options.takenAt);
  if (options.caption) formData.append('caption', options.caption);
  if (options.milestoneId) formData.append('milestoneId', options.milestoneId);
  return jsonRequest<PhotoUploadResult>('/api/photos/upload', { method: 'POST', body: formData });
}

export async function fetchPhotos(params?: { babyId?: string; trash?: boolean; cursor?: string; limit?: number }): Promise<PhotoListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.babyId) searchParams.set('babyId', params.babyId);
  if (params?.trash) searchParams.set('trash', 'true');
  if (params?.cursor) searchParams.set('cursor', params.cursor);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const query = searchParams.toString();
  return jsonRequest<PhotoListResponse>(`/api/photos${query ? `?${query}` : ''}`);
}

export async function updatePhoto(id: string, body: { caption?: string | null; takenAt?: string; milestoneId?: string | null }): Promise<PhotoResponse> {
  return jsonRequest<PhotoResponse>(`/api/photos/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function trashPhoto(id: string): Promise<void> {
  await jsonRequest<null>(`/api/photos/${id}`, { method: 'DELETE' });
}

export async function restorePhoto(id: string): Promise<void> {
  await jsonRequest<null>(`/api/photos/${id}/restore`, { method: 'POST' });
}

export async function togglePhotoFavorite(id: string): Promise<boolean> {
  const data = await jsonRequest<{ isFavorite: boolean }>(`/api/photos/${id}/favorite`, { method: 'POST' });
  return data.isFavorite;
}

export async function bulkPhotoAction(action: 'trash' | 'restore' | 'purge', ids: string[]): Promise<number> {
  const data = await jsonRequest<{ count: number }>('/api/photos/bulk', { method: 'POST', body: JSON.stringify({ action, ids }) });
  return data.count;
}

export async function linkPhoto(photoId: string, activityType: string, activityId: string): Promise<void> {
  await jsonRequest('/api/photos/links', { method: 'POST', body: JSON.stringify({ photoId, activityType, activityId }) });
}

export async function unlinkPhoto(photoId: string, activityType: string, activityId: string): Promise<void> {
  const params = new URLSearchParams({ photoId, activityType, activityId });
  await jsonRequest(`/api/photos/links?${params}`, { method: 'DELETE' });
}

export async function createPhotoLog(body: PhotoLogCreate): Promise<PhotoLogResponse> {
  return jsonRequest<PhotoLogResponse>('/api/photo-log', { method: 'POST', body: JSON.stringify(body) });
}

export async function fetchPhotoLog(id: string): Promise<PhotoLogResponse> {
  return jsonRequest<PhotoLogResponse>(`/api/photo-log?id=${id}`);
}

export async function updatePhotoLog(id: string, body: Partial<PhotoLogCreate>): Promise<PhotoLogResponse> {
  return jsonRequest<PhotoLogResponse>(`/api/photo-log?id=${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export async function deletePhotoLog(id: string): Promise<void> {
  await jsonRequest<null>(`/api/photo-log?id=${id}`, { method: 'DELETE' });
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function fetchPhotoBlob(id: string): Promise<Blob> {
  const response = await fetch(`/api/photos/file/${id}?size=full`, { headers: authHeaders() });
  if (!response.ok) throw new Error('Failed to download photo');
  return response.blob();
}

/** Client-side download: fetch full-size blob and trigger a save. */
export async function downloadPhoto(id: string, fileName: string): Promise<void> {
  saveBlob(await fetchPhotoBlob(id), fileName);
}

/**
 * Bundles multiple photos into a single zip download. Browsers only honor
 * one programmatic download per user gesture, so a per-photo loop silently
 * drops all but the first — a zip is the only reliable multi-file delivery.
 * Returns the number of photos that failed to fetch (they're skipped, the
 * rest still ship in the zip). Throws only if NO photo could be fetched.
 */
export async function downloadPhotosAsZip(photos: { id: string; fileName: string }[]): Promise<number> {
  const { default: JSZip } = await import('jszip');
  const results = await Promise.allSettled(photos.map((photo) => fetchPhotoBlob(photo.id)));
  const succeeded: { fileName: string; blob: Blob }[] = [];
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') succeeded.push({ fileName: photos[i].fileName, blob: result.value });
  });
  if (succeeded.length === 0) throw new Error('Failed to download photos');
  const zip = new JSZip();
  const names = uniqueFileNames(succeeded.map((s) => s.fileName));
  succeeded.forEach((entry, i) => zip.file(names[i], entry.blob));
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveBlob(zipBlob, photosZipFileName(new Date()));
  return photos.length - succeeded.length;
}

let photosEnabledCache: boolean | null = null;

/** Deployment-wide feature flag from /api/app-config/public (cached per session). */
export async function fetchPhotosEnabled(): Promise<boolean> {
  if (photosEnabledCache !== null) return photosEnabledCache;
  try {
    const response = await fetch('/api/app-config/public');
    const payload = await response.json();
    photosEnabledCache = !!payload?.data?.enablePhotos;
  } catch {
    photosEnabledCache = false;
  }
  return photosEnabledCache;
}
