export interface DeviceTokenBody {
  token: string;
  platform: 'ios' | 'android';
}

const MAX_TOKEN_LENGTH = 4096;

export function parseDeviceTokenBody(body: unknown): DeviceTokenBody | null {
  if (typeof body !== 'object' || body === null) return null;
  const { token, platform } = body as { token?: unknown; platform?: unknown };
  if (typeof token !== 'string') return null;
  const trimmed = token.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_TOKEN_LENGTH) return null;
  if (platform !== 'ios' && platform !== 'android') return null;
  return { token: trimmed, platform };
}
