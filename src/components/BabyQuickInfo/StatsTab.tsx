import React, { useState, useEffect } from 'react';
import { cn } from '@/src/lib/utils';
import { styles } from './baby-quick-info.styles';
import { StatsTabProps } from './baby-quick-info.types';
import { 
  Moon, 
  Sun, 
  Utensils, 
  Droplet, 
  StickyNote, 
  Bath,
  Loader2
} from 'lucide-react';
import { diaper, bottleBaby } from '@lucide/lab';
import { Icon } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Label } from '@/src/components/ui/label';
import CardVisual from '@/src/components/reporting/CardVisual';

/**
 * StatsTab Component
 * 
 * Displays quick stats for a baby, reusing functionality from the original BabyQuickStats component
 */
const StatsTab: React.FC<StatsTabProps> = ({
  activities: initialActivities = [],
  selectedBaby,
  calculateAge
}) => {
  // State for time period selection
  const [mainPeriod, setMainPeriod] = useState<'2day' | '7day' | '14day' | '30day'>('7day');
  const [comparePeriod, setComparePeriod] = useState<'2day' | '7day' | '14day' | '30day'>('14day');
  
  // State for activities data
  const [activities, setActivities] = useState<any[]>(initialActivities);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch activities for the selected baby
  useEffect(() => {
    if (!selectedBaby) return;
    
    const fetchActivities = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Calculate date range for the largest period (30 days)
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30); // 30 days back
        
        // Format dates for API request
        const startDate = start.toISOString();
        const endDate = end.toISOString();
        
        // Add timestamp to prevent caching
        const timestamp = new Date().getTime();
        
        // Make API call to get activities for the baby using the timeline endpoint
        const url = `/api/timeline?babyId=${selectedBaby.id}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&_t=${timestamp}`;
        
        console.log(`Fetching activities from: ${url}`);
        
        const response = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Expires': '0'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setActivities(data.data || []);
            console.log(`Fetched ${data.data?.length || 0} activities for baby ${selectedBaby.firstName}`);
          } else {
            setActivities([]);
            setError(data.message || 'Failed to fetch activities');
          }
        } else {
          setActivities([]);
          setError('Failed to fetch activities');
        }
      } catch (err) {
        console.error('Error fetching activities:', err);
        setActivities([]);
        setError('Error fetching activities');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchActivities();
  }, [selectedBaby]);

  // Helper function to format minutes into hours and minutes
  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Calculate date ranges based on selected periods
  const getDateRangeForPeriod = (period: '2day' | '7day' | '14day' | '30day'): { start: Date, end: Date } => {
    const end = new Date();
    const start = new Date();
    
    switch (period) {
      case '2day':
        start.setDate(start.getDate() - 1);
        break;
      case '7day':
        start.setDate(start.getDate() - 6);
        break;
      case '14day':
        start.setDate(start.getDate() - 13);
        break;
      case '30day':
        start.setDate(start.getDate() - 29);
        break;
    }
    
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
  };

  // Filter activities by date range and baby ID
  const filterActivities = (period: '2day' | '7day' | '14day' | '30day') => {
    if (!selectedBaby || !activities.length) return [];
    
    const { start, end } = getDateRangeForPeriod(period);
    
    return activities.filter(activity => {
      // Check if activity belongs to selected baby
      if ('babyId' in activity && activity.babyId !== selectedBaby.id) {
        return false;
      }
      
      // Get activity time
      const time = 'time' in activity ? new Date(activity.time) : 
                  'startTime' in activity ? new Date(activity.startTime) : null;
      
      if (!time) return false;
      
      // Check if activity is within date range
      return time >= start && time <= end;
    });
  };

  // Function to calculate all stats from activities
  function calculateStats(filteredActivities: any[], period: '2day' | '7day' | '14day' | '30day') {
    if (!filteredActivities.length) {
      return {
        avgWakeWindow: 0,
        avgNapTime: 0,
        avgNightSleepTime: 0,
        avgNightWakings: 0,
        avgFeedings: 0,
        avgFeedAmount: 0,
        avgDiaperChanges: 0,
        avgPoops: 0
      };
    }

    // Get number of days in period
    const daysInPeriod = period === '2day' ? 2 : 
                         period === '7day' ? 7 : 
                         period === '14day' ? 14 : 30;

    // Calculate wake windows
    let totalWakeMinutes = 0;
    let wakeWindowCount = 0;

    // Calculate nap time
    let totalNapMinutes = 0;
    let napCount = 0;

    // Count night wakings and calculate night sleep time
    let nightWakings = 0;
    
    // Track which nights we've already counted to avoid duplicates
    // Store total sleep minutes for each night
    const nightSleepByNight: Record<string, number> = {};

    // Count feedings
    let feedingCount = 0;
    let totalFeedAmount = 0;
    let feedAmountCount = 0;
    const feedUnits: Record<string, number> = {};

    // Count diapers
    let diaperCount = 0;
    let poopCount = 0;

    // Process sleep activities to calculate wake windows and nap time
    const sleepActivities = filteredActivities.filter(a => 'duration' in a && 'startTime' in a && 'endTime' in a && a.endTime);
    sleepActivities.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    
    // Calculate wake windows - time from end of sleep to start of next sleep
    for (let i = 0; i < sleepActivities.length - 1; i++) {
      const currentSleep = sleepActivities[i];
      const nextSleep = sleepActivities[i + 1];
      
      if (currentSleep.endTime && nextSleep.startTime) {
        const sleepEndTime = new Date(currentSleep.endTime).getTime();
        const nextSleepStartTime = new Date(nextSleep.startTime).getTime();
        
        // Calculate wake window in minutes
        const wakeWindowInMinutes = Math.floor((nextSleepStartTime - sleepEndTime) / (1000 * 60));
        
        // Only count valid wake windows (positive and reasonable duration)
        if (wakeWindowInMinutes > 0 && wakeWindowInMinutes < 24 * 60) { // Less than 24 hours
          totalWakeMinutes += wakeWindowInMinutes;
          wakeWindowCount++;
        }
      }
    }

    // Group activities by day
    const activitiesByDay: Record<string, any[]> = {};
    filteredActivities.forEach(activity => {
      const time = 'time' in activity ? new Date(activity.time) : 
                  'startTime' in activity ? new Date(activity.startTime) : null;
      
      if (!time) return;
      
      const dateStr = time.toISOString().split('T')[0];
      if (!activitiesByDay[dateStr]) {
        activitiesByDay[dateStr] = [];
      }
      activitiesByDay[dateStr].push(activity);
    });

    // Process each day's activities
    Object.values(activitiesByDay).forEach((dayActivities) => {
      // Count night wakings and calculate night sleep time (sleep activities between 7pm and 7am)
      const nightSleepEvents = dayActivities.filter(a => {
        if (!('startTime' in a)) return false;
        const startTime = new Date(a.startTime);
        const startHour = startTime.getHours();
        
        // Check if it's a night sleep (starts or ends between 7pm and 7am)
        const isNightByStart = (startHour >= 19 || startHour < 7);
        
        // If we have an end time, also check that
        if ('endTime' in a && a.endTime) {
          const endTime = new Date(a.endTime);
          const endHour = endTime.getHours();
          const isNightByEnd = (endHour >= 19 || endHour < 7);
          
          return isNightByStart || isNightByEnd;
        }
        
        return isNightByStart;
      });
      
      // Process night sleep events to identify unique nights
      nightSleepEvents.forEach(a => {
        if (!('startTime' in a) || !('endTime' in a) || !a.endTime) return;
        
        const startTime = new Date(a.startTime);
        const startHour = startTime.getHours();
        const sleepDate = new Date(startTime);
        
        // Determine which night this sleep belongs to
        let nightKey;
        if (startHour >= 19) {
          // This is the start of tonight's sleep (after 7pm)
          nightKey = sleepDate.toISOString().split('T')[0] + '-night';
        } else if (startHour < 7) {
          // This is the end of last night's sleep (before 7am)
          // Move back one day to get the correct night
          sleepDate.setDate(sleepDate.getDate() - 1);
          nightKey = sleepDate.toISOString().split('T')[0] + '-night';
        } else {
          // This is a daytime nap, not night sleep
          return;
        }
        
        // Calculate sleep duration
        const startTimeMs = new Date(a.startTime).getTime();
        const endTimeMs = new Date(a.endTime).getTime();
        const sleepDurationMinutes = Math.round((endTimeMs - startTimeMs) / (1000 * 60));
        
        if (sleepDurationMinutes <= 0 || sleepDurationMinutes >= 12 * 60) {
          // Invalid sleep duration
          return;
        }
        
        // Add this sleep duration to the night's total
        if (!nightSleepByNight[nightKey]) {
          nightSleepByNight[nightKey] = 0;
          
          // Count night wakings for this night (only once per night)
          const wakingsForNight = Math.max(0, nightSleepEvents.length - 1);
          nightWakings += wakingsForNight;
        }
        
        // Add this sleep duration to the night's total
        nightSleepByNight[nightKey] += sleepDurationMinutes;
      });

      // Count feedings
      const feedingsForDay = dayActivities.filter(a => 
        ('type' in a && (a.type === 'BOTTLE' || a.type === 'BREAST' || a.type === 'SOLIDS'))
      ).length;
      
      feedingCount += feedingsForDay;

      // Calculate feed amounts
      dayActivities.forEach(a => {
        if ('amount' in a && a.amount && typeof a.amount === 'number') {
          totalFeedAmount += a.amount;
          feedAmountCount++;

          // Track units used in feeding logs
          if ('unitAbbr' in a && a.unitAbbr && typeof a.unitAbbr === 'string') {
            const unit = a.unitAbbr.toLowerCase();
            feedUnits[unit] = (feedUnits[unit] || 0) + 1;
          }
        }
      });

      // Count diapers and poops
      dayActivities.forEach(a => {
        if ('condition' in a) {
          diaperCount++;
          
          // Count poops (dirty or wet+dirty) - using the type property
          if (a.type === 'DIRTY' || a.type === 'BOTH') {
            poopCount++;
          }
        }
      });

      // Calculate nap time (sleep activities during the day)
      const napActivities = dayActivities.filter(a => {
        if (!('startTime' in a && 'endTime' in a)) return false;
        const time = new Date(a.startTime);
        const hour = time.getHours();
        return (hour >= 7 && hour < 19); // Day time is 7am to 7pm
      });
      
      napActivities.forEach(a => {
        if ('startTime' in a && 'endTime' in a && a.endTime) {
          const startTime = new Date(a.startTime).getTime();
          const endTime = new Date(a.endTime).getTime();
          const napDurationMinutes = Math.round((endTime - startTime) / (1000 * 60));
          
          if (napDurationMinutes > 0 && napDurationMinutes < 6 * 60) { // Less than 6 hours
            totalNapMinutes += napDurationMinutes;
            napCount++;
          }
        }
      });
    });

    // Calculate averages with proper rounding
    const avgWakeWindow = wakeWindowCount > 0 ? Math.round(totalWakeMinutes / wakeWindowCount) : 0;
    const avgNapTime = napCount > 0 ? Math.round(totalNapMinutes / napCount) : 0;
    
    // Calculate total night sleep time and average
    let totalNightSleepMinutes = 0;
    Object.values(nightSleepByNight).forEach(minutes => {
      totalNightSleepMinutes += minutes;
    });
    
    // Use the number of nights processed for night sleep calculations
    const nightsCount = Object.keys(nightSleepByNight).length;
    const avgNightSleepTime = nightsCount > 0 ? Math.round(totalNightSleepMinutes / nightsCount) : 0;
    const avgNightWakings = nightsCount > 0 ? Math.round(nightWakings / nightsCount * 10) / 10 : 0;
    // Determine the most common unit used
    const mostCommonUnit = Object.keys(feedUnits).length > 0
      ? Object.entries(feedUnits).reduce((a, b) => feedUnits[a[0]] > feedUnits[b[0]] ? a : b)[0]
      : 'oz';

    const avgFeedings = daysInPeriod > 0 ? Math.round(feedingCount / daysInPeriod * 10) / 10 : 0;
    const avgFeedAmount = feedAmountCount > 0 ? Math.round(totalFeedAmount / feedAmountCount * 10) / 10 : 0;
    const avgDiaperChanges = daysInPeriod > 0 ? Math.round(diaperCount / daysInPeriod * 10) / 10 : 0;
    const avgPoops = daysInPeriod > 0 ? Math.round(poopCount / daysInPeriod * 10) / 10 : 0;

    return {
      avgWakeWindow,
      avgNapTime,
      avgNightSleepTime,
      avgNightWakings,
      avgFeedings,
      avgFeedAmount,
      avgDiaperChanges,
      avgPoops,
      feedUnit: mostCommonUnit
    };
  }

  // Calculate stats for the selected time periods
  const mainStats = calculateStats(filterActivities(mainPeriod), mainPeriod);
  const compareStats = calculateStats(filterActivities(comparePeriod), comparePeriod);

  // Format period label
  const formatPeriodLabel = (period: '2day' | '7day' | '14day' | '30day'): string => {
    switch (period) {
      case '2day': return '2 Days';
      case '7day': return '7 Days';
      case '14day': return '14 Days';
      case '30day': return '30 Days';
    }
  };

  return (
    <div className={cn(styles.statsContainer, "baby-quick-info-stats-container")}>
      {/* Time period selectors */}
      <div className="space-y-2">
        <div>
          <Label className="text-xs text-gray-500 dark:text-gray-400">Main Period:</Label>
          <div className="flex space-x-1 overflow-x-auto">
            {(['2day', '7day', '14day', '30day'] as const).map((period) => (
              <Button
                key={`main-${period}`}
                variant={mainPeriod === period ? 'default' : 'outline'}
                className="flex-1 px-2 py-1 h-auto text-sm"
                onClick={() => setMainPeriod(period)}
              >
                {formatPeriodLabel(period)}
              </Button>
            ))}
          </div>
        </div>
        
        <div>
          <Label className="text-xs text-gray-500 dark:text-gray-400">Compare Period:</Label>
          <div className="flex space-x-1 overflow-x-auto">
            {(['2day', '7day', '14day', '30day'] as const).map((period) => (
              <Button
                key={`compare-${period}`}
                variant={comparePeriod === period ? 'default' : 'outline'}
                className="flex-1 px-2 py-1 h-auto text-sm"
                onClick={() => setComparePeriod(period)}
              >
                {formatPeriodLabel(period)}
              </Button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Stats cards */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600 mb-2" />
          <p className="text-gray-600">Loading statistics...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-8">
          <p className="text-red-500 mb-2">{error}</p>
          <p className="text-gray-600">Unable to load statistics. Please try again later.</p>
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <p className="text-gray-600">No activities found for the selected time period.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 mt-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <CardVisual
            title="Avg Wake Window"
            mainValue={formatMinutes(mainStats.avgWakeWindow)}
            comparativeValue={formatMinutes(compareStats.avgWakeWindow)}
            trend={mainStats.avgWakeWindow >= compareStats.avgWakeWindow ? 'positive' : 'negative'}
          />
          
          <CardVisual
            title="Avg Nap Time"
            mainValue={formatMinutes(mainStats.avgNapTime)}
            comparativeValue={formatMinutes(compareStats.avgNapTime)}
            trend={mainStats.avgNapTime >= compareStats.avgNapTime ? 'positive' : 'negative'}
          />
          
          <CardVisual
            title="Avg Night Sleep"
            mainValue={formatMinutes(mainStats.avgNightSleepTime)}
            comparativeValue={formatMinutes(compareStats.avgNightSleepTime)}
            trend={mainStats.avgNightSleepTime >= compareStats.avgNightSleepTime ? 'positive' : 'negative'}
          />
          
          <CardVisual
            title="Avg Night Wakings"
            mainValue={mainStats.avgNightWakings.toFixed(1)}
            comparativeValue={compareStats.avgNightWakings.toFixed(1)}
            trend={mainStats.avgNightWakings <= compareStats.avgNightWakings ? 'positive' : 'negative'}
          />
          
          <CardVisual
            title="Avg Feedings"
            mainValue={mainStats.avgFeedings.toFixed(1)}
            comparativeValue={compareStats.avgFeedings.toFixed(1)}
            trend="neutral"
          />
          
          <CardVisual
            title="Avg Feed Amount"
            mainValue={mainStats.avgFeedAmount.toFixed(1) + ' ' + mainStats.feedUnit}
            comparativeValue={compareStats.avgFeedAmount.toFixed(1) + ' ' + compareStats.feedUnit}
            trend={mainStats.avgFeedAmount >= compareStats.avgFeedAmount ? 'positive' : 'negative'}
          />
          
          <CardVisual
            title="Avg Diaper Changes"
            mainValue={mainStats.avgDiaperChanges.toFixed(1)}
            comparativeValue={compareStats.avgDiaperChanges.toFixed(1)}
            trend="neutral"
          />
          
          <CardVisual
            title="Avg Poops"
            mainValue={mainStats.avgPoops.toFixed(1)}
            comparativeValue={compareStats.avgPoops.toFixed(1)}
            trend="neutral"
          />
        </div>
      )}
    </div>
  );
};

export default StatsTab;
