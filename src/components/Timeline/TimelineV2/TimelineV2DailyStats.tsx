import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Moon,
  Sun,
  PillBottle,
  Edit,
  Bath,
  LampWallDown,
  Trophy,
  Ruler,
  Icon,
  Eye,
  EyeOff
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
import TimelineV2Heatmap from './TimelineV2Heatmap';
import { useLocalization } from '@/src/context/localization';

import './TimelineV2DailyStats.css';

interface TimelineV2DailyStatsProps {
  activities: ActivityType[];
  heatmapActivities: ActivityType[];
  date: Date;
  isLoading?: boolean;
  activeFilter: FilterType;
  onDateChange: (days: number) => void;
  onDateSelection: (date: Date) => void;
  onFilterChange: (filter: FilterType) => void;
   isHeatmapVisible: boolean;
   onHeatmapToggle: () => void;
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
  heatmapActivities,
  date, 
  isLoading = false,
  activeFilter,
  onDateChange,
  onDateSelection,
  onFilterChange,
  isHeatmapVisible,
  onHeatmapToggle
}) => {
  const { t } = useLocalization();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Helper function to format minutes into hours and minutes
  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}${t('min')}`;
  };

  // Calculate stats and create dynamic tiles
  const statTiles = useMemo(() => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    let totalSleepMinutes = 0;
    let wetCount = 0;
    let dirtyCount = 0;
    let poopCount = 0;
    let totalFeedCount = 0;
    const bottleFeedAmounts: Record<string, number> = {};
    let leftBreastFeedMinutes = 0;
    let rightBreastFeedMinutes = 0;
    const solidsAmounts: Record<string, number> = {};
    const medicineStats: Record<string, { count: number, total: number, unit: string }> = {};
    let noteCount = 0;
    let bathCount = 0;
    let pumpCount = 0;
    let milestoneCount = 0;
    let measurementCount = 0;
    let awakeMinutes = 0;

    activities.forEach(activity => {
      // Sleep activities (exclude pump activities which also have duration and startTime)
      if ('duration' in activity && 'startTime' in activity && 
          'type' in activity && // Sleep activities have type (NAP or NIGHT_SLEEP)
          !('leftAmount' in activity || 'rightAmount' in activity)) { // Exclude pump activities
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
      
      // Feed activities - track all types together
      if ('amount' in activity && 'type' in activity) {
        const time = new Date(activity.time);
        if (time >= startOfDay && time <= endOfDay) {
          if (activity.type === 'BOTTLE') {
            totalFeedCount++;
            // Track bottle feed amounts by unit
            const unit = activity.unitAbbr || 'oz';
            if (!bottleFeedAmounts[unit]) {
              bottleFeedAmounts[unit] = 0;
            }
            bottleFeedAmounts[unit] += activity.amount || 0;
          } else if (activity.type === 'SOLIDS') {
            totalFeedCount++;
            // Track solids amounts by unit
            const unit = activity.unitAbbr || 'g';
            if (!solidsAmounts[unit]) {
              solidsAmounts[unit] = 0;
            }
            solidsAmounts[unit] += activity.amount || 0;
          }
        }
      }
      
      // Breast feed activities - track duration separately for left and right
      if ('type' in activity && activity.type === 'BREAST') {
        const time = new Date(activity.time);
        if (time >= startOfDay && time <= endOfDay) {
          totalFeedCount++;
          // Track duration: prefer feedDuration (in seconds), fall back to amount (in minutes)
          let feedMinutes = 0;
          if ('feedDuration' in activity && activity.feedDuration) {
            // Convert seconds to minutes
            feedMinutes = Math.floor(activity.feedDuration / 60);
          } else if ('amount' in activity && activity.amount) {
            // Amount is already in minutes for older records
            feedMinutes = activity.amount;
          }
          
          // Track by side if available
          if ('side' in activity && activity.side) {
            if (activity.side === 'LEFT') {
              leftBreastFeedMinutes += feedMinutes;
            } else if (activity.side === 'RIGHT') {
              rightBreastFeedMinutes += feedMinutes;
            }
          }
          // Note: If no side specified, we don't track it separately to avoid inaccuracy
          // The feed is still counted in totalFeedCount
        }
      }
      
      // Diaper activities
      if ('condition' in activity && 'type' in activity) {
        const time = new Date(activity.time);
        if (time >= startOfDay && time <= endOfDay) {
          // Count wet and dirty diapers exclusively
          if (activity.type === 'WET') {
            wetCount++;
          } else if (activity.type === 'DIRTY') {
            dirtyCount++;
            poopCount++;
          } else if (activity.type === 'BOTH') {
            // BOTH counts as both wet and dirty
            wetCount++;
            dirtyCount++;
            poopCount++;
          }
        }
      }
      
      // Medicine activities
      if ('doseAmount' in activity && 'medicineId' in activity) {
        const time = new Date(activity.time);
        if (time >= startOfDay && time <= endOfDay) {
          // Get medicine name
          let medicineName = t('unknown');
          if ('medicine' in activity && activity.medicine && typeof activity.medicine === 'object' && 'name' in activity.medicine) {
            medicineName = (activity.medicine as { name?: string }).name || medicineName;
          }
          
          // Initialize medicine record if it doesn't exist
          if (!medicineStats[medicineName]) {
            medicineStats[medicineName] = { 
              count: 0, 
              total: 0, 
              unit: activity.unitAbbr || '' 
            };
          }
          
          // Increment count and add to total
          medicineStats[medicineName].count += 1;
          if (activity.doseAmount && typeof activity.doseAmount === 'number') {
            medicineStats[medicineName].total += activity.doseAmount;
          }
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

    // Check for active sleep (sleep without endTime)
    // Note: Must exclude pump activities which also have duration and startTime
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    const activeSleep = activities.find(activity => 
      'duration' in activity && 
      'startTime' in activity && 
      'type' in activity && // Sleep activities have type (NAP or NIGHT_SLEEP)
      !('leftAmount' in activity || 'rightAmount' in activity) && // Exclude pump activities
      !('endTime' in activity && activity.endTime) &&
      new Date(activity.startTime) >= startOfDay &&
      new Date(activity.startTime) <= endOfDay
    );

    if (activeSleep && 'startTime' in activeSleep && activeSleep.startTime) {
      const startTime = new Date(activeSleep.startTime);
      const endTime = isToday ? now : endOfDay;
      const activeSleepMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
      if (activeSleepMinutes > 0) {
        totalSleepMinutes += activeSleepMinutes;
      }
    }

    // Calculate awake time (elapsed time since start of day - sleep time)
    const referenceTime = isToday ? now : endOfDay;
    
    const elapsedMinutes = Math.floor((referenceTime.getTime() - startOfDay.getTime()) / (1000 * 60));
    awakeMinutes = Math.max(0, elapsedMinutes - totalSleepMinutes);

    const tiles: StatTile[] = [];

    // Awake Time tile - always first
    if (awakeMinutes > 0) {
      tiles.push({
        filter: null,
        label: t('Awake Time'),
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
        label: t('Total Sleep'),
        value: formatMinutes(totalSleepMinutes),
        icon: <Moon className="h-full w-full" />,
        bgColor: 'bg-gray-50',
        iconColor: 'text-[#9ca3af]', // gray-400 - matches timeline
        borderColor: 'border-gray-500',
        bgActiveColor: 'bg-gray-100'
      });
    }

    // Combined feed tile (bottle, breast, and solids)
    if (totalFeedCount > 0) {
      // Format bottle feed amounts
      const formattedBottleAmounts = Object.entries(bottleFeedAmounts)
        .map(([unit, amount]) => `${amount} ${unit.toLowerCase()}`)
        .join(', ');
      
      // Format solids amounts
      const formattedSolidsAmounts = Object.entries(solidsAmounts)
        .map(([unit, amount]) => `${amount} ${unit.toLowerCase()}`)
        .join(', ');
      
      // Format breast feed amounts separately for left and right
      const breastFeedParts: string[] = [];
      if (leftBreastFeedMinutes > 0 && rightBreastFeedMinutes > 0) {
        breastFeedParts.push(`${t('L:')} ${formatMinutes(leftBreastFeedMinutes)}`);
        breastFeedParts.push(`${t('R:')} ${formatMinutes(rightBreastFeedMinutes)}`);
      } else if (leftBreastFeedMinutes > 0) {
        breastFeedParts.push(`${t('Left:')} ${formatMinutes(leftBreastFeedMinutes)}`);
      } else if (rightBreastFeedMinutes > 0) {
        breastFeedParts.push(`${t('Right:')} ${formatMinutes(rightBreastFeedMinutes)}`);
      }
      const formattedBreastFeed = breastFeedParts.length > 0 ? breastFeedParts.join(', ') : '';
      
      // Build combined label
      const labelParts: string[] = [];
      if (formattedBottleAmounts) {
        labelParts.push(formattedBottleAmounts);
      }
      if (formattedBreastFeed) {
        labelParts.push(formattedBreastFeed);
      }
      if (formattedSolidsAmounts) {
        labelParts.push(formattedSolidsAmounts);
      }
      
      const combinedLabel = labelParts.length > 0 
        ? labelParts.join(' • ')
        : t('Feeds');
      
      tiles.push({
        filter: 'feed',
        label: combinedLabel,
        value: totalFeedCount.toString(),
        icon: <Icon iconNode={bottleBaby} className="h-full w-full" />,
        bgColor: 'bg-gray-50',
        iconColor: 'text-[#7dd3fc]', // sky-300 - matches timeline
        borderColor: 'border-gray-500',
        bgActiveColor: 'bg-gray-100'
      });
    }

    // Wet diaper tile
    if (wetCount > 0) {
      tiles.push({
        filter: 'diaper',
        label: t('Wet Diapers'),
        value: wetCount.toString(),
        icon: <Icon iconNode={diaper} className="h-full w-full" />,
        bgColor: 'bg-gray-50',
        iconColor: 'text-[#0d9488]', // teal-600 (green) - matches timeline for wet
        borderColor: 'border-gray-500',
        bgActiveColor: 'bg-gray-100'
      });
    }

    // Poop tile
    if (poopCount > 0) {
      tiles.push({
        filter: 'poop',
        label: t('Poops'),
        value: poopCount.toString(),
        icon: <Icon iconNode={diaper} className="h-full w-full" />,
        bgColor: 'bg-gray-50',
        iconColor: 'text-amber-700', // amber-700 for poops
        borderColor: 'border-gray-500',
        bgActiveColor: 'bg-gray-100'
      });
    }

    // Medicine tiles
    const medicineEntries = Object.entries(medicineStats).filter(([_, stats]) => stats.count > 0);
    if (medicineEntries.length > 0) {
      if (medicineEntries.length === 1) {
        // Single medicine: show "MedicineName: countx (totalAmount unit)"
        const [medicineName, stats] = medicineEntries[0];
        tiles.push({
          filter: 'medicine',
          label: `${medicineName}: ${stats.count}x (${stats.total}${stats.unit})`,
          value: stats.count.toString(),
          icon: <PillBottle className="h-full w-full" />,
          bgColor: 'bg-gray-50',
          iconColor: 'text-[#43B755]', // green - matches timeline
          borderColor: 'border-gray-500',
          bgActiveColor: 'bg-gray-100'
        });
      } else {
        // Multiple medicines: show all in label "Med1: 2x (10mg), Med2: 1x (5mg)"
        const totalCount = medicineEntries.reduce((sum, [_, stats]) => sum + stats.count, 0);
        const label = medicineEntries
          .map(([name, stats]) => `${name}: ${stats.count}x (${stats.total}${stats.unit})`)
          .join(', ');
        
        tiles.push({
          filter: 'medicine',
          label: label,
          value: totalCount.toString(),
          icon: <PillBottle className="h-full w-full" />,
          bgColor: 'bg-gray-50',
          iconColor: 'text-[#43B755]', // green - matches timeline
          borderColor: 'border-gray-500',
          bgActiveColor: 'bg-gray-100'
        });
      }
    }

    // Note tile
    if (noteCount > 0) {
      tiles.push({
        filter: 'note',
        label: t('Notes'),
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
        label: t('Baths'),
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
        label: t('Pump'),
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
        label: t('Milestones'),
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
        label: t('Measurements'),
        value: measurementCount.toString(),
        icon: <Ruler className="h-full w-full" />,
        bgColor: 'bg-gray-50',
        iconColor: 'text-[#EA6A5E]', // red - matches timeline
        borderColor: 'border-gray-500',
        bgActiveColor: 'bg-gray-100'
      });
    }

    return tiles;
  }, [activities, date, t]);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="overflow-hidden border-0 bg-white timeline-v2-daily-stats relative z-10">
      <div className="px-5 py-1 relative z-10">
        {/* Date Navigation Header */}
        <div className="flex items-center justify-center mb-2">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDateChange(-1)}
              className="h-8 w-8 text-gray-700 hover:bg-gray-100"
              aria-label={t('Previous day')}
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
              aria-label={t('Next day')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Daily Summary Title with Collapse Toggle + Heatmap Toggle */}
        <div className="flex items-center justify-between mb-1">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-3 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
            aria-label={isCollapsed ? t('Expand daily summary') : t('Collapse daily summary')}
          >
            <span>{t('Daily Summary')}</span>
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>

          <div className="flex items-center gap-2">
            {/* Mobile toggle */}
            <button
              type="button"
              className="text-xs inline-flex md:hidden items-center gap-1 text-teal-600 hover:text-teal-700"
              onClick={onHeatmapToggle}
            >
              {isHeatmapVisible ? (
                <>
                  <EyeOff className="h-3 w-3" />
                  <span>{t('Hide heatmap')}</span>
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3" />
                  <span>{t('Show heatmap')}</span>
                </>
              )}
            </button>

            {/* Desktop toggle */}
            <button
              type="button"
              className="ml-2 text-xs hidden md:inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 underline underline-offset-2"
              onClick={onHeatmapToggle}
            >
              {isHeatmapVisible ? (
                <>
                  <EyeOff className="h-3 w-3" />
                  <span>{t('Hide heatmap')}</span>
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3" />
                  <span>{t('Show heatmap')}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        {!isCollapsed && (
          <>
            {statTiles.length > 0 ? (
              <div className="flex flex-wrap gap-0.5">
                {statTiles.map((tile, index) => (
                  <button
                    key={tile.filter ? `${tile.filter}-${tile.label.toLowerCase().replace(/\s+/g, '-')}` : tile.label.toLowerCase().replace(/\s+/g, '-')}
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
                    <div className="flex items-center gap-2.5 px-2 py-1">
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
                {t('No activities recorded for this day')}
              </div>
            )}
          </>
        )}
      </div>

      {/* Mobile heatmap slide-out panel (right side, similar to FormPage) */}
      <div className="fixed inset-0 z-40 md:hidden pointer-events-none">
        {/* Overlay */}
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
            isHeatmapVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={onHeatmapToggle}
        />

        {/* Slide-out panel */}
        <div
          className={`
            absolute inset-y-0 right-0 w-1/2 max-w-xs bg-white shadow-xl
            transform transition-transform duration-300
            timeline-v2-heatmap-panel
            ${isHeatmapVisible ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'}
          `}
        >
          <div className="flex justify-end px-3 pt-2 mb-2">
            <button
              type="button"
              className="text-xs inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 underline underline-offset-2"
              onClick={onHeatmapToggle}
            >
              <EyeOff className="h-3 w-3" />
              <span>{t('Hide heatmap')}</span>
            </button>
          </div>
          <div className="h-full px-2 py-2">
            <TimelineV2Heatmap
              activities={heatmapActivities}
              selectedDate={date}
              isVisible={isHeatmapVisible}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineV2DailyStats;
