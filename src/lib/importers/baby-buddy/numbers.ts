export function parseBabyBuddyNumber(
  source: string,
  field: string,
): number {
  const trimmed = source.trim();
  const normalised = /^-?\d+,\d+$/.test(trimmed)
    ? trimmed.replace(',', '.')
    : trimmed;

  const value = normalised === '' ? NaN : Number(normalised);

  if (!Number.isFinite(value)) {
    throw new Error(
      `Invalid number in field ${field}: ${source}`,
    );
  }

  return value;
}
