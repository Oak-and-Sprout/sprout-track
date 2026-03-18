import { Settings } from '@prisma/client';
import { ActivityType as ImportedActivityType } from '@/src/components/ui/activity-tile/activity-tile.types';

// Define the extended ActivityType that includes caretaker information
export type FullLogActivityType = ImportedActivityType & {
  caretakerId?: string | null;
  caretakerName?: string;
};

// Use FullLogActivityType for internal component logic
export type ActivityType = FullLogActivityType;

export type FilterType = 'sleep' | 'feed' | 'diaper' | 'note' | 'bath' | 'pump' | 'breast-milk-adjustment' | 'milestone' | 'measurement' | 'medicine' | 'play' | 'vaccine' | null;

export interface FullLogTimelineProps {
  activities: ImportedActivityType[];
  onActivityDeleted?: () => void;
  startDate: Date;
  endDate: Date;
  onDateRangeChange: (startDate: Date, endDate: Date) => void;
}

export interface FullLogFilterProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  startDate: Date;
  endDate: Date;
  onDateRangeChange: (startDate: Date, endDate: Date) => void;
  onQuickFilter: (days: number) => void;
  enableBreastMilkTracking?: boolean;
}

export interface FullLogSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export interface FullLogActivityListProps {
  activities: ActivityType[];
  settings: Settings | null;
  isLoading: boolean;
  itemsPerPage: number;
  currentPage: number;
  totalPages: number;
  onActivitySelect: (activity: ActivityType) => void;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
}

export interface FullLogActivityDetailsProps {
  activity: ActivityType | null;
  settings: Settings | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (activity: ActivityType) => void;
  onEdit: (activity: ActivityType, type: 'sleep' | 'feed' | 'diaper' | 'note' | 'bath' | 'pump' | 'breast-milk-adjustment' | 'milestone' | 'measurement' | 'medicine' | 'play' | 'vaccine') => void;
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
