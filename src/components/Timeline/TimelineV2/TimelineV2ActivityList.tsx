import { Baby as BabyIcon } from 'lucide-react';
import { useRef, useMemo } from 'react';
import { ActivityType, TimelineActivityListProps } from '../types';
import { getActivityIcon, getActivityStyle, getActivityDescription, getActivityTime } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/src/context/theme';
import { Label } from '@/src/components/ui/label';
import { useLocalization } from '@/src/context/localization';

import '../timeline-activity-list.css';

const TimelineV2ActivityList = ({
  activities,
  settings,
  isLoading,
  isAnimated = true,
  selectedDate,
  onActivitySelect,
}: TimelineActivityListProps) => {
  

  const { t } = useLocalization();  

  const { theme } = useTheme();
  
  const contentRef = useRef<HTMLDivElement>(null);

  // Group activities by time of day
  const getTimeOfDay = (date: Date): string => {
    const hour = date.getHours();
    if (hour >= 0 && hour < 6) return 'early-morning';
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night'; // 21:00 (9 PM) to 23:59 (11:59 PM)
  };

  const getTimeOfDayLabel = (timeOfDay: string): string => {
    switch (timeOfDay) {
      case 'early-morning': return 'Early Morning';
      case 'morning': return 'Morning';
      case 'afternoon': return 'Afternoon';
      case 'evening': return 'Evening';
      case 'night': return 'Night';
      default: return timeOfDay;
    }
  };

  const groupedActivities = useMemo(() => {
    const groups: { [key: string]: ActivityType[] } = {
      'early-morning': [],
      morning: [],
      afternoon: [],
      evening: [],
      night: [],
    };
    
    activities.forEach(activity => {
      let groupingTime: Date;
      
      // Special logic for sleep activities
      if ('duration' in activity && 'startTime' in activity && activity.endTime) {
        const startTime = new Date(activity.startTime);
        const endTime = new Date(activity.endTime);
        
        const startDate = startTime.toDateString();
        const endDate = endTime.toDateString();
        
        if (startDate === endDate) {
          groupingTime = startTime;
        } else {
          const viewingDate = selectedDate || new Date();
          const viewingDateStr = viewingDate.toDateString();
          const startDateStr = startTime.toDateString();
          const endDateStr = endTime.toDateString();
          
          if (startDateStr === viewingDateStr) {
            groupingTime = startTime;
          } else if (endDateStr === viewingDateStr) {
            groupingTime = endTime;
          } else {
            groupingTime = startTime;
          }
        }
      } else {
        groupingTime = new Date(getActivityTime(activity));
      }
      
      const timeOfDay = getTimeOfDay(groupingTime);
      groups[timeOfDay].push(activity);
    });
    
    // Sort activities within each group (newest first)
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        const timeA = new Date(getActivityTime(a));
        const timeB = new Date(getActivityTime(b));
        return timeB.getTime() - timeA.getTime();
      });
    });
    
    // Return groups in order: night (9 PM-12 AM), evening, afternoon, morning, early-morning (12 AM-6 AM)
    return [
      { timeOfDay: 'night', activities: groups.night },
      { timeOfDay: 'evening', activities: groups.evening },
      { timeOfDay: 'afternoon', activities: groups.afternoon },
      { timeOfDay: 'morning', activities: groups.morning },
      { timeOfDay: 'early-morning', activities: groups['early-morning'] },
    ].filter(group => group.activities.length > 0);
  }, [activities, selectedDate]);


  return (
    <>
      {/* Scrollable Content */}
      <div 
        className="h-full overflow-y-auto relative bg-white timeline-activity-scroll-container" 
        ref={contentRef}
      >
        {/* Timeline View */}
        <div className="min-h-full bg-white relative timeline-activity-list px-5 pb-5">
          {/* Fade gradient at top - from white to transparent */}
          <div className="absolute position: sticky top-0 left-0 right-0 h-2 bg-gradient-to-b from-white to-transparent pointer-events-none z-20 timeline-top-gradient"></div>
          {activities.length > 0 ? (
            <div className="relative">
              {/* Timeline vertical line */}
              <div className="border-l-2 border-gray-200 pl-5 ml-2.5 timeline-container">
                <AnimatePresence>
                  {groupedActivities.map((group, groupIndex) => (
                    <motion.div
                      key={group.timeOfDay}
                      className="relative timeline-hour-group mb-6"
                      initial={isAnimated ? { opacity: 0, y: -10 } : false}
                      animate={isAnimated ? { opacity: 1, y: 0 } : false}
                      transition={isAnimated ? {
                        delay: groupIndex * 0.05,
                        duration: 0.2,
                        ease: "easeOut"
                      } : { duration: 0 }}
                    >
                      {/* Time of Day Header */}
                      <div className="flex items-center mb-3 ml-2">
                        <div className="text-sm font-semibold text-gray-500">
                          {getTimeOfDayLabel(group.timeOfDay)}
                        </div>
                      </div>
                      
                      {/* Activities in this time period */}
                      <div className="space-y-0 pb-4">
                        {group.activities.map((activity, activityIndex) => {
                          const style = getActivityStyle(activity);
                          const description = getActivityDescription(activity, settings, t);
                          const activityTime = new Date(getActivityTime(activity));
                          let timeStr: string;
                          
                          if ('duration' in activity && 'startTime' in activity) {
                            const startTime = new Date(activity.startTime);
                            const startDateStr = startTime.toDateString();
                            
                            if (activity.endTime) {
                              const endTime = new Date(activity.endTime);
                              const endDateStr = endTime.toDateString();
                              const isOvernight = startDateStr !== endDateStr;
                              
                              const startTimeStr = startTime.toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                              });
                              
                              const endTimeStr = endTime.toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                              });
                              
                              if (isOvernight) {
                                // Show dates for overnight entries
                                const startDateFormatted = startTime.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                });
                                const endDateFormatted = endTime.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                });
                                timeStr = `${startDateFormatted} ${startTimeStr} - ${endDateFormatted} ${endTimeStr}`;
                              } else {
                                timeStr = `${startTimeStr} - ${endTimeStr}`;
                              }
                            } else {
                              const startTimeStr = startTime.toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                              });
                              timeStr = startTimeStr;
                            }
                          } else {
                            timeStr = activityTime.toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            });
                          }
                          
                          const getActivityColor = (bgClass: string) => {
                            if (bgClass.includes('bg-gradient-to-br from-gray-400')) return '#9ca3af'; // gray-400 - matches old timeline
                            if (bgClass.includes('bg-sky-200')) return '#7dd3fc'; // sky-300 - matches old timeline
                            if (bgClass.includes('bg-gradient-to-r from-teal-600')) return '#0d9488'; // teal-600 - matches old timeline
                            if (bgClass.includes('bg-[#FFFF99]')) return '#fef08a'; // yellow-200 - matches old timeline
                            if (bgClass.includes('bg-gradient-to-r from-orange-400')) return '#fb923c'; // orange-400 - matches old timeline
                            if (bgClass.includes('bg-gradient-to-r from-purple-200')) return '#c084fc'; // purple-400 - matches old timeline
                            if (bgClass.includes('bg-[#4875EC]')) return '#4875EC'; // blue - matches old timeline
                            if (bgClass.includes('bg-[#EA6A5E]')) return '#EA6A5E'; // red - matches old timeline
                            if (bgClass.includes('bg-[#43B755]')) return '#43B755'; // green - matches old timeline
                            return '#9ca3af'; // default gray
                          };
                          
                          const activityColor = getActivityColor(style.bg);
                          
                          // Determine activity type class for styling
                          // Check pump FIRST since it also has duration and startTime
                          let activityTypeClass = '';
                          if ('leftAmount' in activity || 'rightAmount' in activity) activityTypeClass = 'pump';
                          else if ('duration' in activity && 'type' in activity) activityTypeClass = 'sleep';
                          else if ('amount' in activity) activityTypeClass = 'feed';
                          else if ('condition' in activity) activityTypeClass = 'diaper';
                          else if ('content' in activity) activityTypeClass = 'note';
                          else if ('soapUsed' in activity) activityTypeClass = 'bath';
                          else if ('title' in activity && 'category' in activity) activityTypeClass = 'milestone';
                          else if ('value' in activity && 'unit' in activity) activityTypeClass = 'measurement';
                          else if ('doseAmount' in activity && 'medicineId' in activity) activityTypeClass = 'medicine';
                          
                          return (
                            <motion.div
                              key={activity.id}
                              className={`relative timeline-event ${activityTypeClass}`}
                              initial={isAnimated ? { opacity: 0, x: -20 } : false}
                              animate={isAnimated ? { opacity: 1, x: 0 } : false}
                              transition={isAnimated ? {
                                delay: (groupIndex * 0.1) + (activityIndex * 0.05),
                                duration: 0.3,
                                type: "tween",
                                ease: "easeOut"
                              } : { duration: 0 }}
                              onClick={() => {
                                setTimeout(() => onActivitySelect(activity), 0);
                              }}
                              style={{
                                '--activity-color': activityColor,
                              } as React.CSSProperties & { '--activity-color': string }}
                            >
                              {/* Event Icon */}
                              <div className={`flex-shrink-0 event-icon ${activityTypeClass}`}>
                                {getActivityIcon(activity)}
                              </div>
                              
                              {/* Event Content */}
                              <div className="flex-1 min-w-0 event-content">
                                <Label className="text-sm font-semibold text-gray-900 mb-0.5 event-title">
                                  {description.type}
                                </Label>
                                <div className="text-xs text-gray-600 event-details">
                                  {(() => {
                                    if ('duration' in activity) {
                                      const location = ('location' in activity && activity.location && activity.location !== 'OTHER') ? 
                                        activity.location.split('_').map((word: string) => 
                                          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                                        ).join(' ') : '';
                                      const duration = activity.duration ? `${Math.floor(activity.duration / 60)}h ${activity.duration % 60}m` : '';
                                      const parts = [];
                                      if (location) parts.push(location);
                                      if (duration) parts.push(duration);
                                      if (!('endTime' in activity)) parts.push('Still asleep');
                                      return parts.length > 0 ? parts.join(' • ') : t('Sleep');
                                    }
                                    
                                    if ('amount' in activity) {
                                      if (activity.type === 'BREAST') {
                                        const side = activity.side ? activity.side.charAt(0) + activity.side.slice(1).toLowerCase() : '';
                                        let duration = '';
                                        if (activity.feedDuration) {
                                          const minutes = Math.floor(activity.feedDuration / 60);
                                          const seconds = activity.feedDuration % 60;
                                          duration = seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes} min`;
                                        } else if (activity.amount) {
                                          duration = `${activity.amount} min`;
                                        }
                                        const parts = [side ? `${side} ${t('Side')}` : '', duration].filter(Boolean);
                                        if ((activity as any).notes) {
                                          const notes = (activity as any).notes;
                                          const truncatedNotes = notes.length > 30 ? notes.substring(0, 30) + '...' : notes;
                                          parts.push(truncatedNotes);
                                        }
                                        return parts.join(' • ');
                                      } else if (activity.type === 'BOTTLE') {
                                        const unit = ((activity as any).unitAbbr || 'oz').toLowerCase();
                                        const parts = [];
                                        if ((activity as any).bottleType) {
                                          const bottleType = (activity as any).bottleType.replace('\\', '/');
                                          parts.push(bottleType);
                                        }
                                        parts.push(`${activity.amount} ${unit}`);
                                        if ((activity as any).notes) {
                                          const notes = (activity as any).notes;
                                          const truncatedNotes = notes.length > 30 ? notes.substring(0, 30) + '...' : notes;
                                          parts.push(truncatedNotes);
                                        }
                                        return parts.join(' • ');
                                      } else if (activity.type === 'SOLIDS') {
                                        const unit = ((activity as any).unitAbbr || 'g').toLowerCase();
                                        const food = activity.food ? activity.food : '';
                                        const parts = [];
                                        if (food) {
                                          parts.push(`${activity.amount} ${unit} of ${food}`);
                                        } else {
                                          parts.push(`${activity.amount} ${unit}`);
                                        }
                                        if ((activity as any).notes) {
                                          const notes = (activity as any).notes;
                                          const truncatedNotes = notes.length > 30 ? notes.substring(0, 30) + '...' : notes;
                                          parts.push(truncatedNotes);
                                        }
                                        return parts.join(' • ');
                                      }
                                    }
                                    
                                    if ('condition' in activity) {
                                      const details = [];
                                      if (activity.condition) {
                                        details.push(activity.condition.charAt(0) + activity.condition.slice(1).toLowerCase());
                                      }
                                      if (activity.color) {
                                        details.push(activity.color.charAt(0) + activity.color.slice(1).toLowerCase());
                                      }
                                      if (activity.blowout) {
                                        details.push('Blowout/Leakage');
                                      }
                                      return details.length > 0 ? details.join(' • ') : t('Diaper');
                                    }
                                    
                                    if ('content' in activity) {
                                      return activity.content.length > 50 ? 
                                        activity.content.substring(0, 50) + '...' : 
                                        activity.content;
                                    }
                                    
                                    if ('soapUsed' in activity) {
                                      const details = [];
                                      if (activity.soapUsed) details.push('Soap');
                                      if (activity.shampooUsed) details.push('Shampoo');
                                      if (details.length === 0) details.push('Water only');
                                      if (activity.notes) {
                                        const notes = activity.notes.length > 30 ? 
                                          activity.notes.substring(0, 30) + '...' : 
                                          activity.notes;
                                        details.push(notes);
                                      }
                                      return details.join(' • ');
                                    }
                                    
                                    if ('leftAmount' in activity || 'rightAmount' in activity) {
                                      const amounts = [];
                                      const unit = ((activity as any).unit || 'oz').toLowerCase();
                                      if ((activity as any).leftAmount) amounts.push(`L: ${(activity as any).leftAmount} ${unit}`);
                                      if ((activity as any).rightAmount) amounts.push(`R: ${(activity as any).rightAmount} ${unit}`);
                                      if ((activity as any).totalAmount) amounts.push(`Total: ${(activity as any).totalAmount} ${unit}`);
                                      return amounts.join(' • ');
                                    }
                                    
                                    if ('title' in activity && 'category' in activity) {
                                      const title = activity.title.length > 40 ? 
                                        activity.title.substring(0, 40) + '...' : 
                                        activity.title;
                                      return title;
                                    }
                                    
                                    if ('value' in activity && 'unit' in activity) {
                                      let unit = ('type' in activity && activity.type === 'TEMPERATURE') ? 
                                        activity.unit : activity.unit.toLowerCase();
                                      if ('type' in activity && activity.type !== 'TEMPERATURE' && activity.value >= 1) {
                                        if (unit === 'lb') {
                                          unit = 'lbs';
                                        }
                                      }
                                      return `${activity.value} ${unit}`;
                                    }
                                    
                                    if ('doseAmount' in activity && 'medicineId' in activity) {
                                      const unit = activity.unitAbbr ? activity.unitAbbr.toLowerCase() : '';
                                      const dose = activity.doseAmount ? `${activity.doseAmount} ${unit}`.trim() : '';
                                      let medName = 'Medicine';
                                      if ('medicine' in activity && activity.medicine && typeof activity.medicine === 'object' && 'name' in activity.medicine) {
                                        medName = (activity.medicine as { name?: string }).name || medName;
                                      }
                                      return `${medName} - ${dose}`;
                                    }
                                    
                                    return 'Activity logged';
                                  })()}
                                </div>
                              </div>
                              
                              {/* Event Time */}
                              <div className="flex-shrink-0 text-xs text-gray-500 event-time">
                                {timeStr}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ) : !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center h-full">
              <div className="text-center p-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-100 flex items-center justify-center">
                  <BabyIcon className="h-8 w-8 text-indigo-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1 timeline-empty-state">{t('No activities recorded')}</h3>
                <p className="text-sm text-gray-500 timeline-empty-description">
                  {t('Activities will appear here once you start tracking')}
                </p>
              </div>
            </div>
          )}
        </div>
        {/* Loading State */}
        {isLoading && activities.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center h-full">
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1 timeline-empty-state">{t('Loading activities...')}</h3>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default TimelineV2ActivityList;

