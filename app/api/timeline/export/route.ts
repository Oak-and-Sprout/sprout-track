import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';
import { toUTC, formatForResponse } from '../../utils/timezone';
import { objectArrayToCsv } from '../../utils/csv-export';
import * as ExcelJS from 'exceljs';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load translations for a given language code
function loadTranslations(lang: string): Record<string, string> {
  try {
    const filePath = join(process.cwd(), 'src', 'localization', 'translations', `${lang}.json`);
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

function t(key: string, translations: Record<string, string>): string {
  return translations[key] || key;
}

// Get the primary time for an activity (used for Date/Time columns)
function getActivityDateTime(activity: any): string {
  if ('time' in activity && activity.time) return activity.time;
  if ('startTime' in activity && activity.startTime) return activity.startTime;
  if ('date' in activity && activity.date) return activity.date;
  return '';
}

// Determine activity type from shape
function detectActivityType(activity: any): string {
  if ('duration' in activity && 'type' in activity && ('location' in activity || 'quality' in activity)) return 'sleep';
  if ('amount' in activity && 'type' in activity && ('side' in activity || 'food' in activity || 'feedDuration' in activity || 'bottleType' in activity)) return 'feed';
  if ('condition' in activity && 'type' in activity) return 'diaper';
  if ('content' in activity) return 'note';
  if ('soapUsed' in activity) return 'bath';
  if ('leftAmount' in activity || 'rightAmount' in activity || 'totalAmount' in activity) return 'pump';
  if ('reason' in activity && 'amount' in activity && !('type' in activity)) return 'breast-milk-adjustment';
  if ('title' in activity && 'category' in activity) return 'milestone';
  if ('value' in activity && 'unit' in activity && 'type' in activity) return 'measurement';
  if ('doseAmount' in activity && 'medicineId' in activity) return 'medicine';
  if ('vaccineName' in activity) return 'vaccine';
  if ('activities' in activity && 'type' in activity) return 'play';
  return 'unknown';
}

// Map activity type to localized display name
function getActivityTypeName(type: string, translations: Record<string, string>): string {
  const typeNames: Record<string, string> = {
    'sleep': 'Sleep',
    'feed': 'Feed',
    'diaper': 'Diaper',
    'note': 'Note',
    'bath': 'Bath',
    'pump': 'Pump',
    'breast-milk-adjustment': 'Milk Adjust',
    'milestone': 'Milestone',
    'measurement': 'Measurement',
    'medicine': 'Medicine',
    'play': 'Activity',
    'vaccine': 'Vaccine',
  };
  return t(typeNames[type] || type, translations);
}

// Get sub-type for an activity
function getSubType(activity: any, type: string, translations: Record<string, string>): string {
  switch (type) {
    case 'sleep':
      return activity.type ? t(activity.type === 'NAP' ? 'Nap' : 'Night Sleep', translations) : '';
    case 'feed':
      if (activity.type === 'BREAST') return t('Breast', translations);
      if (activity.type === 'BOTTLE') {
        if (activity.bottleType) return t(activity.bottleType, translations);
        return t('Bottle', translations);
      }
      if (activity.type === 'SOLIDS') return t('Solids', translations);
      return activity.type || '';
    case 'diaper':
      if (activity.type === 'WET') return t('Wet', translations);
      if (activity.type === 'DIRTY') return t('Dirty', translations);
      if (activity.type === 'BOTH') return t('Both', translations);
      return activity.type || '';
    case 'pump':
      return activity.pumpAction ? t(activity.pumpAction, translations) : '';
    case 'milestone':
      return activity.category ? t(activity.category, translations) : '';
    case 'measurement':
      if (activity.type === 'HEIGHT') return t('Height', translations);
      if (activity.type === 'WEIGHT') return t('Weight', translations);
      if (activity.type === 'HEAD_CIRCUMFERENCE') return t('Head Circumference', translations);
      if (activity.type === 'TEMPERATURE') return t('Temperature', translations);
      return activity.type || '';
    case 'play':
      if (activity.type === 'TUMMY_TIME') return t('Tummy Time', translations);
      if (activity.type === 'INDOOR_PLAY') return t('Indoor Play', translations);
      if (activity.type === 'OUTDOOR_PLAY') return t('Outdoor Play', translations);
      if (activity.type === 'WALK') return t('Walk', translations);
      if (activity.type === 'CUSTOM') return t('Custom', translations);
      return activity.type || '';
    case 'breast-milk-adjustment':
      return activity.reason ? t(activity.reason, translations) : '';
    default:
      return '';
  }
}

// Format duration in minutes to human-readable string
function formatDuration(minutes: number | null | undefined, translations: Record<string, string>): string {
  if (minutes == null) return '';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0 && mins > 0) return `${hrs} ${t('hr', translations)} ${mins} ${t('min', translations)}`;
  if (hrs > 0) return `${hrs} ${t('hr', translations)}`;
  return `${mins} ${t('min', translations)}`;
}

// Format feed duration (stored in seconds) to human-readable
function formatFeedDuration(seconds: number | null | undefined, translations: Record<string, string>): string {
  if (seconds == null) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0 && secs > 0) return `${mins} ${t('min', translations)} ${secs} ${t('sec', translations)}`;
  if (mins > 0) return `${mins} ${t('min', translations)}`;
  return `${secs} ${t('sec', translations)}`;
}

// Get the amount and unit for an activity
function getAmount(activity: any, type: string): string {
  switch (type) {
    case 'feed':
      return activity.amount != null ? String(activity.amount) : '';
    case 'pump': {
      const parts: string[] = [];
      if (activity.leftAmount != null) parts.push(`L: ${activity.leftAmount}`);
      if (activity.rightAmount != null) parts.push(`R: ${activity.rightAmount}`);
      if (activity.totalAmount != null) parts.push(`Total: ${activity.totalAmount}`);
      return parts.join(', ');
    }
    case 'medicine':
      return activity.doseAmount != null ? String(activity.doseAmount) : '';
    case 'measurement':
      return activity.value != null ? String(activity.value) : '';
    case 'breast-milk-adjustment':
      return activity.amount != null ? String(activity.amount) : '';
    default:
      return '';
  }
}

function getUnit(activity: any, type: string): string {
  switch (type) {
    case 'feed':
    case 'pump':
    case 'medicine':
    case 'breast-milk-adjustment':
      return activity.unitAbbr || '';
    case 'measurement':
      return activity.unit || '';
    default:
      return '';
  }
}

// Get activity-specific details
function getDetails(activity: any, type: string, translations: Record<string, string>): string {
  const parts: string[] = [];
  switch (type) {
    case 'sleep':
      if (activity.location) parts.push(`${t('Location', translations)}: ${activity.location}`);
      if (activity.quality) parts.push(`${t('Quality', translations)}: ${t(activity.quality, translations)}`);
      break;
    case 'feed':
      if (activity.side) parts.push(`${t('Side', translations)}: ${t(activity.side === 'LEFT' ? 'Left' : 'Right', translations)}`);
      if (activity.food) parts.push(`${t('Food', translations)}: ${activity.food}`);
      if (activity.breastMilkAmount != null) parts.push(`${t('Breast Milk', translations)}: ${activity.breastMilkAmount}`);
      break;
    case 'diaper':
      if (activity.color) parts.push(`${t('Color', translations)}: ${activity.color}`);
      if (activity.condition) parts.push(`${t('Condition', translations)}: ${activity.condition}`);
      if (activity.blowout) parts.push(t('Blowout', translations));
      if (activity.creamApplied) parts.push(t('Cream Applied', translations));
      break;
    case 'bath':
      if (activity.soapUsed) parts.push(t('Soap', translations));
      if (activity.shampooUsed) parts.push(t('Shampoo', translations));
      break;
    case 'milestone':
      if (activity.title) parts.push(activity.title);
      if (activity.description) parts.push(activity.description);
      break;
    case 'medicine':
      if (activity.medicine?.name) parts.push(activity.medicine.name);
      break;
    case 'vaccine':
      if (activity.vaccineName) parts.push(activity.vaccineName);
      if (activity.doseNumber != null) parts.push(`${t('Dose', translations)} #${activity.doseNumber}`);
      break;
    case 'play':
      if (activity.activities) parts.push(activity.activities);
      break;
    case 'note':
      if (activity.category) parts.push(`${t('Category', translations)}: ${activity.category}`);
      break;
  }
  return parts.join('; ');
}

function getNotes(activity: any, type: string): string {
  if (type === 'note') return activity.content || '';
  return activity.notes || '';
}

// Format a date string into separate date and time parts
function formatDateParts(dateStr: string, timezone: string): { date: string; time: string } {
  if (!dateStr) return { date: '', time: '' };
  try {
    const d = new Date(dateStr);
    const formatted = d.toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    // Split "MM/DD/YYYY, HH:MM AM/PM"
    const [datePart, timePart] = formatted.split(', ');
    return { date: datePart || '', time: timePart || '' };
  } catch {
    return { date: dateStr, time: '' };
  }
}

function formatTimePart(dateStr: string | null | undefined, timezone: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

// Build a flat export row from an activity
function activityToRow(activity: any, timezone: string, translations: Record<string, string>): Record<string, string> {
  const type = detectActivityType(activity);
  const dateTime = getActivityDateTime(activity);
  const { date, time } = formatDateParts(dateTime, timezone);

  // Determine start/end times for duration activities
  let startTime = '';
  let endTime = '';
  let duration = '';

  if (type === 'sleep' || type === 'pump' || type === 'play') {
    startTime = formatTimePart(activity.startTime, timezone);
    endTime = formatTimePart(activity.endTime, timezone);
    duration = formatDuration(activity.duration, translations);
  } else if (type === 'feed' && activity.startTime) {
    startTime = formatTimePart(activity.startTime, timezone);
    endTime = formatTimePart(activity.endTime, timezone);
    duration = formatFeedDuration(activity.feedDuration, translations);
  }

  return {
    [t('Date', translations)]: date,
    [t('Time', translations)]: time,
    [t('Activity Type', translations)]: getActivityTypeName(type, translations),
    [t('Sub-Type', translations)]: getSubType(activity, type, translations),
    [t('Start Time', translations)]: startTime,
    [t('End Time', translations)]: endTime,
    [t('Duration', translations)]: duration,
    [t('Amount', translations)]: getAmount(activity, type),
    [t('Unit', translations)]: getUnit(activity, type),
    [t('Details', translations)]: getDetails(activity, type, translations),
    [t('Notes', translations)]: getNotes(activity, type),
    [t('Caretaker', translations)]: activity.caretakerName || '',
  };
}

// Reuse the same sorting logic as the timeline API
function getActivityTime(activity: any): number {
  if ('time' in activity && activity.time) return new Date(activity.time).getTime();
  if ('startTime' in activity && activity.startTime) return new Date(activity.startTime).getTime();
  if ('date' in activity && activity.date) return new Date(activity.date).getTime();
  return 0;
}

async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User is not associated with a family.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const babyId = searchParams.get('babyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const format = searchParams.get('format') || 'csv';
    const filter = searchParams.get('filter'); // activity type filter
    const timezone = searchParams.get('timezone') || 'UTC';
    const language = searchParams.get('language') || 'en';

    if (!babyId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Baby ID is required' },
        { status: 400 }
      );
    }

    // Verify baby belongs to family
    const baby = await prisma.baby.findFirst({
      where: { id: babyId, familyId: userFamilyId },
    });

    if (!baby) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Baby not found in this family.' },
        { status: 404 }
      );
    }

    const familyId = baby.familyId;

    // Load translations
    const translations = loadTranslations(language);

    // Convert dates
    const startDateUTC = startDate ? toUTC(startDate) : undefined;
    const endDateUTC = endDate ? toUTC(endDate) : undefined;

    // Determine which types to fetch based on filter
    const shouldFetch = (type: string) => !filter || filter === type;
    const emptyPromise = Promise.resolve([]);

    const [sleepLogs, feedLogs, diaperLogs, noteLogs, bathLogs, pumpLogs, playLogs, milestoneLogs, measurementLogs, medicineLogs, breastMilkAdjustments, vaccineLogs] = await Promise.all([
      shouldFetch('sleep') ? prisma.sleepLog.findMany({
        where: {
          babyId,
          familyId,
          ...(startDateUTC && endDateUTC ? {
            OR: [
              { startTime: { gte: startDateUTC, lte: endDateUTC } },
              { endTime: { gte: startDateUTC, lte: endDateUTC } },
              { startTime: { lte: startDateUTC }, endTime: { gte: endDateUTC } },
            ]
          } : {}),
        },
        include: { caretaker: true },
        orderBy: { startTime: 'desc' },
      }) : emptyPromise,
      shouldFetch('feed') ? prisma.feedLog.findMany({
        where: {
          babyId, familyId,
          ...(startDateUTC && endDateUTC ? { time: { gte: startDateUTC, lte: endDateUTC } } : {}),
        },
        include: { caretaker: true },
        orderBy: { time: 'desc' },
      }) : emptyPromise,
      shouldFetch('diaper') ? prisma.diaperLog.findMany({
        where: {
          babyId, familyId,
          ...(startDateUTC && endDateUTC ? { time: { gte: startDateUTC, lte: endDateUTC } } : {}),
        },
        include: { caretaker: true },
        orderBy: { time: 'desc' },
      }) : emptyPromise,
      shouldFetch('note') ? prisma.note.findMany({
        where: {
          babyId, familyId,
          ...(startDateUTC && endDateUTC ? { time: { gte: startDateUTC, lte: endDateUTC } } : {}),
        },
        include: { caretaker: true },
        orderBy: { time: 'desc' },
      }) : emptyPromise,
      shouldFetch('bath') ? prisma.bathLog.findMany({
        where: {
          babyId, familyId,
          ...(startDateUTC && endDateUTC ? { time: { gte: startDateUTC, lte: endDateUTC } } : {}),
        },
        include: { caretaker: true },
        orderBy: { time: 'desc' },
      }) : emptyPromise,
      shouldFetch('pump') ? prisma.pumpLog.findMany({
        where: {
          babyId, familyId,
          ...(startDateUTC && endDateUTC ? { startTime: { gte: startDateUTC, lte: endDateUTC } } : {}),
        },
        include: { caretaker: true },
        orderBy: { startTime: 'desc' },
      }) : emptyPromise,
      shouldFetch('play') ? prisma.playLog.findMany({
        where: {
          babyId, familyId,
          ...(startDateUTC && endDateUTC ? { startTime: { gte: startDateUTC, lte: endDateUTC } } : {}),
        },
        include: { caretaker: true },
        orderBy: { startTime: 'desc' },
      }) : emptyPromise,
      shouldFetch('milestone') ? prisma.milestone.findMany({
        where: {
          babyId, familyId,
          ...(startDateUTC && endDateUTC ? { date: { gte: startDateUTC, lte: endDateUTC } } : {}),
        },
        include: { caretaker: true },
        orderBy: { date: 'desc' },
      }) : emptyPromise,
      shouldFetch('measurement') ? prisma.measurement.findMany({
        where: {
          babyId, familyId,
          ...(startDateUTC && endDateUTC ? { date: { gte: startDateUTC, lte: endDateUTC } } : {}),
        },
        include: { caretaker: true },
        orderBy: { date: 'desc' },
      }) : emptyPromise,
      shouldFetch('medicine') ? prisma.medicineLog.findMany({
        where: {
          babyId, familyId,
          ...(startDateUTC && endDateUTC ? { time: { gte: startDateUTC, lte: endDateUTC } } : {}),
        },
        include: { caretaker: true, medicine: true },
        orderBy: { time: 'desc' },
      }) : emptyPromise,
      shouldFetch('breast-milk-adjustment') ? prisma.breastMilkAdjustment.findMany({
        where: {
          babyId, familyId, deletedAt: null,
          ...(startDateUTC && endDateUTC ? { time: { gte: startDateUTC, lte: endDateUTC } } : {}),
        },
        include: { caretaker: true },
        orderBy: { time: 'desc' },
      }) : emptyPromise,
      shouldFetch('vaccine') ? prisma.vaccineLog.findMany({
        where: {
          babyId, familyId,
          ...(startDateUTC && endDateUTC ? { time: { gte: startDateUTC, lte: endDateUTC } } : {}),
        },
        include: { caretaker: true },
        orderBy: { time: 'desc' },
      }) : emptyPromise,
    ]);

    // Format all activities with caretaker names
    const formatLog = (log: any) => {
      const { caretaker, medicine, documents, contacts, ...rest } = log;
      const formatted: any = { ...rest };
      // Format dates
      for (const key of ['time', 'startTime', 'endTime', 'date', 'createdAt', 'updatedAt', 'deletedAt']) {
        if (key in formatted && formatted[key] instanceof Date) {
          formatted[key] = formatForResponse(formatted[key]);
        }
      }
      formatted.caretakerName = caretaker?.name || '';
      if (medicine) formatted.medicine = medicine;
      return formatted;
    };

    const allActivities = [
      ...sleepLogs.map(formatLog),
      ...feedLogs.map(formatLog),
      ...diaperLogs.map(formatLog),
      ...noteLogs.map(formatLog),
      ...bathLogs.map(formatLog),
      ...pumpLogs.map(formatLog),
      ...playLogs.map(formatLog),
      ...milestoneLogs.map(formatLog),
      ...measurementLogs.map(formatLog),
      ...medicineLogs.map(formatLog),
      ...breastMilkAdjustments.map(formatLog),
      ...vaccineLogs.map(formatLog),
    ].sort((a, b) => getActivityTime(b) - getActivityTime(a));

    // Build export rows
    const rows = allActivities.map(activity => activityToRow(activity, timezone, translations));

    if (rows.length === 0) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'No activities found for the selected date range.' },
        { status: 404 }
      );
    }

    const babyName = `${baby.firstName}${baby.lastName ? '-' + baby.lastName : ''}`;
    const dateStr = new Date().toISOString().split('T')[0];

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(t('Activity Log', translations));

      // Use localized headers from the first row's keys
      const headers = Object.keys(rows[0]);
      worksheet.columns = headers.map(header => ({
        header,
        key: header,
        width: header === t('Details', translations) || header === t('Notes', translations) ? 35 : 18,
      }));

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0D9488' }, // teal-600
      };
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

      for (const row of rows) {
        worksheet.addRow(row);
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `activity-log-${babyName}-${dateStr}.xlsx`;

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': buffer.byteLength.toString(),
        },
      });
    }

    // CSV format (default)
    const csvContent = objectArrayToCsv(rows);
    const filename = `activity-log-${babyName}-${dateStr}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv;charset=utf-8;',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting timeline:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to export timeline' },
      { status: 500 }
    );
  }
}

export const GET = withAuthContext(handleGet as any);
