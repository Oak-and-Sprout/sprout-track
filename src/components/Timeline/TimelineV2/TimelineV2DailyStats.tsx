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
import { Card } from '@/src/components/ui/card';
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
        iconColor: 'text-gray-600',
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
        iconColor: 'text-sky-600',
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
        iconColor: 'text-teal-600',
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
        iconColor: 'text-green-600',
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
        iconColor: 'text-yellow-600',
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
        iconColor: 'text-orange-600',
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
        iconColor: 'text-purple-600',
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
        iconColor: 'text-blue-600',
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
        iconColor: 'text-red-600',
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
    <Card className="overflow-hidden border-0 bg-white timeline-v2-daily-stats relative z-10 shadow-none hover:shadow-none">
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
                className={`relative bg-gray-50 w-24 h-24 rounded-xl text-left border transition-all overflow-hidden shadow-sm ${
                  // Never show awake time tile as selected, only show selected state for filterable tiles
                  tile.filter !== null && activeFilter === tile.filter
                    ? 'border-2 border-gray-500 bg-gray-100 shadow-md cursor-pointer' 
                    : tile.filter !== null
                    ? 'border border-gray-200 hover:border-gray-300 hover:shadow-md cursor-pointer'
                    : 'border border-gray-200 cursor-default'
                }`}
              >
                {/* Icon in top right, taking up 75% of tile size */}
                <div className="absolute top-0 right-0 w-[75%] h-[75%] flex items-start justify-end p-2">
                  <div className={tile.iconColor}>
                    {tile.icon}
                  </div>
                </div>
                
                {/* Content */}
                <div className="relative z-10 p-2.5 h-full flex flex-col justify-end">
                  <div className="text-base font-bold text-gray-800 mb-0.5 leading-tight">{tile.value}</div>
                  <div className="text-xs text-gray-600 font-medium leading-tight">{tile.label}</div>
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
    </Card>
  );
};

export default TimelineV2DailyStats;
