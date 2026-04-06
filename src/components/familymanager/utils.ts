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

import {
  formatDateTimeDisplay,
  DateFormatSetting,
  TimeFormatSetting,
} from '@/src/utils/dateFormat';

export function formatDateTime(
  dateString: string | null,
  dateFormat: DateFormatSetting = 'MM/DD/YYYY',
  timeFormat: TimeFormatSetting = '12h'
): string {
  if (!dateString) return 'N/A';
  return formatDateTimeDisplay(new Date(dateString), dateFormat, timeFormat);
}
