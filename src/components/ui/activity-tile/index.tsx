import { cn } from "@/src/lib/utils";
import { activityTileStyles as styles } from './activity-tile.styles';
import { ActivityTileProps, ActivityType } from './activity-tile.types';
import { getActivityVariant } from './activity-tile-utils';
import { ActivityTileIcon } from './activity-tile-icon';
import { ActivityTileContent } from './activity-tile-content';
import { useTheme } from '@/src/context/theme';
import './activity-tile.css';

/**
 * ActivityTile component displays an activity in a consistent, styled manner
 *
 * This component is designed to be used in lists of activities, such as in the Timeline component.
 * It follows the project's UI component patterns and is highly configurable through props.
 *
 * @example
 * ```tsx
 * <ActivityTile
 *   activity={sleepActivity}
 *   onClick={() => handleActivityClick(sleepActivity)}
 * />
 * ```
 */
export function ActivityTile({
  activity,
  onClick,
  icon,
  title,
  description,
  variant: variantProp,
  className,
  isButton = false
}: Readonly<ActivityTileProps>) {
  useTheme();
  const variant = variantProp || getActivityVariant(activity);

  return (
    <button
      className={cn(
        styles.base,
        isButton && styles.button.base,
        isButton && styles.button.variants[variant],
        className
      )}
      onClick={onClick}
    >
      {isButton ? (
        <div className="flex flex-col items-center justify-center h-full w-full">
          <div className={cn(
            "relative overflow-visible flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-active:rotate-12",
            styles.iconContainer.base,
            styles.iconContainer.variants[variant]
          )} aria-hidden="true">
            {icon || <ActivityTileIcon activity={activity} variant={variant} isButton={isButton} />}
          </div>
          {title && (
            <span className="text-xs font-medium mt-1 text-center activity-tile-title">
              {title}
            </span>
          )}
        </div>
      ) : (
        <div className={styles.container}>
          {icon || <ActivityTileIcon activity={activity} variant={variant} isButton={isButton} />}
          <ActivityTileContent
            activity={activity}
            title={title}
            description={description}
          />
        </div>
      )}
    </button>
  );
}

export {type ActivityTileProps, type ActivityType} from './activity-tile.types';