import { ActivityType } from '../ui/activity-tile/activity-tile.types';

/**
 * Props for the DailyStats component
 */
export interface DailyStatsProps {
  /** List of activities to display statistics for */
  activities: ActivityType[];

  /** Date for which to display statistics */
  date: Date;

  /** Whether the component is in a loading state */
  isLoading?: boolean;

  /** Optional breast milk balance to display (e.g., "12.5 oz") */
  breastMilkBalance?: string;
}

/**
 * Props for the StatItem subcomponent
 */
export interface StatItemProps {
  /** Icon to display with the stat */
  icon: React.ReactNode;
  
  /** Label for the stat */
  label: string;
  
  /** Value of the stat */
  value: string;
}

/**
 * Props for the StatsTicker subcomponent
 */
export interface StatsTickerProps {
  /** Array of stats to display in the ticker */
  stats: {
    /** Icon to display with the stat */
    icon: React.ReactNode;
    
    /** Label for the stat */
    label: string;
    
    /** Value of the stat */
    value: string;
  }[];
}
