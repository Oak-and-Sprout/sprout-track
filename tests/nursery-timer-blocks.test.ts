import { describe, it, expect } from 'vitest';
import { diaperTimer, feedTimer, splitDuration, wakeTimer } from '@/src/utils/nursery/timerBlocks';

const now = new Date('2026-10-12T12:00:00Z');
const ago = (min: number) => new Date(now.getTime() - min * 60000);

describe('wakeTimer', () => {
  it('is empty with no sleep data (new baby)', () => {
    expect(wakeTimer({}, now)).toEqual({ kind: 'none' });
  });

  it('counts awake time since the last sleep ended', () => {
    expect(wakeTimer({ lastSleepEndTime: ago(83) }, now)).toEqual({ kind: 'awake', minutes: 83 });
  });

  it('shows the sleeping duration during an ongoing sleep, ignoring older wakes', () => {
    const status = { ongoingSleep: { startTime: ago(45).toISOString() } as any, lastSleepEndTime: ago(120) };
    expect(wakeTimer(status, now)).toEqual({ kind: 'sleeping', minutes: 45 });
  });

  it('is empty when the last wake or ongoing sleep is 24 h old or more', () => {
    expect(wakeTimer({ lastSleepEndTime: ago(1440) }, now)).toEqual({ kind: 'none' });
    expect(wakeTimer({ ongoingSleep: { startTime: ago(1500).toISOString() } as any }, now)).toEqual({ kind: 'none' });
  });
});

describe('feedTimer', () => {
  const baby = { feedTimerFrom: 'start', feedWarningTime: '03:00' };

  it('is empty with no feed', () => {
    expect(feedTimer({}, baby, now)).toEqual({ kind: 'none' });
  });

  it('shows "feeding" while a breastfeed is in progress', () => {
    expect(feedTimer({ lastFeedTime: ago(30) }, baby, now, true)).toEqual({ kind: 'feeding' });
  });

  it('counts from the feed start by default', () => {
    const status = { lastFeedTime: ago(100), lastFeedEndTime: ago(80) };
    expect(feedTimer(status, baby, now)).toEqual({ kind: 'since', minutes: 100, warning: false });
  });

  it('counts from the feed end when feedTimerFrom is "end"', () => {
    const status = { lastFeedTime: ago(100), lastFeedEndTime: ago(80) };
    expect(feedTimer(status, { ...baby, feedTimerFrom: 'end' }, now)).toEqual({ kind: 'since', minutes: 80, warning: false });
  });

  it('turns to warning at the feedWarningTime threshold', () => {
    expect(feedTimer({ lastFeedTime: ago(179) }, baby, now)).toMatchObject({ warning: false });
    expect(feedTimer({ lastFeedTime: ago(180) }, baby, now)).toMatchObject({ warning: true });
  });

  it('never warns without a warning time', () => {
    expect(feedTimer({ lastFeedTime: ago(600) }, { feedTimerFrom: 'start' }, now)).toMatchObject({ warning: false });
  });

  it('clamps a future-dated feed to zero minutes', () => {
    expect(feedTimer({ lastFeedTime: ago(-10) }, baby, now)).toEqual({ kind: 'since', minutes: 0, warning: false });
  });

  it('is empty when the last feed is 24 h old or more', () => {
    expect(feedTimer({ lastFeedTime: ago(1440) }, baby, now)).toEqual({ kind: 'none' });
  });
});

describe('diaperTimer', () => {
  const baby = { diaperWarningTime: '02:00' };

  it('is empty with no diaper change', () => {
    expect(diaperTimer({}, baby, now)).toEqual({ kind: 'none' });
  });

  it('counts time since the last diaper change, independent of sleep state', () => {
    const status = { lastDiaperTime: ago(95), ongoingSleep: { startTime: ago(20).toISOString() } as any, lastSleepEndTime: ago(300) };
    expect(diaperTimer(status, baby, now)).toEqual({ kind: 'since', minutes: 95, warning: false });
  });

  it('turns to warning at the diaperWarningTime threshold', () => {
    expect(diaperTimer({ lastDiaperTime: ago(119) }, baby, now)).toMatchObject({ warning: false });
    expect(diaperTimer({ lastDiaperTime: ago(120) }, baby, now)).toMatchObject({ warning: true });
  });

  it('never warns without a warning time', () => {
    expect(diaperTimer({ lastDiaperTime: ago(600) }, {}, now)).toMatchObject({ warning: false });
  });

  it('clamps a future-dated change to zero minutes', () => {
    expect(diaperTimer({ lastDiaperTime: ago(-10) }, baby, now)).toEqual({ kind: 'since', minutes: 0, warning: false });
  });

  it('is empty when the last change is 24 h old or more', () => {
    expect(diaperTimer({ lastDiaperTime: ago(1439) }, baby, now)).toMatchObject({ kind: 'since', minutes: 1439 });
    expect(diaperTimer({ lastDiaperTime: ago(1440) }, baby, now)).toEqual({ kind: 'none' });
  });
});

describe('splitDuration', () => {
  it('splits minutes into hours and minutes', () => {
    expect(splitDuration(83)).toEqual({ hours: 1, minutes: 23 });
    expect(splitDuration(59)).toEqual({ hours: 0, minutes: 59 });
    expect(splitDuration(0)).toEqual({ hours: 0, minutes: 0 });
  });
  it('clamps negative (future-dated) durations to zero', () => {
    expect(splitDuration(-5)).toEqual({ hours: 0, minutes: 0 });
  });
});
