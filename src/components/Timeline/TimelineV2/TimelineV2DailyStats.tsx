import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  PillBottle,
  Activity,
  Icon
} from 'lucide-react';
import { diaper, bottleBaby } from '@lucide/lab';
import { Button } from '@/src/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/src/components/ui/popover';
import { Calendar as CalendarComponent } from '@/src/components/ui/calendar';
import { Card } from '@/src/components/ui/card';
import { FilterType } from '../types';
import { ActivityType } from '../types';

interface TimelineV2DailyStatsProps {
  activities: ActivityType[];
  date: Date;
  isLoading?: boolean;
  activeFilter: FilterType;
  onDateChange: (days: number) => void;
  onDateSelection: (date: Date) => void;
  onFilterChange: (filter: FilterType) => void;
}

const TimelineV2DailyStats: React.FC<TimelineV2DailyStatsProps> = ({ 
  activities, 
  date, 
  isLoading = false,
  activeFilter,
  onDateChange,
  onDateSelection,
  onFilterChange
}) => {
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Helper function to format minutes into hours and minutes
  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Calculate stats
  const stats = useMemo(() => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    let totalSleepMinutes = 0;
    let diaperCount = 0;
    let feedCount = 0;
    let medicineCount = 0;
    let activityCount = 0;

    activities.forEach(activity => {
      // Sleep activities
      if ('duration' in activity && 'startTime' in activity) {
        const startTime = new Date(activity.startTime);
        const endTime = 'endTime' in activity && activity.endTime ? new Date(activity.endTime) : null;
        
        if (endTime) {
          // Calculate overlap with the current day
          const overlapStart = Math.max(startTime.getTime(), startOfDay.getTime());
          const overlapEnd = Math.min(endTime.getTime(), endOfDay.getTime());
          
          // If there is an overlap, add to sleep time
          if (overlapEnd > overlapStart) {
            const overlapMinutes = Math.floor((overlapEnd - overlapStart) / (1000 * 60));
            totalSleepMinutes += overlapMinutes;
          }
        }
      }
      
      // Feed activities - count bottle and breast feeds, not solids
      if ('amount' in activity && 'type' in activity) {
        const time = new Date(activity.time);
        if (time >= startOfDay && time <= endOfDay) {
          if (activity.type === 'BOTTLE' || activity.type === 'BREAST') {
            feedCount++;
          }
        }
      }
      
      // Diaper activities
      if ('condition' in activity) {
        const time = new Date(activity.time);
        if (time >= startOfDay && time <= endOfDay) {
          diaperCount++;
        }
      }
      
      // Medicine activities
      if ('doseAmount' in activity && 'medicineId' in activity) {
        const time = new Date(activity.time);
        if (time >= startOfDay && time <= endOfDay) {
          medicineCount++;
        }
      }
      
      // Count all activities for the day
      let activityTime: Date | null = null;
      if ('time' in activity && activity.time) {
        activityTime = new Date(activity.time);
      } else if ('startTime' in activity && activity.startTime) {
        activityTime = new Date(activity.startTime);
      } else if ('date' in activity && activity.date) {
        activityTime = new Date(activity.date);
      }
      
      if (activityTime && activityTime >= startOfDay && activityTime <= endOfDay) {
        activityCount++;
      }
    });

    // Calculate awake time (24 hours - sleep time)
    const awakeMinutes = (24 * 60) - totalSleepMinutes;

    return {
      sleepTime: formatMinutes(totalSleepMinutes),
      feedCount: feedCount.toString(),
      diaperCount: diaperCount.toString(),
      medicineCount: medicineCount > 0 ? `${medicineCount}x` : '0x',
      awakeTime: formatMinutes(awakeMinutes),
      activityCount: activityCount.toString(),
    };
  }, [activities, date]);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Card className="overflow-hidden border-0 border-b border-gray-200 bg-white">
      <div className="p-5">
        {/* Date Navigation Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3 border border-gray-300 rounded-lg p-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDateChange(-1)}
              className="h-8 w-8 text-gray-700 hover:bg-gray-100"
              aria-label="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-8 px-3 text-sm font-medium text-gray-800 hover:bg-gray-100 min-w-[140px]"
                >
                  {formatDate(date)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-auto" align="start">
                <CalendarComponent
                  selected={date}
                  onSelect={(selectedDate) => {
                    if (selectedDate) {
                      selectedDate.setHours(0, 0, 0, 0);
                      onDateSelection(selectedDate);
                      setCalendarOpen(false);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDateChange(1)}
              className="h-8 w-8 text-gray-700 hover:bg-gray-100"
              aria-label="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Daily Summary Title */}
        <div className="text-sm font-medium text-gray-600 mb-3">Daily Summary</div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Sleep Stat */}
          <button
            onClick={() => onFilterChange(activeFilter === 'sleep' ? null : 'sleep')}
            className={`bg-gray-50 p-3.5 rounded-xl text-center border transition-all cursor-pointer ${
              activeFilter === 'sleep' 
                ? 'border-gray-500 bg-gray-100 shadow-sm' 
                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-center mb-1.5">
              <div className="bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 p-2 rounded-lg">
                <Moon className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="text-lg font-bold text-gray-800 mb-0.5">{stats.sleepTime}</div>
            <div className="text-xs text-gray-600 font-medium">Total Sleep</div>
          </button>

          {/* Feed Stat */}
          <button
            onClick={() => onFilterChange(activeFilter === 'feed' ? null : 'feed')}
            className={`bg-gray-50 p-3.5 rounded-xl text-center border transition-all cursor-pointer ${
              activeFilter === 'feed' 
                ? 'border-sky-500 bg-sky-50 shadow-sm' 
                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-center mb-1.5">
              <div className="bg-sky-200 p-2 rounded-lg">
                <Icon iconNode={bottleBaby} className="h-5 w-5 text-gray-700" />
              </div>
            </div>
            <div className="text-lg font-bold text-gray-800 mb-0.5">{stats.feedCount}</div>
            <div className="text-xs text-gray-600 font-medium">Feeds</div>
          </button>

          {/* Diaper Stat */}
          <button
            onClick={() => onFilterChange(activeFilter === 'diaper' ? null : 'diaper')}
            className={`bg-gray-50 p-3.5 rounded-xl text-center border transition-all cursor-pointer ${
              activeFilter === 'diaper' 
                ? 'border-teal-500 bg-teal-50 shadow-sm' 
                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-center mb-1.5">
              <div className="bg-gradient-to-r from-teal-600 to-teal-700 p-2 rounded-lg">
                <Icon iconNode={diaper} className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="text-lg font-bold text-gray-800 mb-0.5">{stats.diaperCount}</div>
            <div className="text-xs text-gray-600 font-medium">Diapers</div>
          </button>

          {/* Medicine Stat */}
          <button
            onClick={() => onFilterChange(activeFilter === 'medicine' ? null : 'medicine')}
            className={`bg-gray-50 p-3.5 rounded-xl text-center border transition-all cursor-pointer ${
              activeFilter === 'medicine' 
                ? 'border-green-500 bg-green-50 shadow-sm' 
                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-center mb-1.5">
              <div className="bg-[#43B755] p-2 rounded-lg">
                <PillBottle className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="text-lg font-bold text-gray-800 mb-0.5">{stats.medicineCount}</div>
            <div className="text-xs text-gray-600 font-medium">Medicine</div>
          </button>

          {/* Awake Time Stat */}
          <button
            onClick={() => onFilterChange(null)}
            className={`bg-gray-50 p-3.5 rounded-xl text-center border transition-all cursor-pointer ${
              activeFilter === null 
                ? 'border-amber-500 bg-amber-50 shadow-sm' 
                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-center mb-1.5">
              <div className="bg-amber-100 p-2 rounded-lg">
                <Sun className="h-5 w-5 text-amber-600" />
              </div>
            </div>
            <div className="text-lg font-bold text-gray-800 mb-0.5">{stats.awakeTime}</div>
            <div className="text-xs text-gray-600 font-medium">Awake Time</div>
          </button>

          {/* Activities Stat */}
          <button
            onClick={() => onFilterChange(null)}
            className={`bg-gray-50 p-3.5 rounded-xl text-center border transition-all cursor-pointer ${
              activeFilter === null 
                ? 'border-gray-500 bg-gray-100 shadow-sm' 
                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-center mb-1.5">
              <div className="bg-gray-200 p-2 rounded-lg">
                <Activity className="h-5 w-5 text-gray-700" />
              </div>
            </div>
            <div className="text-lg font-bold text-gray-800 mb-0.5">{stats.activityCount}</div>
            <div className="text-xs text-gray-600 font-medium">Activities</div>
          </button>
        </div>
      </div>
    </Card>
  );
};

export default TimelineV2DailyStats;

