/**
 * Format a summed amount for display: rounds to 2 decimals (hiding float
 * accumulation error such as 0.3 + 0.3 + 0.3 = 0.8999999999999999) and strips
 * trailing zeros. Display only — stored values are never changed.
 */
export function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  return String(rounded === 0 ? 0 : rounded);
}
