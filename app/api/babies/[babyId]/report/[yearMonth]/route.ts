import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../db';
import { ApiResponse, MonthlyReport, GrowthMetric, GrowthChartData, GrowthChartPoint } from '../../../../types';
import { withAuthContext, AuthResult } from '../../../../utils/auth';
import { formatForResponse } from '../../../../utils/timezone';
import {
  calculateZScore,
  zScoreToPercentile,
  ageInMonths,
  ageInMonthsAndDays,
  getTrend,
  getMonthRange,
  getDaysInMonth,
  getElapsedDays,
  isAbnormalColor,
  normalizeLocation,
} from '../../../../../../src/components/Reports/MonthlyReportCard/monthly-report-card.helpers';

/**
 * Parse babyId and yearMonth from the URL path.
 * Expected pattern: /api/babies/{babyId}/report/{yearMonth}
 */
function parseParams(req: NextRequest): { babyId: string; year: number; month: number } | null {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  // Find "babies" segment, then babyId is next, then "report", then yearMonth
  const babiesIdx = segments.indexOf('babies');
  if (babiesIdx === -1 || babiesIdx + 3 >= segments.length) return null;
  const babyId = segments[babiesIdx + 1];
  const yearMonth = segments[babiesIdx + 3];
  const match = yearMonth.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (month < 1 || month > 12) return null;
  return { babyId, year, month };
}

async function handleGet(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<MonthlyReport>>> {
  const { familyId: userFamilyId } = authContext;
  if (!userFamilyId) {
    return NextResponse.json<ApiResponse<any>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
  }

  const params = parseParams(req);
  if (!params) {
    return NextResponse.json<ApiResponse<any>>({ success: false, error: 'Invalid URL. Expected /api/babies/{babyId}/report/{YYYY-MM}' }, { status: 400 });
  }

  const { babyId, year, month } = params;

  // Verify baby belongs to the user's family
  const baby = await prisma.baby.findFirst({
    where: { id: babyId, familyId: userFamilyId, deletedAt: null },
  });
  if (!baby) {
    return NextResponse.json<ApiResponse<any>>({ success: false, error: 'Baby not found.' }, { status: 404 });
  }

  const { start, end } = getMonthRange(year, month);
  const daysInMonth = getDaysInMonth(year, month);
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const effectiveDays = isCurrentMonth ? getElapsedDays(year, month) : daysInMonth;

  // Also get date range for previous month (for deltas)
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevRange = getMonthRange(prevYear, prevMonth);
  const prevDaysInMonth = getDaysInMonth(prevYear, prevMonth);

  // Calculate age at end of month
  const birthDate = new Date(baby.birthDate);
  const endOfMonth = isCurrentMonth ? now : end;
  const age = ageInMonthsAndDays(birthDate, endOfMonth);

  // ─── Run all queries in parallel ───
  const baseWhere = { babyId, familyId: userFamilyId, deletedAt: null };

  const [
    // Growth: latest measurement per type this month + previous month
    weightThisMonth,
    weightPrevMonth,
    lengthThisMonth,
    lengthPrevMonth,
    headThisMonth,
    headPrevMonth,
    allWeights,
    allLengths,
    allHeadCircumferences,
    // Feeding
    feedLogs,
    prevFeedLogs,
    // Sleep
    sleepLogs,
    // Diapers
    diaperLogs,
    // Activity
    playLogs,
    prevPlayLogs,
    bathLogs,
    // Milestones
    milestones,
    // Medicine / Supplements
    medicineLogs,
    vaccines,
    // All log counts for days tracked + caretaker activity
    feedDates,
    sleepDates,
    diaperDates,
    bathDates,
    playDates,
    medicineDates,
    measurementDates,
    milestoneDates,
    noteDates,
  ] = await Promise.all([
    // Growth measurements
    prisma.measurement.findFirst({ where: { ...baseWhere, type: 'WEIGHT', date: { gte: start, lte: end } }, orderBy: { date: 'desc' } }),
    prisma.measurement.findFirst({ where: { ...baseWhere, type: 'WEIGHT', date: { gte: prevRange.start, lte: prevRange.end } }, orderBy: { date: 'desc' } }),
    prisma.measurement.findFirst({ where: { ...baseWhere, type: 'HEIGHT', date: { gte: start, lte: end } }, orderBy: { date: 'desc' } }),
    prisma.measurement.findFirst({ where: { ...baseWhere, type: 'HEIGHT', date: { gte: prevRange.start, lte: prevRange.end } }, orderBy: { date: 'desc' } }),
    prisma.measurement.findFirst({ where: { ...baseWhere, type: 'HEAD_CIRCUMFERENCE', date: { gte: start, lte: end } }, orderBy: { date: 'desc' } }),
    prisma.measurement.findFirst({ where: { ...baseWhere, type: 'HEAD_CIRCUMFERENCE', date: { gte: prevRange.start, lte: prevRange.end } }, orderBy: { date: 'desc' } }),
    prisma.measurement.findMany({ where: { ...baseWhere, type: 'WEIGHT' }, orderBy: { date: 'asc' } }),
    prisma.measurement.findMany({ where: { ...baseWhere, type: 'HEIGHT' }, orderBy: { date: 'asc' } }),
    prisma.measurement.findMany({ where: { ...baseWhere, type: 'HEAD_CIRCUMFERENCE' }, orderBy: { date: 'asc' } }),

    // Feeding
    prisma.feedLog.findMany({ where: { ...baseWhere, time: { gte: start, lte: end } } }),
    prisma.feedLog.findMany({ where: { ...baseWhere, time: { gte: prevRange.start, lte: prevRange.end } } }),

    // Sleep
    prisma.sleepLog.findMany({ where: { ...baseWhere, startTime: { gte: start, lte: end } } }),

    // Diapers
    prisma.diaperLog.findMany({ where: { ...baseWhere, time: { gte: start, lte: end } } }),

    // Activity
    prisma.playLog.findMany({ where: { ...baseWhere, startTime: { gte: start, lte: end } } }),
    prisma.playLog.findMany({ where: { ...baseWhere, startTime: { gte: prevRange.start, lte: prevRange.end } } }),
    prisma.bathLog.findMany({ where: { ...baseWhere, time: { gte: start, lte: end } } }),

    // Milestones
    prisma.milestone.findMany({ where: { ...baseWhere, date: { gte: start, lte: end } }, orderBy: { date: 'asc' } }),

    // Medicine logs with medicine info
    prisma.medicineLog.findMany({ where: { ...baseWhere, time: { gte: start, lte: end } }, include: { medicine: true } }),
    prisma.vaccineLog.findMany({ where: { ...baseWhere, time: { gte: start, lte: end } }, orderBy: { time: 'asc' } }),

    // Dates for days tracked (select only the time/date field for counting distinct dates)
    prisma.feedLog.findMany({ where: { ...baseWhere, time: { gte: start, lte: end } }, select: { time: true, caretakerId: true } }),
    prisma.sleepLog.findMany({ where: { ...baseWhere, startTime: { gte: start, lte: end } }, select: { startTime: true, caretakerId: true } }),
    prisma.diaperLog.findMany({ where: { ...baseWhere, time: { gte: start, lte: end } }, select: { time: true, caretakerId: true } }),
    prisma.bathLog.findMany({ where: { ...baseWhere, time: { gte: start, lte: end } }, select: { time: true, caretakerId: true } }),
    prisma.playLog.findMany({ where: { ...baseWhere, startTime: { gte: start, lte: end } }, select: { startTime: true, caretakerId: true } }),
    prisma.medicineLog.findMany({ where: { ...baseWhere, time: { gte: start, lte: end } }, select: { time: true, caretakerId: true } }),
    prisma.measurement.findMany({ where: { ...baseWhere, date: { gte: start, lte: end } }, select: { date: true, caretakerId: true } }),
    prisma.milestone.findMany({ where: { ...baseWhere, date: { gte: start, lte: end } }, select: { date: true, caretakerId: true } }),
    prisma.note.findMany({ where: { ...baseWhere, time: { gte: start, lte: end } }, select: { time: true, caretakerId: true } }),
  ]);

  // ─── Days tracked ───
  const allDates = new Set<string>();
  const addDate = (d: Date) => allDates.add(d.toISOString().split('T')[0]);
  feedDates.forEach(r => addDate(r.time));
  sleepDates.forEach(r => addDate(r.startTime));
  diaperDates.forEach(r => addDate(r.time));
  bathDates.forEach(r => addDate(r.time));
  playDates.forEach(r => addDate(r.startTime));
  medicineDates.forEach(r => addDate(r.time));
  measurementDates.forEach(r => addDate(r.date));
  milestoneDates.forEach(r => addDate(r.date));
  noteDates.forEach(r => addDate(r.time));
  const daysTracked = allDates.size;

  // ─── Growth ───
  // CDC tables store data in kg (weight) and cm (length/head).
  // User measurements may be in lb/oz/in. We must convert to CDC units for percentile calc.
  const sex = baby.gender === 'MALE' ? 1 : baby.gender === 'FEMALE' ? 2 : null;
  const maxAgeMonths = Math.ceil(ageInMonths(birthDate, endOfMonth));

  // Fetch family settings for display units
  const familySettings = await prisma.settings.findFirst({
    where: { familyId: userFamilyId },
    select: { defaultWeightUnit: true, defaultHeightUnit: true },
  });
  const displayWeightUnit = (familySettings?.defaultWeightUnit || 'LB').toUpperCase();
  const displayHeightUnit = (familySettings?.defaultHeightUnit || 'IN').toUpperCase();

  // Unit conversion helpers (matching GrowthChart.tsx logic)
  function toCdcUnit(value: number, unit: string, type: 'weight' | 'length' | 'head_circumference'): number {
    const u = (unit || '').toUpperCase().trim();
    if (type === 'weight') {
      if (u === 'LB') return value * 0.453592;
      if (u === 'OZ') return value * 0.0283495;
      if (u === 'G') return value / 1000;
      return value; // assume kg
    }
    // length / head_circumference — CDC uses cm
    if (u === 'IN') return value * 2.54;
    return value; // assume cm
  }

  function fromCdcUnit(value: number, type: 'weight' | 'length' | 'head_circumference'): number {
    if (type === 'weight') {
      if (displayWeightUnit === 'LB') return value / 0.453592;
      if (displayWeightUnit === 'OZ') return value / 0.0283495;
      if (displayWeightUnit === 'G') return value * 1000;
      return value; // kg
    }
    // length / head — convert from cm to display unit
    if (displayHeightUnit === 'IN') return value / 2.54;
    return value; // cm
  }

  /**
   * Find the CDC LMS row closest to a given age, interpolating between the two
   * surrounding rows (matching GrowthChart.tsx findCdcDataForAge logic).
   */
  function interpolateCdc(cdcRows: any[], targetAge: number): any | null {
    if (!cdcRows.length) return null;
    let lower: any = null;
    let upper: any = null;
    for (let i = 0; i < cdcRows.length; i++) {
      if (cdcRows[i].ageMonths <= targetAge) lower = cdcRows[i];
      if (cdcRows[i].ageMonths >= targetAge && !upper) { upper = cdcRows[i]; break; }
    }
    if (!lower && !upper) return null;
    if (!lower) return upper;
    if (!upper) return lower;
    if (lower.ageMonths === upper.ageMonths) return lower;
    const ratio = (targetAge - lower.ageMonths) / (upper.ageMonths - lower.ageMonths);
    const interp = (key: string) => lower[key] + ratio * (upper[key] - lower[key]);
    return {
      ageMonths: targetAge,
      l: interp('l'), m: interp('m'), s: interp('s'),
      p3: interp('p3'), p5: interp('p5'), p10: interp('p10'), p25: interp('p25'),
      p50: interp('p50'), p75: interp('p75'), p90: interp('p90'), p95: interp('p95'), p97: interp('p97'),
    };
  }

  // Pre-fetch all CDC rows for all 3 measurement types (for both metrics and charts)
  const [allCdcWeight, allCdcLength, allCdcHead] = await Promise.all([
    sex ? prisma.cdcWeightForAge.findMany({ where: { sex }, orderBy: { ageMonths: 'asc' } }) : Promise.resolve([]),
    sex ? prisma.cdcLengthForAge.findMany({ where: { sex }, orderBy: { ageMonths: 'asc' } }) : Promise.resolve([]),
    sex ? prisma.cdcHeadCircumferenceForAge.findMany({ where: { sex }, orderBy: { ageMonths: 'asc' } }) : Promise.resolve([]),
  ]);

  function getCdcRows(cdcTable: 'weight' | 'length' | 'head_circumference') {
    if (cdcTable === 'weight') return allCdcWeight;
    if (cdcTable === 'length') return allCdcLength;
    return allCdcHead;
  }

  function calcGrowthMetric(
    measurement: any | null,
    prevMeasurement: any | null,
    cdcTable: 'weight' | 'length' | 'head_circumference'
  ): GrowthMetric | null {
    if (!measurement) return null;
    const measDate = new Date(measurement.date);
    const babyAgeMonths = ageInMonths(birthDate, measDate);

    let percentile = 0;
    if (sex) {
      const cdcRows = getCdcRows(cdcTable);
      const cdcPoint = interpolateCdc(cdcRows, babyAgeMonths);
      if (cdcPoint) {
        // Convert the measurement value to CDC units (kg/cm) before calculating Z-score
        const cdcValue = toCdcUnit(measurement.value, measurement.unit, cdcTable);
        const z = calculateZScore(cdcValue, cdcPoint.l, cdcPoint.m, cdcPoint.s);
        percentile = zScoreToPercentile(z);
      }
    }

    // Convert measurement to display unit for consistency with the chart
    const expectedUnit = cdcTable === 'weight' ? displayWeightUnit : displayHeightUnit;
    const storedUnit = (measurement.unit || '').toUpperCase().trim();
    let displayValue = measurement.value;
    let displayUnit = measurement.unit;

    if (storedUnit !== expectedUnit && storedUnit !== '') {
      // Convert: stored unit → CDC unit → display unit
      const cdcVal = toCdcUnit(measurement.value, measurement.unit, cdcTable);
      displayValue = Math.round(fromCdcUnit(cdcVal, cdcTable) * 100) / 100;
      displayUnit = expectedUnit.toLowerCase();
    }

    // Same conversion for prev measurement to get accurate trend
    let prevDisplayValue: number | null = null;
    if (prevMeasurement) {
      const prevStoredUnit = (prevMeasurement.unit || '').toUpperCase().trim();
      if (prevStoredUnit !== expectedUnit && prevStoredUnit !== '') {
        const prevCdcVal = toCdcUnit(prevMeasurement.value, prevMeasurement.unit, cdcTable);
        prevDisplayValue = Math.round(fromCdcUnit(prevCdcVal, cdcTable) * 100) / 100;
      } else {
        prevDisplayValue = prevMeasurement.value;
      }
    }

    return {
      value: displayValue,
      unit: displayUnit,
      percentile,
      trend: getTrend(displayValue, prevDisplayValue),
    };
  }

  const weightMetric = calcGrowthMetric(weightThisMonth, weightPrevMonth, 'weight');
  const lengthMetric = calcGrowthMetric(lengthThisMonth, lengthPrevMonth, 'length');
  const headMetric = calcGrowthMetric(headThisMonth, headPrevMonth, 'head_circumference');

  // Growth velocity (weight delta — in display units)
  // Convert both months' weights to display unit for an accurate delta
  let velocity: { value: number; unit: string } | null = null;
  if (weightThisMonth && weightPrevMonth) {
    const curCdc = toCdcUnit(weightThisMonth.value, weightThisMonth.unit, 'weight');
    const prevCdc = toCdcUnit(weightPrevMonth.value, weightPrevMonth.unit, 'weight');
    const curDisplay = fromCdcUnit(curCdc, 'weight');
    const prevDisplay = fromCdcUnit(prevCdc, 'weight');
    velocity = {
      value: Math.round((curDisplay - prevDisplay) * 100) / 100,
      unit: weightMetric?.unit || displayWeightUnit.toLowerCase(),
    };
  }

  // Build chart data for all 3 measurement types using already-fetched CDC rows
  function buildChartData(
    measurements: typeof allWeights,
    cdcTable: 'weight' | 'length' | 'head_circumference'
  ): GrowthChartData {
    if (!sex || measurements.length === 0) return { points: [] };

    const cdcRows = getCdcRows(cdcTable).filter(r => r.ageMonths <= maxAgeMonths + 1);

    const points: GrowthChartPoint[] = [];
    const measByAge = measurements.map(m => ({
      ageMonths: ageInMonths(birthDate, new Date(m.date)),
      cdcValue: toCdcUnit(m.value, m.unit, cdcTable),
      displayValue: m.value,
      date: m.date,
      unit: m.unit,
    }));

    for (const cdcRow of cdcRows) {
      if (cdcRow.ageMonths > maxAgeMonths) break;

      // Convert CDC percentile values from kg/cm to user's display unit
      const convert = (v: number) => Math.round(fromCdcUnit(v, cdcTable) * 100) / 100;

      const point: GrowthChartPoint = {
        ageMonths: cdcRow.ageMonths,
        p3: convert(cdcRow.p3),
        p10: convert(cdcRow.p10),
        p25: convert(cdcRow.p25),
        p50: convert(cdcRow.p50),
        p75: convert(cdcRow.p75),
        p90: convert(cdcRow.p90),
        p97: convert(cdcRow.p97),
      };

      // Find closest baby measurement within 0.75 months
      let closest: typeof measByAge[0] | null = null;
      let closestDist = Infinity;
      for (const m of measByAge) {
        const dist = Math.abs(m.ageMonths - cdcRow.ageMonths);
        if (dist < closestDist && dist < 0.75) {
          closestDist = dist;
          closest = m;
        }
      }
      if (closest) {
        const storedUnit = (closest.unit || '').toUpperCase().trim();
        const expectedDisplayUnit = cdcTable === 'weight' ? displayWeightUnit : displayHeightUnit;
        if (storedUnit === expectedDisplayUnit || storedUnit === '') {
          point.measurement = closest.displayValue;
        } else {
          point.measurement = Math.round(fromCdcUnit(closest.cdcValue, cdcTable) * 100) / 100;
        }
        point.measurementDate = formatForResponse(closest.date as any) || new Date(closest.date).toISOString();
        // Percentile uses interpolated CDC LMS at the exact measurement age, not the nearest CDC row
        const interpolated = interpolateCdc(cdcRows, closest.ageMonths);
        if (interpolated) {
          const z = calculateZScore(closest.cdcValue, interpolated.l, interpolated.m, interpolated.s);
          point.percentile = zScoreToPercentile(z);
        }
      }
      points.push(point);
    }
    return { points };
  }

  const weightChartData = buildChartData(allWeights, 'weight');
  const lengthChartData = buildChartData(allLengths, 'length');
  const headChartData = buildChartData(allHeadCircumferences, 'head_circumference');

  // ─── Feeding ───
  const bottleFeeds = feedLogs.filter(f => f.type === 'BOTTLE');
  const solidsFeeds = feedLogs.filter(f => f.type === 'SOLIDS');
  const breastFeeds = feedLogs.filter(f => f.type === 'BREAST');

  const avgBottlesPerDay = effectiveDays > 0 ? Math.round((bottleFeeds.length / effectiveDays) * 10) / 10 : 0;
  const totalBottleAmount = bottleFeeds.reduce((sum, f) => sum + (f.amount || 0), 0);
  const avgBottleSize = bottleFeeds.length > 0
    ? { value: Math.round((totalBottleAmount / bottleFeeds.length) * 10) / 10, unit: bottleFeeds[0]?.unitAbbr || 'oz' }
    : { value: 0, unit: 'oz' };

  // Daily intake = total bottle amounts per day
  const dailyBottleTotals: Record<string, number> = {};
  bottleFeeds.forEach(f => {
    const day = f.time.toISOString().split('T')[0];
    dailyBottleTotals[day] = (dailyBottleTotals[day] || 0) + (f.amount || 0);
  });
  const dailyIntakeValues = Object.values(dailyBottleTotals);
  const avgDailyIntake = dailyIntakeValues.length > 0
    ? Math.round((dailyIntakeValues.reduce((a, b) => a + b, 0) / effectiveDays) * 10) / 10
    : 0;

  // Previous month daily intake for delta
  const prevBottleFeeds = prevFeedLogs.filter(f => f.type === 'BOTTLE');
  const prevDailyBottleTotals: Record<string, number> = {};
  prevBottleFeeds.forEach(f => {
    const day = f.time.toISOString().split('T')[0];
    prevDailyBottleTotals[day] = (prevDailyBottleTotals[day] || 0) + (f.amount || 0);
  });
  const prevDailyIntakeValues = Object.values(prevDailyBottleTotals);
  const prevAvgDailyIntake = prevDailyIntakeValues.length > 0
    ? prevDailyIntakeValues.reduce((a, b) => a + b, 0) / prevDaysInMonth
    : null;

  const dailyIntakeDelta = prevAvgDailyIntake !== null
    ? { value: Math.round((avgDailyIntake - prevAvgDailyIntake) * 10) / 10, direction: getTrend(avgDailyIntake, prevAvgDailyIntake) }
    : null;

  const avgSolidsPerDay = effectiveDays > 0 ? Math.round((solidsFeeds.length / effectiveDays) * 10) / 10 : 0;

  // Breastfeeding stats (only when breast feeds exist)
  const leftBreastFeeds = breastFeeds.filter(f => f.side === 'LEFT');
  const rightBreastFeeds = breastFeeds.filter(f => f.side === 'RIGHT');
  const avgLeftDuration = leftBreastFeeds.length > 0
    ? Math.round((leftBreastFeeds.reduce((sum, f) => sum + (f.feedDuration || 0), 0) / leftBreastFeeds.length / 60) * 10) / 10
    : 0;
  const avgRightDuration = rightBreastFeeds.length > 0
    ? Math.round((rightBreastFeeds.reduce((sum, f) => sum + (f.feedDuration || 0), 0) / rightBreastFeeds.length / 60) * 10) / 10
    : 0;
  const breastSessionDays: Record<string, Set<string>> = {};
  breastFeeds.forEach(f => {
    const day = f.time.toISOString().split('T')[0];
    if (!breastSessionDays[day]) breastSessionDays[day] = new Set();
    breastSessionDays[day].add(f.time.toISOString());
  });
  const totalBreastSessions = Object.values(breastSessionDays).reduce((sum, s) => sum + s.size, 0);
  const avgBreastSessionsPerDay = effectiveDays > 0
    ? Math.round((totalBreastSessions / effectiveDays) * 10) / 10
    : 0;

  // Feeding breakdown (by feed type: BOTTLE, BREAST, SOLIDS)
  const bottleCount = bottleFeeds.length;
  const breastCount = breastFeeds.length;
  const solidsCount = solidsFeeds.length;
  const breakdownTotal = bottleCount + breastCount + solidsCount || 1;

  // ─── Sleep ───
  const totalSleepMinutes = sleepLogs.reduce((sum, s) => sum + (s.duration || 0), 0);
  const nightSleepLogs = sleepLogs.filter(s => s.type === 'NIGHT_SLEEP');
  const napLogs = sleepLogs.filter(s => s.type === 'NAP');
  const nightSleepMinutes = nightSleepLogs.reduce((sum, s) => sum + (s.duration || 0), 0);
  const longestStretch = sleepLogs.length > 0 ? Math.max(...sleepLogs.map(s => s.duration || 0)) : 0;

  // Quality distribution
  const qualityDist = { excellent: 0, good: 0, fair: 0, poor: 0 };
  sleepLogs.forEach(s => {
    if (s.quality === 'EXCELLENT') qualityDist.excellent++;
    else if (s.quality === 'GOOD') qualityDist.good++;
    else if (s.quality === 'FAIR') qualityDist.fair++;
    else if (s.quality === 'POOR') qualityDist.poor++;
  });

  // Location distribution
  const locationMap = new Map<string, { nightCount: number; napCount: number }>();
  sleepLogs.forEach(s => {
    const loc = normalizeLocation(s.location);
    const entry = locationMap.get(loc) || { nightCount: 0, napCount: 0 };
    if (s.type === 'NIGHT_SLEEP') entry.nightCount++;
    else entry.napCount++;
    locationMap.set(loc, entry);
  });
  const locationDistribution = Array.from(locationMap.entries())
    .map(([location, counts]) => ({ location, ...counts }))
    .sort((a, b) => (b.nightCount + b.napCount) - (a.nightCount + a.napCount));

  // ─── Diapers ───
  const dirtyDiapers = diaperLogs.filter(d => d.type === 'DIRTY' || d.type === 'BOTH');
  const blowoutCount = diaperLogs.filter(d => d.blowout).length;
  const creamCount = diaperLogs.filter(d => d.creamApplied).length;
  const creamApplicationRate = diaperLogs.length > 0 ? Math.round((creamCount / diaperLogs.length) * 100) : 0;

  const colorFlags = diaperLogs
    .filter(d => isAbnormalColor(d.color))
    .map(d => ({
      date: formatForResponse(d.time) || d.time.toISOString(),
      color: d.color!,
    }));

  // ─── Activity ───
  const tummyTimeLogs = playLogs.filter(p => p.type === 'TUMMY_TIME');
  const outdoorLogs = playLogs.filter(p => p.type === 'OUTDOOR_PLAY' || p.type === 'WALK');
  const tummyTimeMinutes = tummyTimeLogs.reduce((sum, p) => sum + (p.duration || 0), 0);
  const outdoorMinutes = outdoorLogs.reduce((sum, p) => sum + (p.duration || 0), 0);
  const avgTummyTimePerDay = effectiveDays > 0 ? Math.round(tummyTimeMinutes / effectiveDays) : 0;
  const avgOutdoorTimePerDay = effectiveDays > 0 ? Math.round(outdoorMinutes / effectiveDays) : 0;

  // Tummy time delta
  const prevTummyTimeLogs = prevPlayLogs.filter(p => p.type === 'TUMMY_TIME');
  const prevTummyTimeMinutes = prevTummyTimeLogs.reduce((sum, p) => sum + (p.duration || 0), 0);
  const prevAvgTummyTime = prevDaysInMonth > 0 ? prevTummyTimeMinutes / prevDaysInMonth : null;
  const tummyTimeDelta = prevAvgTummyTime !== null
    ? { value: Math.round(avgTummyTimePerDay - prevAvgTummyTime), direction: getTrend(avgTummyTimePerDay, prevAvgTummyTime) }
    : null;

  // Bath interval
  const bathCount = bathLogs.length;
  const avgBathInterval = bathCount > 1
    ? Math.round((effectiveDays / bathCount) * 10) / 10
    : effectiveDays;

  // ─── Milestones ───
  const milestoneList = milestones.map(m => ({
    id: m.id,
    date: formatForResponse(m.date) || m.date.toISOString(),
    title: m.title,
    description: m.description,
    category: m.category as 'MOTOR' | 'COGNITIVE' | 'SOCIAL' | 'LANGUAGE' | 'CUSTOM',
  }));

  // ─── Health ───
  // Group medicine logs by medicine
  const medicineMap = new Map<string, { name: string; isSupplement: boolean; logs: any[] }>();
  medicineLogs.forEach(ml => {
    if (!ml.medicine) return;
    const existing = medicineMap.get(ml.medicineId) || {
      name: ml.medicine.name,
      isSupplement: ml.medicine.isSupplement,
      logs: [],
    };
    existing.logs.push(ml);
    medicineMap.set(ml.medicineId, existing);
  });

  const supplements: MonthlyReport['health']['supplements'] = [];
  const medicines: MonthlyReport['health']['medicines'] = [];

  medicineMap.forEach((entry) => {
    if (entry.isSupplement) {
      // Count distinct days with a dose
      const days = new Set(entry.logs.map(l => l.time.toISOString().split('T')[0]));
      const compliancePercent = effectiveDays > 0 ? Math.round((days.size / effectiveDays) * 100) : 0;
      supplements.push({
        name: entry.name,
        daysAdministered: days.size,
        totalDays: effectiveDays,
        compliancePercent,
      });
    } else {
      medicines.push({
        name: entry.name,
        totalAdministrations: entry.logs.length,
      });
    }
  });

  const vaccineList = vaccines.map(v => ({
    name: v.vaccineName,
    doseNumber: v.doseNumber,
    date: formatForResponse(v.time) || v.time.toISOString(),
  }));

  // ─── Caretaker activity ───
  const caretakerCounts = new Map<string, number>();
  const countCaretaker = (caretakerId: string | null) => {
    const id = caretakerId || '__unknown__';
    caretakerCounts.set(id, (caretakerCounts.get(id) || 0) + 1);
  };

  feedDates.forEach(r => countCaretaker(r.caretakerId));
  sleepDates.forEach(r => countCaretaker(r.caretakerId));
  diaperDates.forEach(r => countCaretaker(r.caretakerId));
  bathDates.forEach(r => countCaretaker(r.caretakerId));
  playDates.forEach(r => countCaretaker(r.caretakerId));
  medicineDates.forEach(r => countCaretaker(r.caretakerId));
  measurementDates.forEach(r => countCaretaker(r.caretakerId));
  milestoneDates.forEach(r => countCaretaker(r.caretakerId));
  noteDates.forEach(r => countCaretaker(r.caretakerId));

  const totalLogs = Array.from(caretakerCounts.values()).reduce((a, b) => a + b, 0);

  // Fetch caretaker names
  const caretakerIds = Array.from(caretakerCounts.keys()).filter(id => id !== '__unknown__');
  const caretakerRecords = caretakerIds.length > 0
    ? await prisma.caretaker.findMany({
        where: { id: { in: caretakerIds }, familyId: userFamilyId },
        select: { id: true, name: true },
      })
    : [];
  const caretakerNameMap = new Map(caretakerRecords.map(c => [c.id, c.name]));

  const caretakers = Array.from(caretakerCounts.entries())
    .map(([id, count]) => ({
      name: id === '__unknown__' ? 'Unknown' : (caretakerNameMap.get(id) || 'Unknown'),
      totalLogs: count,
      percentage: totalLogs > 0 ? Math.round((count / totalLogs) * 100) : 0,
    }))
    .sort((a, b) => b.totalLogs - a.totalLogs);

  // ─── Assemble response ───
  const report: MonthlyReport = {
    baby: {
      id: baby.id,
      firstName: baby.firstName,
      lastName: baby.lastName,
      birthDate: formatForResponse(baby.birthDate) || baby.birthDate.toISOString(),
      gender: baby.gender as 'MALE' | 'FEMALE' | null,
      ageAtEndOfMonth: age,
    },
    period: {
      year,
      month,
      daysInMonth,
      daysTracked,
      isCurrentMonth,
    },
    growth: {
      weight: weightMetric,
      length: lengthMetric,
      headCircumference: headMetric,
      velocity,
      chartData: {
        weight: weightChartData,
        length: lengthChartData,
        headCircumference: headChartData,
      },
    },
    feeding: {
      avgBottlesPerDay,
      avgBottleSize,
      avgDailyIntake: { value: avgDailyIntake, unit: avgBottleSize.unit },
      dailyIntakeDelta,
      avgSolidsPerDay,
      breastfeeding: breastFeeds.length > 0 ? {
        avgSessionsPerDay: avgBreastSessionsPerDay,
        avgLeftDuration,
        avgRightDuration,
      } : null,
      breakdown: {
        bottle: Math.round((bottleCount / breakdownTotal) * 100),
        breast: Math.round((breastCount / breakdownTotal) * 100),
        solids: Math.round((solidsCount / breakdownTotal) * 100),
      },
    },
    sleep: {
      avgTotalPerDay: effectiveDays > 0 ? Math.round((totalSleepMinutes / effectiveDays / 60) * 10) / 10 : 0,
      avgNightSleep: effectiveDays > 0 ? Math.round((nightSleepMinutes / effectiveDays / 60) * 10) / 10 : 0,
      avgNapsPerDay: effectiveDays > 0 ? Math.round((napLogs.length / effectiveDays) * 10) / 10 : 0,
      longestStretch: Math.round((longestStretch / 60) * 10) / 10,
      qualityDistribution: qualityDist,
      locationDistribution,
    },
    diapers: {
      avgChangesPerDay: effectiveDays > 0 ? Math.round((diaperLogs.length / effectiveDays) * 10) / 10 : 0,
      avgDirtyPerDay: effectiveDays > 0 ? Math.round((dirtyDiapers.length / effectiveDays) * 10) / 10 : 0,
      blowoutCount,
      creamApplicationRate,
      colorFlags,
    },
    activity: {
      avgTummyTimePerDay,
      tummyTimeDelta,
      avgOutdoorTimePerDay,
      bathCount,
      avgBathInterval,
    },
    milestones: milestoneList,
    health: {
      supplements,
      medicines,
      vaccines: vaccineList,
    },
    caretakers,
  };

  return NextResponse.json<ApiResponse<MonthlyReport>>({ success: true, data: report });
}

export const GET = withAuthContext(handleGet);
