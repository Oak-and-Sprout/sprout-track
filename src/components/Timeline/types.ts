import { Settings } from '@prisma/client';
import { ActivityType as ImportedActivityType } from '@/src/components/ui/activity-tile/activity-tile.types';
import { SleepLogResponse } from '@/app/api/types';

// Define the extended ActivityType that includes caretaker information
export type TimelineActivityType = ImportedActivityType & {
  caretakerId?: string | null;
  caretakerName?: string;
};

// Use TimelineActivityType for internal component logic
export type ActivityType = TimelineActivityType;

export type FilterType = 'sleep' | 'feed' | 'diaper' | 'poop' | 'medicine' | 'note' | 'bath' | 'pump' | 'breast-milk-adjustment' | 'milestone' | 'measurement' | 'play' | 'vaccine' | null;

export interface LatestStatusData {
  lastFeedTime?: Date;
  lastDiaperTime?: Date;
  lastSleepEndTime?: Date;
  ongoingSleep?: SleepLogResponse;
  lastEndedSleep?: SleepLogResponse & { endTime: string };
}

// Legacy props for the old Timeline component (not actively used)
export interface LegacyTimelineProps {
  activities: ImportedActivityType[];
  onActivityDeleted?: (dateFilter?: Date) => void;
}

export interface TimelineProps {
  babyId: string;
  refreshTrigger?: number;
  onLatestStatusReady?: (data: LatestStatusData) => void;
  onActivityDeleted?: (dateFilter?: Date) => void;
}

export interface TimelineFilterProps {
  selectedDate: Date;
  activeFilter: FilterType;
  onDateChange: (days: number) => void;
  onDateSelection: (date: Date) => void;
  onFilterChange: (filter: FilterType) => void;
  enableBreastMilkTracking?: boolean;
}

export interface TimelineActivityListProps {
  activities: ActivityType[];
  settings: Settings | null;
  isLoading: boolean;
  isAnimated?: boolean;
  selectedDate?: Date;
  itemsPerPage?: number;
  currentPage?: number;
  totalPages?: number;
  onActivitySelect: (activity: ActivityType) => void;
  onPageChange?: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  onSwipeLeft?: () => void; // Handler for swiping left (next day)
  onSwipeRight?: () => void; // Handler for swiping right (previous day)
}

export interface TimelineActivityDetailsProps {
  activity: ActivityType | null;
  settings: Settings | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (activity: ActivityType) => void;
  onEdit: (activity: ActivityType, type: 'sleep' | 'feed' | 'diaper' | 'medicine' | 'note' | 'bath' | 'pump' | 'breast-milk-adjustment' | 'milestone' | 'measurement' | 'play' | 'vaccine') => void;
}

export interface ActivityDetail {
  label: string;
  value: string;
}

export interface ActivityDetails {
  title: string;
  details: ActivityDetail[];
}

export interface ActivityDescription {
  type: string;
  details: string;
}

export interface ActivityStyle {
  bg: string;
  textColor: string;
}
