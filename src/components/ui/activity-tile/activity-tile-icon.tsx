import React from 'react';
import { Moon, Edit, Icon, LampWallDown, Trophy, Baby, Activity, Syringe } from 'lucide-react';
import { diaper, bottleBaby } from '@lucide/lab';
import { cn } from "@/src/lib/utils";
import { activityTileStyles as styles } from './activity-tile.styles';
import { ActivityTileIconProps, ActivityTileVariant, ActivityType } from './activity-tile.types';
import { getActivityVariant } from './activity-tile-utils';

/**
 * ActivityTileIcon component displays the appropriate icon based on activity type
 */
export function ActivityTileIcon({
  activity,
  className,
  variant: variantProp,
  isButton = false
}: ActivityTileIconProps & { variant?: ActivityTileVariant; isButton?: boolean }) {
  const variant = variantProp || getActivityVariant(activity);
  
  let icon = null;
  
  // For buttons, always use the image icons
  if (isButton && styles.icon.defaultIcons[variant]) {
    icon = <img
      src={styles.icon.defaultIcons[variant]}
      alt={variant}
      width={64}
      height={64}
      className={cn("object-contain", styles.icon.base)}
    />;
  }
  // For timeline view, use Lucide icons (smaller icons)
  else if (!isButton) {
    if ('type' in activity) {
      if ('duration' in activity) {
        icon = <Moon className={cn(styles.icon.base, styles.icon.variants[variant])} />;
      } else if ('amount' in activity) {
        icon = <Icon iconNode={bottleBaby} className={cn(styles.icon.base, styles.icon.variants[variant])} />;
      } else if ('condition' in activity) {
        icon = <Icon iconNode={diaper} className={cn(styles.icon.base, styles.icon.variants[variant])} />;
      }
    } else if ('activities' in activity && 'startTime' in activity && 'type' in activity &&
      ['TUMMY_TIME', 'INDOOR_PLAY', 'OUTDOOR_PLAY', 'WALK', 'CUSTOM'].includes((activity as any).type)) {
      icon = (
        <div className="relative" style={{ width: '4rem', height: '4rem' }}>
          <Baby className="absolute top-0 left-0 h-8 w-8" style={{ color: '#F3C4A2' }} />
          <Activity className="absolute bottom-0 right-0 h-8 w-8" style={{ color: '#F3C4A2' }} />
        </div>
      );
    } else if ('vaccineName' in activity) {
      icon = <Syringe className="h-4 w-4" style={{ color: '#EF4444' }} />;
    } else if ('content' in activity) {
      icon = <Edit className={cn(styles.icon.base, styles.icon.variants[variant])} />;
    } else if ('leftAmount' in activity || 'rightAmount' in activity) {
      icon = <LampWallDown className={cn(styles.icon.base, styles.icon.variants[variant])} />;
    } else if ('title' in activity && 'category' in activity) {
      icon = <Trophy className={cn(styles.icon.base, styles.icon.variants[variant])} />;
    }
  }
  
  // If no icon is determined and we have a default icon for this variant, use it
  if (!icon && styles.icon.defaultIcons[variant]) {
    icon = <img
      src={styles.icon.defaultIcons[variant]}
      alt={variant}
      width={64}
      height={64}
      className={cn("object-contain", styles.icon.base)}
    />;
  }
  
  return (
    <div className={cn(
      styles.iconContainer.base,
      styles.iconContainer.variants[variant],
      className
    )}>
      {icon}
    </div>
  );
}