/**
 * Family Migration — log dedup (pure, DB-free).
 *
 * In append mode with `dedup: true`, a log row is skipped when a row with the
 * same natural key already exists in the target family. Because ids are always
 * remapped, a straight merge (`dedup: false`) never PK-collides — it can only
 * create *logical* duplicates, which this matcher suppresses when enabled.
 *
 * Keys are all scoped by the **remapped** `babyId` (and `medicineId`), so this
 * runs after `remapRow`. The shell pre-loads the existing natural keys per table
 * as a `Set<string>`, so the matcher needs no DB. Keys per spec 03 §2c.
 */

/** Field separator + null sentinel — control chars that can't appear in data. */
const SEP = ' ';
const NULL = `∅`;

function part(value: unknown): string {
  if (value == null) return NULL;
  if (value instanceof Date) return String(value.getTime());
  return String(value);
}

/**
 * The dedup key fields per log table (PascalCase). `FeedLog` includes both
 * `amount` and `side` so two feeds differing in either are kept (spec: "FeedLog
 * distinguishes on amount/side").
 */
export const DEDUP_KEY_FIELDS: Record<string, string[]> = {
  SleepLog: ['babyId', 'startTime', 'type'],
  FeedLog: ['babyId', 'time', 'type', 'amount', 'side'],
  DiaperLog: ['babyId', 'time', 'type'],
  MoodLog: ['babyId', 'time', 'mood'],
  Note: ['babyId', 'time', 'content'],
  Milestone: ['babyId', 'date', 'title'],
  PumpLog: ['babyId', 'startTime'],
  BreastMilkAdjustment: ['babyId', 'time', 'amount'],
  PlayLog: ['babyId', 'startTime', 'type'],
  BathLog: ['babyId', 'time'],
  Measurement: ['babyId', 'date', 'type', 'value'],
  MedicineLog: ['babyId', 'time', 'medicineId'],
  FoodLog: ['babyId', 'time'],
  VaccineLog: ['babyId', 'time', 'vaccineName'],
};

/** True when this table participates in log dedup. */
export function isDedupTable(table: string): boolean {
  return table in DEDUP_KEY_FIELDS;
}

/**
 * Build the natural-key string for a (remapped) log row, or `null` when the table
 * has no dedup key. Used both to test a candidate and to pre-load existing keys.
 */
export function dedupKey(table: string, row: Record<string, any>): string | null {
  const fields = DEDUP_KEY_FIELDS[table];
  if (!fields) return null;
  return `${table}${SEP}${fields.map((f) => part(row[f])).join(SEP)}`;
}

/**
 * True when `row` duplicates a log already present in `existingKeys`. Non-dedup
 * tables always return `false`. Callers pass `dedup: false` upstream to keep all.
 */
export function isDuplicateLog(
  table: string,
  row: Record<string, any>,
  existingKeys: Set<string>,
): boolean {
  const key = dedupKey(table, row);
  if (key === null) return false;
  return existingKeys.has(key);
}
