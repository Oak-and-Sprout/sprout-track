import { SleepLocationSummary } from '@/app/api/types';
import { DEFAULT_SLEEP_LOCATIONS } from '@/src/constants/sleepLocations';

export interface LocationUsageRow {
  location: string | null;
  count: number;
}

export interface DuplicateSuggestion {
  name: string;
  mergeInto: string;
}

/** Parsed shape of Settings.sleepLocationSettings. */
export interface SleepLocationSettingsShape {
  hiddenLocations: string[];
  customLocations: string[];
}

export type LocationRenameValidation =
  | { valid: true; from: string; to: string }
  | { valid: false; error: string };

export type LocationNameValidation =
  | { valid: true; name: string }
  | { valid: false; error: string };

const isDefaultLocation = (name: string): boolean =>
  (DEFAULT_SLEEP_LOCATIONS as readonly string[]).includes(name);

/**
 * Merges live usage counts, the hardcoded defaults, and the persisted
 * settings lists (hidden + custom names) into one summary per distinct
 * location. Hidden or persisted values with zero uses are included so they
 * can be managed. Defaults come first in canonical order, then customs by
 * count desc, name asc.
 */
export function buildSleepLocationSummaries(
  usageRows: LocationUsageRow[],
  hiddenLocations: string[],
  customLocations: string[],
): SleepLocationSummary[] {
  const map = new Map<string, SleepLocationSummary>();

  for (const name of DEFAULT_SLEEP_LOCATIONS) {
    map.set(name, { name, count: 0, isDefault: true, hidden: false });
  }
  for (const name of [...customLocations, ...hiddenLocations]) {
    if (!map.has(name)) {
      map.set(name, { name, count: 0, isDefault: false, hidden: false });
    }
  }
  for (const row of usageRows) {
    if (row.location === null || row.location === '') continue;
    const existing = map.get(row.location);
    if (existing) {
      existing.count += row.count;
    } else {
      map.set(row.location, {
        name: row.location,
        count: row.count,
        isDefault: false,
        hidden: false,
      });
    }
  }
  for (const name of hiddenLocations) {
    const entry = map.get(name);
    if (entry) entry.hidden = true;
  }

  const customs = Array.from(map.values())
    .filter((l) => !l.isDefault)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return [
    ...DEFAULT_SLEEP_LOCATIONS.map((name) => map.get(name)!),
    ...customs,
  ];
}

/**
 * Groups locations that match after trimming and lowercasing; every
 * non-canonical member of a group gets a one-click merge suggestion.
 * Canonical = the default in the group if present, else highest count
 * (ties broken by name ascending).
 */
export function getDuplicateSuggestions(
  summaries: SleepLocationSummary[],
): DuplicateSuggestion[] {
  const groups = new Map<string, SleepLocationSummary[]>();
  for (const s of summaries) {
    const key = s.name.trim().toLowerCase();
    const group = groups.get(key);
    if (group) group.push(s);
    else groups.set(key, [s]);
  }

  const suggestions: DuplicateSuggestion[] = [];
  for (const group of Array.from(groups.values())) {
    if (group.length < 2) continue;
    const canonical =
      group.find((s) => s.isDefault) ??
      [...group].sort(
        (a, b) => b.count - a.count || (a.name < b.name ? -1 : 1),
      )[0];
    for (const s of group) {
      if (s.name !== canonical.name) {
        suggestions.push({ name: s.name, mergeInto: canonical.name });
      }
    }
  }
  return suggestions;
}

/**
 * Validates a rename/merge. `to` is trimmed; `from` never is — it must match
 * stored values byte-for-byte (whitespace-padded values included).
 */
export function validateLocationRename(
  from: unknown,
  to: unknown,
): LocationRenameValidation {
  if (typeof from !== 'string' || from === '') {
    return { valid: false, error: 'A source location is required' };
  }
  if (typeof to !== 'string' || to.trim() === '') {
    return { valid: false, error: 'A new location name is required' };
  }
  const trimmedTo = to.trim();
  if (from === trimmedTo) {
    return { valid: false, error: 'The new name must be different' };
  }
  if (isDefaultLocation(from)) {
    return { valid: false, error: 'Default locations cannot be renamed or merged' };
  }
  return { valid: true, from, to: trimmedTo };
}

export function validateLocationDelete(name: unknown): LocationNameValidation {
  if (typeof name !== 'string' || name === '') {
    return { valid: false, error: 'A location name is required' };
  }
  if (isDefaultLocation(name)) {
    return { valid: false, error: 'Default locations cannot be deleted' };
  }
  return { valid: true, name };
}

/**
 * Validates a new location name against every existing name (defaults,
 * in-use values, hidden and persisted customs), case-insensitively after
 * trimming, so adding can't create instant near-duplicates.
 */
export function validateLocationAdd(
  name: unknown,
  existingNames: string[],
): LocationNameValidation {
  if (typeof name !== 'string' || name.trim() === '') {
    return { valid: false, error: 'A location name is required' };
  }
  const trimmed = name.trim();
  const key = trimmed.toLowerCase();
  if (existingNames.some((e) => e.trim().toLowerCase() === key)) {
    return { valid: false, error: 'This location already exists' };
  }
  return { valid: true, name: trimmed };
}

const dedupe = (list: string[]): string[] => Array.from(new Set(list));

/**
 * Settings bookkeeping for a rename/merge: the source drops out of
 * hiddenLocations, and a persisted source is renamed in place (unless the
 * target is a default, which needs no persistence).
 */
export function updateSettingsAfterRename(
  settings: SleepLocationSettingsShape,
  from: string,
  to: string,
): SleepLocationSettingsShape {
  const customs = dedupe(settings.customLocations);
  const customLocations =
    customs.includes(from) && !isDefaultLocation(to)
      ? dedupe(customs.map((c) => (c === from ? to : c)))
      : customs.filter((c) => c !== from);
  return {
    hiddenLocations: dedupe(settings.hiddenLocations).filter((h) => h !== from),
    customLocations,
  };
}

/** Removes the name from both settings lists (exact match). */
export function updateSettingsAfterDelete(
  settings: SleepLocationSettingsShape,
  name: string,
): SleepLocationSettingsShape {
  return {
    hiddenLocations: dedupe(settings.hiddenLocations).filter((h) => h !== name),
    customLocations: dedupe(settings.customLocations).filter((c) => c !== name),
  };
}
