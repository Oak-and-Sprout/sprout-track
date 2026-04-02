export function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const authToken = getAuthToken();
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${authToken}`,
    },
  });
}

export function formatDateTime(dateString: string | null): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
