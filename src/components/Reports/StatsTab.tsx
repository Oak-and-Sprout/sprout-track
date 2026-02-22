'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Accordion } from '@/src/components/ui/accordion';
import { styles } from './reports.styles';
import { useBaby } from '@/app/context/baby';
import { useTimezone } from '@/app/context/timezone';
import {
  StatsTabProps,
  ActivityType,
  CombinedStats,
  MeasurementActivity,
  LocationStat,
  MedicineStat,
} from './reports.types';
import SleepStatsSection from './SleepStatsSection';
import FeedingStatsSection from './FeedingStatsSection';
import DiaperStatsSection from './DiaperStatsSection';
import PumpingStatsSection from './PumpingStatsSection';
import BathStatsSection from './BathStatsSection';
import TemperatureStatsSection from './TemperatureStatsSection';

// Helper to calculate age in months from birth date (copied from GrowthChart)
const calculateAgeInMonths = (birthDate: string, measurementDate: string): number => {
  const birth = new Date(birthDate);
  const measurement = new Date(measurementDate);

  const years = measurement.getFullYear() - birth.getFullYear();
  const months = measurement.getMonth() - birth.getMonth();
  const days = measurement.getDate() - birth.getDate();

  let totalMonths = years * 12 + months;
  if (days < 0) {
    totalMonths -= 1;
  }

  // Add fractional month based on day of month
  const daysInMonth = new Date(measurement.getFullYear(), measurement.getMonth() + 1, 0).getDate();
  const dayFraction = (days >= 0 ? days : daysInMonth + days) / daysInMonth;

  return Math.max(0, totalMonths + dayFraction);
};

/**
 * StatsTab Component
 *
 * Displays statistical summaries of baby activities with collapsible sections
 * for sleep, feeding, diapers, and other activities.
 */
const StatsTab: React.FC<StatsTabProps> = ({
  activities,
  dateRange,
  isLoading
}) => {
  const { selectedBaby } = useBaby();
  const { toLocalDate } = useTimezone();
  const [temperatureMeasurements, setTemperatureMeasurements] = useState<MeasurementActivity[]>([]);

  // Helper function to get the night period date key for a sleep entry
  // Night period for Day X = 12:00 PM Day X-1 to 11:59 AM Day X
  // This means sleep starting at 8 PM on Jan 1 belongs to the night of Jan 1 (displayed as Jan 2's night sleep)
  // And sleep starting at 2 AM on Jan 2 also belongs to the night of Jan 1
  const getNightPeriodDateKey = (startTimeIso: string): string => {
    const localDate = toLocalDate(startTimeIso);
    if (!localDate) return '';

    const hour = localDate.getHours();
    const nightDate = new Date(localDate);

    if (hour < 12) {
      // Before noon: belongs to previous day's night period
      // e.g., sleep at 2 AM on Jan 2 belongs to the night of Jan 1
      nightDate.setDate(nightDate.getDate() - 1);
    }
    // At/after noon: belongs to that day's night period
    // e.g., sleep at 8 PM on Jan 1 belongs to the night of Jan 1

    // Return date key in YYYY-MM-DD format
    const year = nightDate.getFullYear();
    const month = String(nightDate.getMonth() + 1).padStart(2, '0');
    const day = String(nightDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper function to get the calendar day key for a time (used for naps)
  const getCalendarDayKey = (timeIso: string): string => {
    const localDate = toLocalDate(timeIso);
    if (!localDate) return '';

    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  // Helper function to format minutes into hours and minutes
  const formatMinutes = (minutes: number): string => {
    if (minutes === 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  // Calculate all statistics from activities
  const stats = useMemo((): CombinedStats => {
    if (!activities.length || !dateRange.from || !dateRange.to) {
      return {
        sleep: {
          totalSleepMinutes: 0,
          avgNapMinutes: 0,
          avgDailyNapMinutes: 0,
          avgNightSleepMinutes: 0,
          avgNightWakings: 0,
          napLocations: [],
          nightLocations: [],
        },
        feeding: {
          totalFeeds: 0,
          bottleFeeds: { count: 0, amounts: {}, avgByType: [] },
          breastFeeds: { count: 0, leftMinutes: 0, rightMinutes: 0, leftCount: 0, rightCount: 0, avgLeftMinutes: 0, avgRightMinutes: 0 },
          solidsFeeds: { count: 0, amounts: {}, avgByFood: [] },
        },
        diaper: {
          totalChanges: 0,
          wetCount: 0,
          poopCount: 0,
          avgWetPerDay: 0,
          avgPoopPerDay: 0,
          daysInRange: 1,
        },
        other: {
          noteCount: 0,
          milestoneCount: 0,
          measurementCount: 0,
          medicines: [],
        },
        pump: {
          pumpsPerDay: 0,
          avgDurationMinutes: 0,
          avgLeftAmount: 0,
          avgRightAmount: 0,
          unit: 'oz',
        },
        bath: {
          totalBaths: 0,
          bathsPerWeek: 0,
          soapShampooBathsPerWeek: 0,
        },
      };
    }

    const startDate = new Date(dateRange.from);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.to);
    endDate.setHours(23, 59, 59, 999);

    // Calculate number of days in range
    const daysInRange = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Sleep tracking
    let totalSleepMinutes = 0;
    let totalNapMinutes = 0;
    let napCount = 0;
    // Track night sleep by night date to calculate total per night and wakings
    const nightSleepByNight: Record<string, { totalMinutes: number; sessions: number }> = {};
    const napLocationMap: Record<string, { count: number; totalMinutes: number }> = {};
    const nightLocationMap: Record<string, { count: number; totalMinutes: number }> = {};

    // Feeding tracking
    let totalFeeds = 0;
    let bottleFeedCount = 0;
    const bottleAmounts: Record<string, number> = {};
    // Track by bottle type for averages
    const bottleByType: Record<string, { count: number; totalAmount: number; unit: string }> = {};
    let breastFeedCount = 0;
    let leftBreastMinutes = 0;
    let rightBreastMinutes = 0;
    let leftBreastCount = 0;
    let rightBreastCount = 0;
    let solidsFeedCount = 0;
    const solidsAmounts: Record<string, number> = {};
    // Track by food type for averages
    const solidsByFood: Record<string, { count: number; totalAmount: number; unit: string }> = {};

    // Diaper tracking
    let totalDiaperChanges = 0;
    let wetCount = 0;
    let poopCount = 0;

    // Other tracking
    let bathCount = 0;
    let soapShampooBathCount = 0;
    let pumpCount = 0;
    let noteCount = 0;
    let milestoneCount = 0;
    let measurementCount = 0;
    const medicineMap: Record<string, { count: number; total: number; unit: string }> = {};
    let totalPumpDurationMinutes = 0;
    let totalLeftPumpAmount = 0;
    let totalRightPumpAmount = 0;
    let pumpSessions = 0;
    let pumpUnit: string | null = null;

    // Generate list of valid night period keys for the selected date range
    // For date range 7/13-7/16, valid night keys are: 7/12, 7/13, 7/14, 7/15
    // (7/12's night = 7/12 12PM to 7/13 11:59AM, which is displayed as 7/13's night sleep)
    const validNightKeys = new Set<string>();
    const validNapDayKeys = new Set<string>();
    const tempDate = new Date(startDate);
    while (tempDate <= endDate) {
      // For night sleep: the night KEY is the day before what's displayed
      // E.g., if user selects 7/13, they want night sleep from 7/12 12PM to 7/13 11:59AM
      // This would be stored with nightKey = "7/12" but displayed as "7/13's night"
      const prevDate = new Date(tempDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const nightKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;
      validNightKeys.add(nightKey);

      // For naps: use the actual calendar day
      const napKey = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}-${String(tempDate.getDate()).padStart(2, '0')}`;
      validNapDayKeys.add(napKey);

      tempDate.setDate(tempDate.getDate() + 1);
    }

    activities.forEach((activity) => {
      // Sleep activities
      if ('duration' in activity && 'startTime' in activity && 'type' in activity) {
        const activityType = (activity as any).type;
        if (activityType === 'NAP' || activityType === 'NIGHT_SLEEP') {
          const sleepActivity = activity as any;
          const startTime = new Date(sleepActivity.startTime);
          const endTime = sleepActivity.endTime ? new Date(sleepActivity.endTime) : null;

          if (endTime) {
            // Calculate full sleep duration
            const fullSleepMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
            const location = sleepActivity.location || 'Unknown';

            // Use activity type to distinguish naps from night sleep
            const isNightSleepType = activityType === 'NIGHT_SLEEP';
            const isNapType = activityType === 'NAP';

            if (isNightSleepType) {
              // Get the night period key using timezone-aware helper
              const nightKey = getNightPeriodDateKey(sleepActivity.startTime);

              // Only include if this night period is within our selected date range
              if (nightKey && validNightKeys.has(nightKey)) {
                totalSleepMinutes += fullSleepMinutes;

                // Track night location
                if (!nightLocationMap[location]) {
                  nightLocationMap[location] = { count: 0, totalMinutes: 0 };
                }
                nightLocationMap[location].count++;
                nightLocationMap[location].totalMinutes += fullSleepMinutes;

                // Group night sleep by the "night" period (12PM day 1 to 11:59AM day 2)
                if (!nightSleepByNight[nightKey]) {
                  nightSleepByNight[nightKey] = { totalMinutes: 0, sessions: 0 };
                }
                nightSleepByNight[nightKey].totalMinutes += fullSleepMinutes;
                nightSleepByNight[nightKey].sessions++;
              }
            } else if (isNapType) {
              // Get the calendar day key using timezone-aware helper
              const napDayKey = getCalendarDayKey(sleepActivity.startTime);

              // Only include if this nap day is within our selected date range
              if (napDayKey && validNapDayKeys.has(napDayKey)) {
                totalSleepMinutes += fullSleepMinutes;
                totalNapMinutes += fullSleepMinutes;
                napCount++;

                // Track nap location
                if (!napLocationMap[location]) {
                  napLocationMap[location] = { count: 0, totalMinutes: 0 };
                }
                napLocationMap[location].count++;
                napLocationMap[location].totalMinutes += fullSleepMinutes;
              }
            }
          }
        }
      }

      // Feed activities
      if ('type' in activity && 'time' in activity) {
        const activityType = (activity as any).type;

        if (activityType === 'BOTTLE' || activityType === 'BREAST' || activityType === 'SOLIDS') {
          totalFeeds++;

          if (activityType === 'BOTTLE') {
            bottleFeedCount++;
            const feedActivity = activity as any;
            if (feedActivity.amount) {
              const unit = feedActivity.unitAbbr || 'oz';
              if (!bottleAmounts[unit]) bottleAmounts[unit] = 0;
              bottleAmounts[unit] += feedActivity.amount;

              // Track by bottle type
              const bottleType = feedActivity.bottleType || 'Uncategorized';
              if (!bottleByType[bottleType]) {
                bottleByType[bottleType] = { count: 0, totalAmount: 0, unit };
              }
              bottleByType[bottleType].count++;
              bottleByType[bottleType].totalAmount += feedActivity.amount;
            }
          } else if (activityType === 'BREAST') {
            breastFeedCount++;
            const feedActivity = activity as any;
            let feedMinutes = 0;
            if (feedActivity.feedDuration) {
              feedMinutes = Math.floor(feedActivity.feedDuration / 60);
            } else if (feedActivity.amount) {
              feedMinutes = feedActivity.amount;
            }

            if (feedActivity.side === 'LEFT') {
              leftBreastMinutes += feedMinutes;
              leftBreastCount++;
            } else if (feedActivity.side === 'RIGHT') {
              rightBreastMinutes += feedMinutes;
              rightBreastCount++;
            }
          } else if (activityType === 'SOLIDS') {
            solidsFeedCount++;
            const feedActivity = activity as any;
            if (feedActivity.amount) {
              const unit = feedActivity.unitAbbr || 'g';
              if (!solidsAmounts[unit]) solidsAmounts[unit] = 0;
              solidsAmounts[unit] += feedActivity.amount;

              // Track by food type
              const foodType = feedActivity.food || 'Uncategorized';
              if (!solidsByFood[foodType]) {
                solidsByFood[foodType] = { count: 0, totalAmount: 0, unit };
              }
              solidsByFood[foodType].count++;
              solidsByFood[foodType].totalAmount += feedActivity.amount;
            }
          }
        }
      }

      // Diaper activities
      if ('condition' in activity && 'type' in activity) {
        totalDiaperChanges++;
        const diaperActivity = activity as any;

        if (diaperActivity.type === 'WET') {
          wetCount++;
        } else if (diaperActivity.type === 'DIRTY') {
          poopCount++;
        } else if (diaperActivity.type === 'BOTH') {
          wetCount++;
          poopCount++;
        }
      }

      // Bath activities
      if ('soapUsed' in activity) {
        bathCount++;
        const bathActivity = activity as any;
        if (bathActivity.soapUsed || bathActivity.shampooUsed) {
          soapShampooBathCount++;
        }
      }

      // Pump activities
      if ('leftAmount' in activity || 'rightAmount' in activity || 'totalAmount' in activity) {
        pumpCount++;
        const pumpActivity = activity as any;
        pumpSessions++;

        if (pumpActivity.startTime && pumpActivity.endTime) {
          const start = new Date(pumpActivity.startTime);
          const end = new Date(pumpActivity.endTime);
          const diffMs = end.getTime() - start.getTime();
          if (diffMs > 0) {
            totalPumpDurationMinutes += Math.floor(diffMs / (1000 * 60));
          }
        } else if (pumpActivity.duration) {
          totalPumpDurationMinutes += Math.floor(pumpActivity.duration / 60);
        }

        if (typeof pumpActivity.leftAmount === 'number') {
          totalLeftPumpAmount += pumpActivity.leftAmount;
        } else if (typeof pumpActivity.totalAmount === 'number') {
          if(typeof pumpActivity.rightAmount === 'number') {
            totalLeftPumpAmount += pumpActivity.totalAmount - pumpActivity.rightAmount;
          } else {
            totalLeftPumpAmount += pumpActivity.totalAmount / 2; // Assume half if right amount is unknown
          }
        }

        if (typeof pumpActivity.rightAmount === 'number') {
          totalRightPumpAmount += pumpActivity.rightAmount;
        } else if (typeof pumpActivity.totalAmount === 'number') {
          if(typeof pumpActivity.leftAmount === 'number') {
            totalRightPumpAmount += pumpActivity.totalAmount - pumpActivity.leftAmount;
          } else{
            totalRightPumpAmount += pumpActivity.totalAmount / 2; // Assume half if left amount is unknown
          }
        }

        if (!pumpUnit && pumpActivity.unitAbbr) {
          pumpUnit = pumpActivity.unitAbbr;
        }
      }

      // Note activities
      if ('content' in activity && !('title' in activity)) {
        noteCount++;
      }

      // Milestone activities
      if ('title' in activity && 'category' in activity) {
        milestoneCount++;
      }

      // Measurement activities
      if ('value' in activity && 'unit' in activity && !('doseAmount' in activity)) {
        measurementCount++;
      }

      // Medicine activities
      if ('doseAmount' in activity && 'medicineId' in activity) {
        const medActivity = activity as any;
        let medicineName = 'Unknown';
        if (medActivity.medicine?.name) {
          medicineName = medActivity.medicine.name;
        }

        if (!medicineMap[medicineName]) {
          medicineMap[medicineName] = {
            count: 0,
            total: 0,
            unit: medActivity.unitAbbr || '',
          };
        }
        medicineMap[medicineName].count++;
        medicineMap[medicineName].total += medActivity.doseAmount || 0;
      }
    });

    // Calculate averages
    // Average nap duration per nap instance
    const avgNapMinutes = napCount > 0 ? Math.round(totalNapMinutes / napCount) : 0;
    // Average total nap time per day
    const avgDailyNapMinutes = daysInRange > 0 ? Math.round(totalNapMinutes / daysInRange) : 0;

    // Calculate night sleep stats from grouped data
    const nightsCount = Object.keys(nightSleepByNight).length;
    let totalNightSleepMinutes = 0;
    let totalWakings = 0;

    Object.values(nightSleepByNight).forEach((night) => {
      totalNightSleepMinutes += night.totalMinutes;
      // Night wakings = number of sleep sessions - 1 (first sleep of night isn't a "waking")
      // If baby sleeps 4 times during a night, they woke up 3 times
      totalWakings += Math.max(0, night.sessions - 1);
    });

    // Average night sleep is total sleep divided by number of nights
    const avgNightSleepMinutes = nightsCount > 0 ? Math.round(totalNightSleepMinutes / nightsCount) : 0;
    const avgNightWakings = nightsCount > 0 ? Math.round((totalWakings / nightsCount) * 10) / 10 : 0;

    // Convert location maps to sorted arrays
    const napLocations: LocationStat[] = Object.entries(napLocationMap)
      .map(([location, data]) => ({
        location,
        count: data.count,
        totalMinutes: data.totalMinutes,
      }))
      .sort((a, b) => b.count - a.count);

    const nightLocations: LocationStat[] = Object.entries(nightLocationMap)
      .map(([location, data]) => ({
        location,
        count: data.count,
        totalMinutes: data.totalMinutes,
      }))
      .sort((a, b) => b.count - a.count);

    // Convert medicine map to sorted array
    const medicines: MedicineStat[] = Object.entries(medicineMap)
      .map(([name, data]) => ({
        name,
        count: data.count,
        totalAmount: data.total,
        unit: data.unit,
      }))
      .sort((a, b) => b.count - a.count);

    // Calculate averages for feeding
    const bottleAvgByType = Object.entries(bottleByType).map(([type, data]) => ({
      type,
      avgAmount: data.count > 0 ? data.totalAmount / data.count : 0,
      unit: data.unit,
      count: data.count,
    })).sort((a, b) => b.count - a.count);

    const avgLeftBreastMinutes = leftBreastCount > 0 ? Math.round(leftBreastMinutes / leftBreastCount) : 0;
    const avgRightBreastMinutes = rightBreastCount > 0 ? Math.round(rightBreastMinutes / rightBreastCount) : 0;

    const solidsAvgByFood = Object.entries(solidsByFood).map(([food, data]) => ({
      food,
      avgAmount: data.count > 0 ? data.totalAmount / data.count : 0,
      unit: data.unit,
      count: data.count,
    })).sort((a, b) => b.count - a.count);

    // Calculate average diapers per day
    const avgWetPerDay = daysInRange > 0 ? Math.round((wetCount / daysInRange) * 10) / 10 : 0;
    const avgPoopPerDay = daysInRange > 0 ? Math.round((poopCount / daysInRange) * 10) / 10 : 0;

    // Bath stats
    const bathsPerWeek = daysInRange > 0 ? Math.round(((bathCount / daysInRange) * 7) * 10) / 10 : 0;
    const soapShampooBathsPerWeek = daysInRange > 0 ? Math.round(((soapShampooBathCount / daysInRange) * 7) * 10) / 10 : 0;

    // Pumping stats
    const pumpsPerDay = daysInRange > 0 ? Math.round((pumpCount / daysInRange) * 10) / 10 : 0;
    const avgPumpDurationMinutes = pumpSessions > 0 ? Math.round(totalPumpDurationMinutes / pumpSessions) : 0;
    const avgLeftPumpAmount = pumpSessions > 0 ? totalLeftPumpAmount / pumpSessions : 0;
    const avgRightPumpAmount = pumpSessions > 0 ? totalRightPumpAmount / pumpSessions : 0;

    return {
      sleep: {
        totalSleepMinutes,
        avgNapMinutes,
        avgDailyNapMinutes,
        avgNightSleepMinutes,
        avgNightWakings,
        napLocations,
        nightLocations,
      },
      feeding: {
        totalFeeds,
        bottleFeeds: { count: bottleFeedCount, amounts: bottleAmounts, avgByType: bottleAvgByType },
        breastFeeds: {
          count: breastFeedCount,
          leftMinutes: leftBreastMinutes,
          rightMinutes: rightBreastMinutes,
          leftCount: leftBreastCount,
          rightCount: rightBreastCount,
          avgLeftMinutes: avgLeftBreastMinutes,
          avgRightMinutes: avgRightBreastMinutes,
        },
        solidsFeeds: { count: solidsFeedCount, amounts: solidsAmounts, avgByFood: solidsAvgByFood },
      },
      diaper: {
        totalChanges: totalDiaperChanges,
        wetCount,
        poopCount,
        avgWetPerDay,
        avgPoopPerDay,
        daysInRange,
      },
      other: {
        noteCount,
        milestoneCount,
        measurementCount,
        medicines,
      },
      pump: {
        pumpsPerDay,
        avgDurationMinutes: avgPumpDurationMinutes,
        avgLeftAmount: avgLeftPumpAmount,
        avgRightAmount: avgRightPumpAmount,
        unit: pumpUnit || 'oz',
      },
      bath: {
        totalBaths: bathCount,
        bathsPerWeek,
        soapShampooBathsPerWeek,
      },
    };
  }, [activities, dateRange, getNightPeriodDateKey, getCalendarDayKey]);

  // Sleep chart data for modals (per-day / per-night series)
  const sleepChartSeries = useMemo(() => {
    if (!activities.length || !dateRange.from || !dateRange.to) {
      return {
        avgNapDuration: [] as { date: string; label: string; value: number }[],
        dailyNapTotal: [] as { date: string; label: string; value: number }[],
        nightSleep: [] as { date: string; label: string; value: number }[],
        nightWakings: [] as { date: string; label: string; value: number }[],
      };
    }

    const startDate = new Date(dateRange.from);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.to);
    endDate.setHours(23, 59, 59, 999);

    // Generate list of valid night period keys for the selected date range
    const validNightKeys = new Set<string>();
    const validNapDayKeys = new Set<string>();
    const tempDate = new Date(startDate);
    while (tempDate <= endDate) {
      // For night sleep: the night KEY is the day before what's displayed
      const prevDate = new Date(tempDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const nightKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;
      validNightKeys.add(nightKey);

      // For naps: use the actual calendar day
      const napKey = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}-${String(tempDate.getDate()).padStart(2, '0')}`;
      validNapDayKeys.add(napKey);

      tempDate.setDate(tempDate.getDate() + 1);
    }

    const napDataByDay: Record<string, { totalMinutes: number; count: number }> = {};
    const napMinutesByDay: Record<string, number> = {};
    const nightSleepByNight: Record<string, { totalMinutes: number; sessions: number }> = {};

    activities.forEach((activity) => {
      if ('duration' in activity && 'startTime' in activity && 'type' in activity) {
        const activityType = (activity as any).type;
        if (activityType === 'NAP' || activityType === 'NIGHT_SLEEP') {
          const sleepActivity = activity as any;
          const startTime = new Date(sleepActivity.startTime);
          const endTime = sleepActivity.endTime ? new Date(sleepActivity.endTime) : null;

          if (!endTime) return;

          // Calculate full sleep duration
          const sleepMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));

          if (activityType === 'NAP') {
            // Get the calendar day key using timezone-aware helper
            const dayKey = getCalendarDayKey(sleepActivity.startTime);

            // Only include if this nap day is within our selected date range
            if (dayKey && validNapDayKeys.has(dayKey)) {
              // Track nap data for daily average calculation
              if (!napDataByDay[dayKey]) {
                napDataByDay[dayKey] = { totalMinutes: 0, count: 0 };
              }
              napDataByDay[dayKey].totalMinutes += sleepMinutes;
              napDataByDay[dayKey].count += 1;

              // Also track total for daily total series
              napMinutesByDay[dayKey] = (napMinutesByDay[dayKey] || 0) + sleepMinutes;
            }
          } else if (activityType === 'NIGHT_SLEEP') {
            // Get the night period key using timezone-aware helper
            const nightKey = getNightPeriodDateKey(sleepActivity.startTime);

            // Only include if this night period is within our selected date range
            if (nightKey && validNightKeys.has(nightKey)) {
              if (!nightSleepByNight[nightKey]) {
                nightSleepByNight[nightKey] = { totalMinutes: 0, sessions: 0 };
              }
              nightSleepByNight[nightKey].totalMinutes += sleepMinutes;
              nightSleepByNight[nightKey].sessions++;
            }
          }
        }
      }
    });

    // Calculate daily average nap duration (average duration per day, not per nap)
    const avgNapDurationSeries = Object.entries(napDataByDay)
      .map(([date, data]) => ({
        date,
        label: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: data.count > 0 ? Math.round(data.totalMinutes / data.count) : 0,
      }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    const dailyNapTotalSeries = Object.entries(napMinutesByDay)
      .map(([date, total]) => ({
        date,
        label: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: total,
      }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    // Calculate total night sleep duration per night period
    // Each night period (12PM day 1 to 11:59AM day 2) may have multiple sleep sessions
    // The label should be for the NEXT day (the day the user selected)
    const nightSleepSeries: { date: string; label: string; value: number }[] = [];
    const nightWakingsSeries: { date: string; label: string; value: number }[] = [];

    Object.entries(nightSleepByNight).forEach(([nightKey, data]) => {
      // The nightKey is the evening date (e.g., 7/12), but we display it as the morning date (7/13)
      const displayDate = new Date(nightKey + 'T12:00:00');
      displayDate.setDate(displayDate.getDate() + 1);
      const label = displayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      // For night sleep, show total duration (not average per session)
      nightSleepSeries.push({
        date: nightKey,
        label,
        value: data.totalMinutes,
      });
      nightWakingsSeries.push({
        date: nightKey,
        label,
        value: Math.max(0, data.sessions - 1),
      });
    });

    nightSleepSeries.sort((a, b) => (a.date < b.date ? -1 : 1));
    nightWakingsSeries.sort((a, b) => (a.date < b.date ? -1 : 1));

    return {
      avgNapDuration: avgNapDurationSeries,
      dailyNapTotal: dailyNapTotalSeries,
      nightSleep: nightSleepSeries,
      nightWakings: nightWakingsSeries,
    };
  }, [activities, dateRange, getNightPeriodDateKey, getCalendarDayKey]);

  // Baby current age in months for chart ranges (birth to current age + 1 month, clamped)
  const babyCurrentAgeMonths = useMemo((): number => {
    if (!selectedBaby?.birthDate) return 12; // default to 12 months if no birthdate

    const now = new Date();
    const birth = new Date(selectedBaby.birthDate);

    const years = now.getFullYear() - birth.getFullYear();
    const months = now.getMonth() - birth.getMonth();
    const days = now.getDate() - birth.getDate();

    let totalMonths = years * 12 + months;
    if (days < 0) {
      totalMonths -= 1;
    }

    const ageWithBuffer = Math.ceil(totalMonths + 1);

    return Math.max(3, Math.min(36, ageWithBuffer));
  }, [selectedBaby]);

  // Fetch all temperature measurements for the baby (ignores date range filter)
  useEffect(() => {
    const fetchTemperatures = async () => {
      if (!selectedBaby) {
        setTemperatureMeasurements([]);
        return;
      }

      try {
        const authToken = localStorage.getItem('authToken');
        const response = await fetch(
          `/api/measurement-log?babyId=${selectedBaby.id}&type=TEMPERATURE`,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authToken ? `Bearer ${authToken}` : '',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setTemperatureMeasurements((data.data || []) as MeasurementActivity[]);
          } else {
            setTemperatureMeasurements([]);
          }
        } else {
          setTemperatureMeasurements([]);
        }
      } catch {
        setTemperatureMeasurements([]);
      }
    };

    fetchTemperatures();
  }, [selectedBaby]);

  // Temperature measurements for chart
  const temperatureData = useMemo(() => {
    if (!selectedBaby?.birthDate) return [];

    const birthStr = selectedBaby.birthDate!.toString();

    return temperatureMeasurements
      .map((m) => {
        const ageMonths = calculateAgeInMonths(birthStr, m.date);
        return {
          ageMonths,
          value: m.value,
          unit: m.unit,
        };
      })
      .filter((point) => point.ageMonths >= 0 && point.ageMonths <= babyCurrentAgeMonths)
      .sort((a, b) => a.ageMonths - b.ageMonths);
  }, [temperatureMeasurements, selectedBaby, babyCurrentAgeMonths]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn(styles.loadingContainer, "reports-loading-container")}>
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        <p className={cn(styles.loadingText, "reports-loading-text")}>Loading statistics...</p>
      </div>
    );
  }

  // Empty state
  if (!activities.length) {
    return (
      <div className={cn(styles.emptyContainer, "reports-empty-container")}>
        <p className={cn(styles.emptyText, "reports-empty-text")}>
          No activities found for the selected date range.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Accordion type="multiple" defaultValue={['sleep', 'feeding', 'diaper', 'pumping', 'baths', 'temperature']}>
        {/* Sleep Section */}
        <SleepStatsSection
          stats={stats.sleep}
          sleepChartSeries={sleepChartSeries}
          dateRange={dateRange}
          activities={activities}
        />

        {/* Feeding Section */}
        <FeedingStatsSection stats={stats.feeding} activities={activities} dateRange={dateRange} />

        {/* Diaper Section */}
        <DiaperStatsSection stats={stats.diaper} activities={activities} dateRange={dateRange} />

        {/* Pumping Section */}
        <PumpingStatsSection stats={stats.pump} activities={activities} dateRange={dateRange} />

        {/* Baths Section */}
        <BathStatsSection stats={stats.bath} activities={activities} dateRange={dateRange} />

        {/* Temperature Section */}
        <TemperatureStatsSection
          temperatureData={temperatureData}
          babyCurrentAgeMonths={babyCurrentAgeMonths}
        />
      </Accordion>
    </div>
  );
};

export default StatsTab;
