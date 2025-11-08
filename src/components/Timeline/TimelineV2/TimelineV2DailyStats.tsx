import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  PillBottle,
  Edit,
  Bath,
  LampWallDown,
  Trophy,
  Ruler,
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
import { FilterType } from '../types';
import { ActivityType } from '../types';
import './TimelineV2DailyStats.css';

interface TimelineV2DailyStatsProps {
  activities: ActivityType[];
  date: Date;
  isLoading?: boolean;
  activeFilter: FilterType;
  onDateChange: (days: number) => void;
  onDateSelection: (date: Date) => void;
  onFilterChange: (filter: FilterType) => void;
}

interface StatTile {
  filter: FilterType;
  label: string;
  value: string;
  icon: React.ReactNode;
  bgColor: string;
  iconColor: string;
  borderColor: string;
  bgActiveColor: string;
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

  // Calculate stats and create dynamic tiles
  const statTiles = useMemo(() => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    let totalSleepMinutes = 0;
    let diaperCount = 0;
    let feedCount = 0;
    let medicineCount = 0;
    let noteCount = 0;
    let bathCount = 0;
    let pumpCount = 0;
    let milestoneCount = 0;
    let measurementCount = 0;
    let awakeMinutes = 0;

    activities.forEach(activity => {
      // Sleep activities
      if ('duration' in activity && 'startTime' in activity) {
        const startTime = new Date(activity.startTime);
        const endTime = 'endTime' in activity && activity.endTime ? new Date(activity.endTime) : null;
        
        if (endTime) {
          const overlapStart = Math.max(startTime.getTime(), startOfDay.getTime());
          const overlapEnd = Math.min(endTime.getTime(), endOfDay.getTime());
          
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
      
      // Note activities
      if ('content' in activity) {
        const time = new Date(activity.time);
        if (time >= startOfDay && time <= endOfDay) {
          noteCount++;
        }
      }
      
      // Bath activities
      if ('soapUsed' in activity) {
        const time = new Date(activity.time);
        if (time >= startOfDay && time <= endOfDay) {
          bathCount++;
        }
      }
      
      // Pump activities
      if ('leftAmount' in activity || 'rightAmount' in activity) {
        let time: Date | null = null;
        if ('startTime' in activity && activity.startTime) {
          time = new Date(activity.startTime);
        } else if ('time' in activity && activity.time) {
          time = new Date(activity.time);
        }
        if (time && time >= startOfDay && time <= endOfDay) {
          pumpCount++;
        }
      }
      
      // Milestone activities
      if ('title' in activity && 'category' in activity) {
        const activityDate = new Date(activity.date);
        if (activityDate >= startOfDay && activityDate <= endOfDay) {
          milestoneCount++;
        }
      }
      
      // Measurement activities
      if ('value' in activity && 'unit' in activity) {
        const activityDate = new Date(activity.date);
        if (activityDate >= startOfDay && activityDate <= endOfDay) {
          measurementCount++;
        }
      }
    });

    // Calculate awake time (24 hours - sleep time)
    awakeMinutes = (24 * 60) - totalSleepMinutes;

    const tiles: StatTile[] = [];

    // Awake Time tile - always first
    if (awakeMinutes > 0) {
      tiles.push({
        filter: null,
        label: 'Awake Time',
        value: formatMinutes(awakeMinutes),
        icon: <Sun className="h-full w-full" />,
        bgColor: 'bg-gray-50',
        iconColor: 'text-amber-600',
        borderColor: 'border-gray-500',
        bgActiveColor: 'bg-gray-100'
      });
    }

    // Sleep tile
    if (totalSleepMinutes > 0) {
      tiles.push({
        filter: 'sleep',
        label: 'Total Sleep',
        value: formatMinutes(totalSleepMinutes),
        icon: <Moon className="h-full w-full" />,
        bgColor: 'bg-gray-50',
        iconColor: 'text-[#9ca3af]', // gray-400 - matches timeline
        borderColor: 'border-gray-500',
        bgActiveColor: 'bg-gray-100'
      });
    }

    // Feed tile
    if (feedCount > 0) {
      tiles.push({
        filter: 'feed',
        label: 'Feeds',
        value: feedCount.toString(),
        icon: <Icon iconNode={bottleBaby} className="h-full w-full" />,
        bgColor: 'bg-gray-50',
        iconColor: 'text-[#7dd3fc]', // sky-300 - matches timeline
        borderColor: 'border-gray-500',
        bgActiveColor: 'bg-gray-100'
      });
    }

    // Diaper tile
    if (diaperCount > 0) {
      tiles.push({
        filter: 'diaper',
        label: 'Diapers',
        value: diaperCount.toString(),
        icon: <Icon iconNode={diaper} className="h-full w-full" />,
        bgColor: 'bg-gray-50',
        iconColor: 'text-[#0d9488]', // teal-600 - matches timeline
        borderColor: 'border-gray-500',
        bgActiveColor: 'bg-gray-100'
      });
    }

    // Medicine tile
    if (medicineCount > 0) {
      tiles.push({
        filter: 'medicine',
        label: 'Medicine',
        value: `${medicineCount}x`,
        icon: <PillBottle className="h-full w-full" />,
        bgColor: 'bg-gray-50',
        iconColor: 'text-[#43B755]', // green - matches timeline
        borderColor: 'border-gray-500',
        bgActiveColor: 'bg-gray-100'
      });
    }

    // Note tile
    if (noteCount > 0) {
      tiles.push({
        filter: 'note',
        label: 'Notes',
        value: noteCount.toString(),
        icon: <Edit className="h-full w-full" />,
        bgColor: 'bg-gray-50',
        iconColor: 'text-[#fef08a]', // yellow-200 - matches timeline
        borderColor: 'border-gray-500',
        bgActiveColor: 'bg-gray-100'
      });
    }

    // Bath tile
    if (bathCount > 0) {
      tiles.push({
        filter: 'bath',
        label: 'Baths',
        value: bathCount.toString(),
        icon: <Bath className="h-full w-full" />,
        bgColor: 'bg-gray-50',
        iconColor: 'text-[#fb923c]', // orange-400 - matches timeline
        borderColor: 'border-gray-500',
        bgActiveColor: 'bg-gray-100'
      });
    }

    // Pump tile
    if (pumpCount > 0) {
      tiles.push({
        filter: 'pump',
        label: 'Pump',
        value: pumpCount.toString(),
        icon: <LampWallDown className="h-full w-full" />,
        bgColor: 'bg-gray-50',
        iconColor: 'text-[#c084fc]', // purple-400 - matches timeline
        borderColor: 'border-gray-500',
        bgActiveColor: 'bg-gray-100'
      });
    }

    // Milestone tile
    if (milestoneCount > 0) {
      tiles.push({
        filter: 'milestone',
        label: 'Milestones',
        value: milestoneCount.toString(),
        icon: <Trophy className="h-full w-full" />,
        bgColor: 'bg-gray-50',
        iconColor: 'text-[#4875EC]', // blue - matches timeline
        borderColor: 'border-gray-500',
        bgActiveColor: 'bg-gray-100'
      });
    }

    // Measurement tile
    if (measurementCount > 0) {
      tiles.push({
        filter: 'measurement',
        label: 'Measurements',
        value: measurementCount.toString(),
        icon: <Ruler className="h-full w-full" />,
        bgColor: 'bg-gray-50',
        iconColor: 'text-[#EA6A5E]', // red - matches timeline
        borderColor: 'border-gray-500',
        bgActiveColor: 'bg-gray-100'
      });
    }

    return tiles;
  }, [activities, date]);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="overflow-hidden border-0 bg-white timeline-v2-daily-stats relative z-10">
      <div className="p-5 relative z-10">
        {/* Date Navigation Header */}
        <div className="flex items-center justify-center mb-5">
          <div className="flex items-center gap-3">
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
        {statTiles.length > 0 ? (
          <div className="flex flex-wrap gap-2.5">
            {statTiles.map((tile) => (
              <button
                key={tile.filter || 'awake'}
                onClick={() => {
                  // Only allow filtering if it's not the awake time tile
                  if (tile.filter !== null) {
                    onFilterChange(tile.filter === activeFilter ? null : tile.filter);
                  }
                }}
                className={`relative rounded-xl text-left transition-all duration-200 overflow-hidden ${
                  // Never show awake time tile as selected, only show selected state for filterable tiles
                  tile.filter !== null && activeFilter === tile.filter
                    ? 'bg-gray-100 cursor-pointer scale-105' 
                    : tile.filter !== null
                    ? 'bg-transparent cursor-pointer'
                    : 'bg-transparent cursor-default'
                }`}
              >
                {/* Horizontal layout: icon left, text right */}
                <div className="flex items-center gap-2.5 px-3 py-2">
                  {/* Icon */}
                  <div className={`flex-shrink-0 ${tile.iconColor}`}>
                    <div className="w-5 h-5">
                      {tile.icon}
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex flex-col min-w-0">
                    <div className="text-base font-bold text-gray-800 leading-tight">{tile.value}</div>
                    <div className="text-xs text-gray-600 font-medium leading-tight">{tile.label}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500 text-center py-4">
            No activities recorded for this day
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelineV2DailyStats;
