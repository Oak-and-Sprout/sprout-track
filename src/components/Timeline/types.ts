import { Settings } from '@prisma/client';
import { ActivityType as ImportedActivityType } from '@/src/components/ui/activity-tile/activity-tile.types';

// Define the extended ActivityType that includes caretaker information
export type TimelineActivityType = ImportedActivityType & {
  caretakerId?: string | null;
  caretakerName?: string;
};

// Use TimelineActivityType for internal component logic
export type ActivityType = TimelineActivityType;

export type FilterType = 'sleep' | 'feed' | 'diaper' | 'poop' | 'medicine' | 'note' | 'bath' | 'pump' | 'milestone' | 'measurement' | null;

export interface TimelineProps {
  activities: ImportedActivityType[];
  onActivityDeleted?: (dateFilter?: Date) => void;
}

export interface TimelineFilterProps {
  selectedDate: Date;
  activeFilter: FilterType;
  onDateChange: (days: number) => void;
  onDateSelection: (date: Date) => void;
  onFilterChange: (filter: FilterType) => void;
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
  onEdit: (activity: ActivityType, type: 'sleep' | 'feed' | 'diaper' | 'medicine' | 'note' | 'bath' | 'pump' | 'milestone' | 'measurement') => void;
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
