import React, { useEffect, useState, useCallback } from 'react';
import { Moon, Sun, Icon } from 'lucide-react';
import { diaper, bottleBaby } from '@lucide/lab';
import { cn } from "@/src/lib/utils";
import { statusBubbleStyles as styles } from './status-bubble.styles';
import { StatusBubbleProps, StatusStyle } from './status-bubble.types';
import { useTimezone } from '@/app/context/timezone';
import { useLocalization } from '@/src/context/localization';

/**
 * Converts warning time (hh:mm) to minutes
 */
const getWarningMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * A component that displays the current status and duration in a stylized bubble
 */
export function StatusBubble({ 
  status, 
  durationInMinutes, 
  warningTime, 
  className,
  startTime, // Add startTime prop
  activityType // Add activityType prop
}: StatusBubbleProps & { startTime?: string }) {
  const { userTimezone, calculateDurationMinutes, formatDuration } = useTimezone();
  const { t } = useLocalization();
  const [calculatedDuration, setCalculatedDuration] = useState(durationInMinutes);
  
  const updateDuration = useCallback(() => {
    if (startTime) {
      try {
        // Use the calculateDurationMinutes function from the timezone context
        // This properly handles DST changes
        const now = new Date();
        
        // Only calculate duration if this is the correct activity type
        // This ensures that "awake" status only considers sleep activities
        // and isn't affected by other activities like pumping
        if (!activityType || 
            (status === 'sleeping' && activityType === 'sleep') || 
            (status === 'awake' && activityType === 'sleep') ||
            (status === 'feed' && activityType === 'feed') ||
            (status === 'diaper' && activityType === 'diaper')) {
          const diffMinutes = calculateDurationMinutes(startTime, now.toISOString());
          setCalculatedDuration(diffMinutes);
        }
      } catch (error) {
        console.error('Error calculating duration:', error);
        // Fallback to the provided duration if calculation fails
        setCalculatedDuration(durationInMinutes);
      }
    }
  }, [startTime, calculateDurationMinutes, status, activityType, durationInMinutes]);
  
  // If startTime is provided, calculate duration based on current time in user's timezone
  useEffect(() => {
    if (startTime) {
      // Update immediately
      updateDuration();
      
      // Then update every minute
      const interval = setInterval(updateDuration, 60000);

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          updateDuration();
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [startTime, updateDuration]);
  
  // Use calculated duration if available, otherwise use prop
  const displayDuration = startTime ? calculatedDuration : durationInMinutes;
  
  // Check if duration exceeds warning time
  const isWarning = warningTime && displayDuration >= getWarningMinutes(warningTime);

  // Get status-specific styles and icon
  const getStatusStyles = (): StatusStyle => {
    switch (status) {
      case 'sleeping':
        return {
          bgColor: styles.statusStyles.sleeping.bgColor,
          icon: <Moon className={styles.icon} />
        };
      case 'awake':
        return {
          bgColor: styles.statusStyles.awake.bgColor,
          icon: <Sun className={cn(styles.icon, styles.statusStyles.awake.iconColor)} />
        };
      case 'feedActive':
        return {
          bgColor: styles.statusStyles.feedActive.bgColor,
          icon: <Icon iconNode={bottleBaby} className={styles.icon} />
        };
      case 'feed':
        return {
          bgColor: isWarning ? styles.statusStyles.feed.warning : styles.statusStyles.feed.normal,
          icon: <Icon iconNode={bottleBaby} className={styles.icon} />
        };
      case 'diaper':
        return {
          bgColor: isWarning ? styles.statusStyles.diaper.warning : styles.statusStyles.diaper.normal,
          icon: <Icon iconNode={diaper} className={styles.icon} />
        };
      default:
        return {
          bgColor: styles.statusStyles.default.bgColor,
          icon: null
        };
    }
  };

  const { bgColor, icon } = getStatusStyles();

  return (
    <div
      className={cn(
        styles.base,
        bgColor,
        className
      )}
    >
      {icon}
      <span>{status === 'feedActive' ? t('Feeding') : formatDuration(displayDuration)}</span>
    </div>
  );
}
