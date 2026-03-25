/**
 * Helper functions for Monthly Report aggregation
 */

/**
 * Calculate Z-score using LMS method
 * Z = ((X / M) ^ L - 1) / (L * S)
 * When L is 0: Z = ln(X / M) / S
 */
export function calculateZScore(value: number, l: number, m: number, s: number): number {
  if (m === 0 || s === 0) return 0;
  if (l === 0) {
    return Math.log(value / m) / s;
  }
  return (Math.pow(value / m, l) - 1) / (l * s);
}

/**
 * Convert Z-score to percentile using standard normal CDF approximation
 * Uses the Abramowitz and Stegun approximation
 */
export function zScoreToPercentile(z: number): number {
  // Clamp extreme values
  if (z < -4) return 0;
  if (z > 4) return 100;

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  const cdf = 0.5 * (1.0 + sign * y);
  return Math.round(cdf * 100);
}

/**
 * Calculate age in months from birthDate to a target date
 */
export function ageInMonths(birthDate: Date, targetDate: Date): number {
  const years = targetDate.getFullYear() - birthDate.getFullYear();
  const months = targetDate.getMonth() - birthDate.getMonth();
  const days = targetDate.getDate() - birthDate.getDate();
  let totalMonths = years * 12 + months;
  if (days < 0) totalMonths -= 1;
  // Add fractional month
  const daysInMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
  const dayFraction = (days < 0 ? days + daysInMonth : days) / daysInMonth;
  return Math.max(0, totalMonths + dayFraction);
}

/**
 * Calculate age as { months, days } from birthDate to targetDate
 */
export function ageInMonthsAndDays(birthDate: Date, targetDate: Date): { months: number; days: number } {
  let months = (targetDate.getFullYear() - birthDate.getFullYear()) * 12 + (targetDate.getMonth() - birthDate.getMonth());
  let days = targetDate.getDate() - birthDate.getDate();
  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 0);
    days += prevMonth.getDate();
  }
  return { months: Math.max(0, months), days: Math.max(0, days) };
}

/**
 * Determine trend direction from two values
 */
export function getTrend(current: number, previous: number | null): 'up' | 'down' | 'stable' {
  if (previous === null) return 'stable';
  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return 'stable';
  return diff > 0 ? 'up' : 'down';
}

/**
 * Get the start and end dates for a given year/month
 */
export function getMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

/**
 * Get the number of days in a month
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Get the number of elapsed days in the current month (up to today)
 */
export function getElapsedDays(year: number, month: number): number {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year === currentYear && month === currentMonth) {
    return now.getDate();
  }
  return getDaysInMonth(year, month);
}

/**
 * Normal stool colors that should not be flagged
 */
const NORMAL_COLORS = new Set([
  'yellow', 'brown', 'tan', 'mustard', 'green-brown', 'dark brown',
  'light brown', 'golden', 'orange', 'greenish', 'dark yellow',
  'light yellow', 'khaki', 'olive',
]);

/**
 * Check if a stool color is abnormal
 */
export function isAbnormalColor(color: string | null): boolean {
  if (!color) return false;
  const normalized = color.trim().toLowerCase();
  if (!normalized) return false;
  return !NORMAL_COLORS.has(normalized);
}

/**
 * Title-case a string
 */
export function titleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Normalize a sleep location string for grouping
 */
export function normalizeLocation(location: string | null): string {
  if (!location || !location.trim()) return 'Not specified';
  return titleCase(location.trim());
}
