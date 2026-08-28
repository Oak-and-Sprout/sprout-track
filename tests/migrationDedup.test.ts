import { describe, it, expect } from 'vitest';
import { DEDUP_KEY_FIELDS, dedupKey, isDedupTable, isDuplicateLog } from '@/src/utils/migration-dedup';

const T = new Date('2024-03-01T12:00:00.000Z');

describe('DEDUP_KEY_FIELDS matches spec 03 §2c exactly', () => {
  it('has the exact key fields per log table', () => {
    expect(DEDUP_KEY_FIELDS).toEqual({
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
    });
  });

  it('recognizes dedup tables and rejects non-log tables', () => {
    expect(isDedupTable('FeedLog')).toBe(true);
    expect(isDedupTable('CalendarEvent')).toBe(false);
    expect(dedupKey('CalendarEvent', {})).toBeNull();
    expect(isDuplicateLog('CalendarEvent', {}, new Set(['anything']))).toBe(false);
  });
});

describe('isDuplicateLog — per log type: matching key skipped, differing kept', () => {
  const check = (table: string, base: Record<string, any>, differing: Record<string, any>) => {
    const existing = new Set([dedupKey(table, base)!]);
    expect(isDuplicateLog(table, base, existing)).toBe(true);
    expect(isDuplicateLog(table, differing, existing)).toBe(false);
  };

  it('SleepLog on babyId+startTime+type', () => {
    check('SleepLog', { babyId: 'b1', startTime: T, type: 'NAP' }, { babyId: 'b1', startTime: T, type: 'NIGHT_SLEEP' });
  });

  it('FeedLog distinguishes on amount', () => {
    check('FeedLog', { babyId: 'b1', time: T, type: 'BOTTLE', amount: 4, side: null }, { babyId: 'b1', time: T, type: 'BOTTLE', amount: 6, side: null });
  });

  it('FeedLog distinguishes on side', () => {
    check('FeedLog', { babyId: 'b1', time: T, type: 'BREAST', amount: null, side: 'LEFT' }, { babyId: 'b1', time: T, type: 'BREAST', amount: null, side: 'RIGHT' });
  });

  it('DiaperLog on babyId+time+type', () => {
    check('DiaperLog', { babyId: 'b1', time: T, type: 'WET' }, { babyId: 'b1', time: T, type: 'DIRTY' });
  });

  it('MoodLog on babyId+time+mood', () => {
    check('MoodLog', { babyId: 'b1', time: T, mood: 'HAPPY' }, { babyId: 'b1', time: T, mood: 'FUSSY' });
  });

  it('Note on babyId+time+content', () => {
    check('Note', { babyId: 'b1', time: T, content: 'first' }, { babyId: 'b1', time: T, content: 'second' });
  });

  it('Milestone on babyId+date+title', () => {
    check('Milestone', { babyId: 'b1', date: T, title: 'Rolled over' }, { babyId: 'b1', date: T, title: 'Sat up' });
  });

  it('PumpLog on babyId+startTime', () => {
    check('PumpLog', { babyId: 'b1', startTime: T }, { babyId: 'b1', startTime: new Date(T.getTime() + 1000) });
  });

  it('BreastMilkAdjustment on babyId+time+amount', () => {
    check('BreastMilkAdjustment', { babyId: 'b1', time: T, amount: 2 }, { babyId: 'b1', time: T, amount: -2 });
  });

  it('PlayLog on babyId+startTime+type', () => {
    check('PlayLog', { babyId: 'b1', startTime: T, type: 'TUMMY_TIME' }, { babyId: 'b1', startTime: T, type: 'INDEPENDENT' });
  });

  it('BathLog on babyId+time', () => {
    check('BathLog', { babyId: 'b1', time: T }, { babyId: 'b1', time: new Date(T.getTime() + 60000) });
  });

  it('Measurement on babyId+date+type+value', () => {
    check('Measurement', { babyId: 'b1', date: T, type: 'WEIGHT', value: 10 }, { babyId: 'b1', date: T, type: 'WEIGHT', value: 11 });
  });

  it('MedicineLog on babyId+time+medicineId (remapped)', () => {
    check('MedicineLog', { babyId: 'b1', time: T, medicineId: 'med-tgt-1' }, { babyId: 'b1', time: T, medicineId: 'med-tgt-2' });
  });

  it('FoodLog on babyId+time', () => {
    check('FoodLog', { babyId: 'b1', time: T }, { babyId: 'b1', time: new Date(T.getTime() + 1) });
  });

  it('VaccineLog on babyId+time+vaccineName', () => {
    check('VaccineLog', { babyId: 'b1', time: T, vaccineName: 'MMR' }, { babyId: 'b1', time: T, vaccineName: 'DTaP' });
  });

  it('scopes by babyId — same key on a different baby is not a duplicate', () => {
    const existing = new Set([dedupKey('BathLog', { babyId: 'b1', time: T })!]);
    expect(isDuplicateLog('BathLog', { babyId: 'b2', time: T }, existing)).toBe(false);
  });
});
