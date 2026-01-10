import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Sun, 
  Icon, 
  Moon, 
  Droplet, 
  StickyNote, 
  Utensils, 
  Bath, 
  Trophy, 
  LampWallDown,
  Ruler,
  Scale,
  RotateCw,
  Thermometer,
  PillBottle
} from 'lucide-react';
import { diaper, bottleBaby } from '@lucide/lab';
import { Card } from '@/src/components/ui/card';
import { cardStyles } from '@/src/components/ui/card/card.styles';
import { useTheme } from '@/src/context/theme';
import { cn } from '@/src/lib/utils';

// Import component-specific files
import './daily-stats.css';
import { dailyStatsStyles } from './daily-stats.styles';
import { DailyStatsProps, StatItemProps, StatsTickerProps } from './daily-stats.types';
import { useLocalization } from '@/src/context/localization';

const StatsTicker: React.FC<StatsTickerProps> = ({ stats }) => {
  const { theme } = useTheme();
  const tickerRef = useRef<HTMLDivElement>(null);
  const [animationDuration, setAnimationDuration] = useState(30); // seconds
  
  useEffect(() => {
    if (tickerRef.current) {
      // Calculate animation duration based on content width
      const contentWidth = tickerRef.current.scrollWidth;
      const containerWidth = tickerRef.current.clientWidth;
      
      // Only animate if content is wider than container
      if (contentWidth > containerWidth) {
        // Adjust speed based on content length (longer content = faster scroll)
        const newDuration = Math.max(20, Math.min(40, contentWidth / 50));
        setAnimationDuration(newDuration);
      }
    }
  }, [stats]);

  if (stats.length === 0) return null;

  // Create duplicate content to ensure seamless looping
  const tickerContent = (
    <>
      {stats.map((stat, index) => (
        <div key={  const { t } = useLocalization(){t('; index} className=')}{dailyStatsStyles.ticker.item}>
          <div className={dailyStatsStyles.ticker.icon}>{stat.icon}</div>
          <span className={dailyStatsStyles.ticker.label}>{stat.label}: </span>
          <span className={dailyStatsStyles.ticker.value}>{stat.value}</span>
        </div>
      ))}
    </>
  );

  return (
    <div className={dailyStatsStyles.ticker.container}>
      <div 
        ref={tickerRef}
        className={dailyStatsStyles.ticker.animation}
        style={{ 
          animationDuration: `${animationDuration}s`,
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
          animationName: 'marquee'
        }}
      >
        {tickerContent}
        {tickerContent} {/* Duplicate content for seamless looping */}
      </div>
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

const StatItem: React.FC<StatItemProps> = ({ icon, label, value }) => (
  <div className={dailyStatsStyles.statItem.container}>
    <div className={dailyStatsStyles.statItem.iconContainer}>
      {icon}
    </div>
    <div>
      <div className={dailyStatsStyles.statItem.label}>{label}</div>
      <div className={dailyStatsStyles.statItem.value}>{value}</div>
    </div>
  </div>
);

export const DailyStats: React.FC<DailyStatsProps> = ({ activities, date, isLoading = false }) => {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  // Helper function to format minutes into hours and minutes
  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Calculate time awake and asleep
  const { 
    awakeTime, 
    sleepTime, 
    totalConsumed, 
    diaperChanges, 
    poopCount, 
    leftBreastTime, 
    rightBreastTime, 
    noteCount, 
    solidsConsumed, 
    bathCount,
    milestoneCount,
    lastMeasurements,
    pumpTotals,
    medicineCounts
  } = useMemo(() => {
    // Set start and end of the selected day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    // For calculating sleep time
    let totalSleepMinutes = 0;
    
    // For calculating consumed amounts
    const consumedAmounts: Record<string, number> = {};
    
    // For counting bottle feeds
    let feedCount = 0;
    
    // For calculating solids consumed amounts
    const solidsAmounts: Record<string, number> = {};
    
    // For counting diapers and poops
    let diaperCount = 0;
    let poopCount = 0;
    
    // For tracking breast feeding per side
    let leftBreastSeconds = 0;
    let rightBreastSeconds = 0;
    
    // For counting notes
    let noteCount = 0;
    
    // For counting bath events
    let bathCount = 0;
    
    // For counting milestone events
    let milestoneCount = 0;
    
    // For tracking last measurements by type
    const lastMeasurements: Record<string, { value: number; unit: string; date: Date }> = {};
    
    // For tracking pump totals by unit
    const pumpTotals: Record<string, number> = {};
    
    // For tracking medicine doses by medicine
    const medicineDoses: Record<string, { count: number, total: number, unit: string }> = {};

    // Process each activity
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
      
      // Feed activities
      if ('amount' in activity && activity.amount) {
        const time = new Date(activity.time);
        
        // Only count feeds that occurred on the selected day
        if (time >= startOfDay && time <= endOfDay) {
          const unit = activity.unitAbbr || 'oz';
          
          // Separate tracking for solids vs bottle feeds
          if ('type' in activity && activity.type === 'SOLIDS') {
            if (!solidsAmounts[unit]) {
              solidsAmounts[unit] = 0;
            }
            solidsAmounts[unit] += activity.amount;
          } else if ('type' in activity && activity.type === 'BOTTLE') {
            // Count bottle feeds and track amounts
            feedCount++;
            if (!consumedAmounts[unit]) {
              consumedAmounts[unit] = 0;
            }
            consumedAmounts[unit] += activity.amount;
          } else {
            // For other feed types (like BREAST with amount), just track amounts
            if (!consumedAmounts[unit]) {
              consumedAmounts[unit] = 0;
            }
            consumedAmounts[unit] += activity.amount;
          }
        }
      }
      
      // Breast feed activities with duration
      if ('type' in activity && activity.type === 'BREAST' && 'feedDuration' in activity && activity.feedDuration) {
        const time = new Date(activity.time);
        
        // Only count feeds that occurred on the selected day
        if (time >= startOfDay && time <= endOfDay) {
          // Track duration per side
          if ('side' in activity && activity.side) {
            if (activity.side === 'LEFT') {
              leftBreastSeconds += activity.feedDuration;
            } else if (activity.side === 'RIGHT') {
              rightBreastSeconds += activity.feedDuration;
            }
          }
        }
      }
      
      // Diaper activities
      if ('condition' in activity && 'type' in activity) {
        const time = new Date(activity.time);
        
        // Only count diapers that occurred on the selected day
        if (time >= startOfDay && time <= endOfDay) {
          diaperCount++;
          
          // Count poops (dirty or wet+dirty)
          if (activity.type === 'DIRTY' || activity.type === 'BOTH') {
            poopCount++;
          }
        }
      }
      
      // Note activities
      if ('content' in activity) {
        const time = new Date(activity.time);
        
        // Only count notes that occurred on the selected day
        if (time >= startOfDay && time <= endOfDay) {
          noteCount++;
        }
      }
      
      // Bath activities
      if ('soapUsed' in activity) {
        const time = new Date(activity.time);
        
        // Only count baths that occurred on the selected day
        if (time >= startOfDay && time <= endOfDay) {
          bathCount++;
        }
      }
      
      // Milestone activities
      if ('title' in activity && 'category' in activity) {
        const date = new Date(activity.date);
        
        // Only count milestones that occurred on the selected day
        if (date >= startOfDay && date <= endOfDay) {
          milestoneCount++;
        }
      }
      
      // Measurement activities
      if ('value' in activity && 'unit' in activity && 'type' in activity) {
        const date = new Date(activity.date);
        
        // Track the latest measurement of each type
        if (!lastMeasurements[activity.type] || date > lastMeasurements[activity.type].date) {
          lastMeasurements[activity.type] = {
            value: activity.value,
            unit: activity.unit,
            date: date
          };
        }
      }
      
      // Pump activities
      if ('leftAmount' in activity || 'rightAmount' in activity) {
        // Type guard to ensure TypeScript knows this is a pump activity
        const isPumpActivity = (act: any): act is { 
          startTime?: string | Date; 
          endTime?: string | Date | null; 
          leftAmount?: number; 
          rightAmount?: number; 
          totalAmount?: number; 
          unit?: string;
        } => {
          return 'leftAmount' in act || 'rightAmount' in act;
        };
        
        if (isPumpActivity(activity) && activity.startTime) {
          const startTime = new Date(activity.startTime);
          
          // Only count pumps that occurred on the selected day
          if (startTime >= startOfDay && startTime <= endOfDay) {
            // Make sure to use the correct unit for grouping
            const unit = activity.unit ? activity.unit.toLowerCase() : 'oz';
            
            if (!pumpTotals[unit]) {
              pumpTotals[unit] = 0;
            }
            
            // Add left amount if available
            if (activity.leftAmount && typeof activity.leftAmount === 'number') {
              pumpTotals[unit] += activity.leftAmount;
            }
            
            // Add right amount if available
            if (activity.rightAmount && typeof activity.rightAmount === 'number') {
              pumpTotals[unit] += activity.rightAmount;
            }
            
            // If there's a total amount and no left/right, use that
            if (activity.totalAmount && typeof activity.totalAmount === 'number' && 
                (!activity.leftAmount || !activity.rightAmount)) {
              pumpTotals[unit] += activity.totalAmount;
            }
          }
        }
      }
      
      // Medicine activities
      if ('doseAmount' in activity && 'medicineId' in activity) {
        const time = new Date(activity.time);
        
        // Only count medicines that were given on the selected day
        if (time >= startOfDay && time <= endOfDay) {
          // Get medicine name
          let medicineName = 'Unknown';
          if ('medicine' in activity && activity.medicine && typeof activity.medicine === 'object' && 'name' in activity.medicine) {
            medicineName = (activity.medicine as { name?: string }).name || medicineName;
          }
          
          // Initialize medicine record if it doesn't exist
          if (!medicineDoses[medicineName]) {
            medicineDoses[medicineName] = { 
              count: 0, 
              total: 0, 
              unit: activity.unitAbbr || '' 
            };
          }
          
          // Increment count and add to total
          medicineDoses[medicineName].count += 1;
          if (activity.doseAmount && typeof activity.doseAmount === 'number') {
            medicineDoses[medicineName].total += activity.doseAmount;
          }
        }
      }
    });

    // Calculate awake time (elapsed time today minus sleep minutes)
    let totalElapsedMinutes = 24 * 60; // Default to full day (24 hours in minutes)
    
    // If the selected date is today, only count elapsed time
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && 
                    date.getMonth() === now.getMonth() && 
                    date.getFullYear() === now.getFullYear();
    
    if (isToday) {
      // Calculate minutes elapsed so far today
      const elapsedMs = now.getTime() - startOfDay.getTime();
      totalElapsedMinutes = Math.floor(elapsedMs / (1000 * 60));
    }
    
    const awakeMinutes = totalElapsedMinutes - totalSleepMinutes;
    
    // Format consumed amounts with feed count
    const formattedAmounts = Object.entries(consumedAmounts)
      .map(([unit, amount]) => `${amount} ${unit.toLowerCase()}`)
      .join(', ');
    const formattedConsumed = feedCount > 0 
      ? `${feedCount} feed${feedCount !== 1 ? 's' : ''}, ${formattedAmounts}`
      : formattedAmounts || 'None';
      
    // Format solids consumed amounts
    const formattedSolidsConsumed = Object.entries(solidsAmounts)
      .map(([unit, amount]) => `${amount} ${unit.toLowerCase()}`)
      .join(', ');
    
    // Format pump totals - ensure we're grouping by unit type correctly
    const formattedPumpTotals = Object.entries(pumpTotals)
      .map(([unit, amount]) => `${amount.toFixed(1)} ${unit}`)
      .join(', ');
      
    // Format medicine counts
    const formattedMedicineCounts = Object.entries(medicineDoses)
      .map(([name, data]) => ({
        name,
        count: data.count,
        total: data.total,
        unit: data.unit,
        display: `${data.count}x (${data.total}${data.unit})`
      }));
    
    return {
      awakeTime: formatMinutes(awakeMinutes),
      sleepTime: formatMinutes(totalSleepMinutes),
      totalConsumed: formattedConsumed || 'None',
      diaperChanges: diaperCount.toString(),
      poopCount: poopCount.toString(),
      leftBreastTime: formatMinutes(Math.floor(leftBreastSeconds / 60)),
      rightBreastTime: formatMinutes(Math.floor(rightBreastSeconds / 60)),
      noteCount: noteCount.toString(),
      solidsConsumed: formattedSolidsConsumed || 'None',
      bathCount: bathCount.toString(),
      milestoneCount: milestoneCount.toString(),
      lastMeasurements,
      pumpTotals: formattedPumpTotals || 'None',
      medicineCounts: formattedMedicineCounts
    };
  }, [activities, date]);

  return (
    <Card className={cn(dailyStatsStyles.container, 'overflow-hidden border-0 border-b border-gray-200')}>
      <div 
        className={cn(dailyStatsStyles.header, "cursor-pointer")}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className={dailyStatsStyles.title}>{t('Daily Stats')}</h3>
        
        {!isExpanded && !isLoading && activities.length > 0 && (
          <StatsTicker 
            stats={[
              ...(awakeTime !== '0h 0m' ? [{ icon: <Sun className="h-3 w-3 text-amber-500" />, label: "Awake", value: awakeTime }] : []),
              ...(sleepTime !== '0h 0m' ? [{ icon: <Moon className="h-3 w-3 text-gray-700" />, label: "Sleep", value: sleepTime }] : []),
              ...(totalConsumed !== 'None' ? [{ icon: <Icon iconNode={bottleBaby} className="h-3 w-3 text-sky-600" />, label: "Bottle", value: totalConsumed }] : []),
              ...(diaperChanges !== '0' ? [{ icon: <Icon iconNode={diaper} className="h-3 w-3 text-teal-600" />, label: "Diapers", value: diaperChanges }] : []),
              ...(poopCount !== '0' ? [{ icon: <Icon iconNode={diaper} className="h-3 w-3 text-amber-700" />, label: "Poops", value: poopCount }] : []),
              ...(solidsConsumed !== 'None' ? [{ icon: <Utensils className="h-3 w-3 text-green-600" />, label: "Solids", value: solidsConsumed }] : []),
              ...(leftBreastTime !== '0h 0m' ? [{ icon: <Droplet className="h-3 w-3 text-blue-500" />, label: "Left", value: leftBreastTime }] : []),
              ...(rightBreastTime !== '0h 0m' ? [{ icon: <Droplet className="h-3 w-3 text-red-500" />, label: "Right", value: rightBreastTime }] : []),
              ...(noteCount !== '0' ? [{ icon: <StickyNote className="h-3 w-3 text-yellow-500" />, label: "Notes", value: noteCount }] : []),
              ...(bathCount !== '0' ? [{ icon: <Bath className="h-3 w-3 text-orange-500" />, label: "Baths", value: bathCount }] : []),
              ...(milestoneCount !== '0' ? [{ icon: <Trophy className="h-3 w-3 text-blue-500" />, label: "Milestones", value: milestoneCount }] : []),
              ...(pumpTotals !== 'None' ? [{ icon: <LampWallDown className="h-3 w-3 text-purple-500" />, label: "Pumped", value: pumpTotals }] : []),
              ...(medicineCounts.length > 0 ? medicineCounts.map(med => ({ 
                icon: <PillBottle className="h-3 w-3 text-green-600" />, 
                label: med.name, 
                value: med.display 
              })) : []),
              ...(lastMeasurements['HEIGHT'] ? [{ 
                icon: <Ruler className="h-3 w-3 text-red-500" />, 
                label: "Height", 
                value: `${lastMeasurements['HEIGHT'].value} ${lastMeasurements['HEIGHT'].unit}` 
              }] : []),
              ...(lastMeasurements['WEIGHT'] ? [{ 
                icon: <Scale className="h-3 w-3 text-red-500" />, 
                label: "Weight", 
                value: `${lastMeasurements['WEIGHT'].value} ${lastMeasurements['WEIGHT'].unit}` 
              }] : []),
              ...(lastMeasurements['HEAD_CIRCUMFERENCE'] ? [{ 
                icon: <RotateCw className="h-3 w-3 text-red-500" />, 
                label: "Head", 
                value: `${lastMeasurements['HEAD_CIRCUMFERENCE'].value} ${lastMeasurements['HEAD_CIRCUMFERENCE'].unit}` 
              }] : []),
              ...(lastMeasurements['TEMPERATURE'] ? [{ 
                icon: <Thermometer className="h-3 w-3 text-red-500" />, 
                label: "Temp", 
                value: `${lastMeasurements['TEMPERATURE'].value} ${lastMeasurements['TEMPERATURE'].unit}` 
              }] : [])
            ]}
          />
        )}
        
        <button className={dailyStatsStyles.toggle}>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      
      {isExpanded && (
        <div className={dailyStatsStyles.content}>
          {isLoading ? (
            <div className={dailyStatsStyles.empty}>
              {t('Loading daily statistics...')}
            </div>
          ) : activities.length === 0 ? (
            <div className={dailyStatsStyles.empty}>
              {t('No activities recorded for this day')}
            </div>
          ) : (
            <>
              <StatItem 
                icon={<Sun className="h-4 w-4 text-amber-500" />} 
                label="Awake Time" 
                value={awakeTime} 
              />
              <StatItem 
                icon={<Moon className="h-4 w-4 text-gray-700" />} 
                label="Sleep Time" 
                value={sleepTime} 
              />
              {totalConsumed !== 'None' && (
                <StatItem 
                  icon={<Icon iconNode={bottleBaby} className="h-4 w-4 text-sky-600" />} 
                  label="Bottle" 
                  value={totalConsumed} 
                />
              )}
              {diaperChanges !== '0' && (
                <StatItem 
                  icon={<Icon iconNode={diaper} className="h-4 w-4 text-teal-600" />} 
                  label="Diaper Changes" 
                  value={diaperChanges} 
                />
              )}
              {poopCount !== '0' && (
                <StatItem 
                  icon={<Icon iconNode={diaper} className="h-4 w-4 text-amber-700" />} 
                  label="Poops" 
                  value={poopCount} 
                />
              )}
              {solidsConsumed !== 'None' && (
                <StatItem 
                  icon={<Utensils className="h-4 w-4 text-green-600" />} 
                  label="Solids" 
                  value={solidsConsumed} 
                />
              )}
              {leftBreastTime !== '0h 0m' && (
                <StatItem 
                  icon={<Droplet className="h-4 w-4 text-blue-500" />} 
                  label="Left Breast" 
                  value={leftBreastTime} 
                />
              )}
              {rightBreastTime !== '0h 0m' && (
                <StatItem 
                  icon={<Droplet className="h-4 w-4 text-red-500" />} 
                  label="Right Breast" 
                  value={rightBreastTime} 
                />
              )}
              {noteCount !== '0' && (
                <StatItem 
                  icon={<StickyNote className="h-4 w-4 text-yellow-500" />} 
                  label="Notes" 
                  value={noteCount} 
                />
              )}
              {bathCount !== '0' && (
                <StatItem 
                  icon={<Bath className="h-4 w-4 text-orange-500" />} 
                  label="Baths" 
                  value={bathCount} 
                />
              )}
              {milestoneCount !== '0' && (
                <StatItem 
                  icon={<Trophy className="h-4 w-4 text-blue-500" />} 
                  label="Milestones" 
                  value={milestoneCount} 
                />
              )}
              {pumpTotals !== 'None' && (
                <StatItem 
                  icon={<LampWallDown className="h-4 w-4 text-purple-500" />} 
                  label="Pumped" 
                  value={pumpTotals} 
                />
              )}
              {medicineCounts.length > 0 && medicineCounts.map((med, index) => (
                <StatItem 
                  key={`med-${index}`}
                  icon={<PillBottle className="h-4 w-4 text-green-600" />} 
                  label={med.name} 
                  value={med.display} 
                />
              ))}
              {lastMeasurements['HEIGHT'] && (
                <StatItem 
                  icon={<Ruler className="h-4 w-4 text-red-500" />} 
                  label="Height" 
                  value={`${lastMeasurements['HEIGHT'].value} ${lastMeasurements['HEIGHT'].unit}`} 
                />
              )}
              {lastMeasurements['WEIGHT'] && (
                <StatItem 
                  icon={<Scale className="h-4 w-4 text-red-500" />} 
                  label="Weight" 
                  value={`${lastMeasurements['WEIGHT'].value} ${lastMeasurements['WEIGHT'].unit}`} 
                />
              )}
              {lastMeasurements['HEAD_CIRCUMFERENCE'] && (
                <StatItem 
                  icon={<RotateCw className="h-4 w-4 text-red-500" />} 
                  label="Head Circ." 
                  value={`${lastMeasurements['HEAD_CIRCUMFERENCE'].value} ${lastMeasurements['HEAD_CIRCUMFERENCE'].unit}`} 
                />
              )}
              {lastMeasurements['TEMPERATURE'] && (
                <StatItem 
                  icon={<Thermometer className="h-4 w-4 text-red-500" />} 
                  label="Temperature" 
                  value={`${lastMeasurements['TEMPERATURE'].value} ${lastMeasurements['TEMPERATURE'].unit}`} 
                />
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
};

export default DailyStats;
