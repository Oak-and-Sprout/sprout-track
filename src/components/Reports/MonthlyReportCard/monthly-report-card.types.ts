/**
 * Types for the Monthly Report Card component
 */
import type { MonthlyReport } from '@/app/api/types';

export type { MonthlyReport };

export interface MonthlyReportCardProps {
  className?: string;
}

export interface MonthSelectorProps {
  selectedMonth: Date;
  onMonthChange: (date: Date) => void;
  birthDate: Date;
  daysTracked: number;
  daysInMonth: number;
  isCurrentMonth: boolean;
  elapsedDays: number;
  hideArrows?: boolean;
}

export interface SectionProps {
  className?: string;
}

export interface GrowthSummarySectionProps extends SectionProps {
  growth: MonthlyReport['growth'];
  babyName: string;
  isPdfExport?: boolean;
}

export interface FeedingSectionProps extends SectionProps {
  feeding: MonthlyReport['feeding'];
}

export interface SleepSectionProps extends SectionProps {
  sleep: MonthlyReport['sleep'];
  isPdfExport?: boolean;
}

export interface DiapersSectionProps extends SectionProps {
  diapers: MonthlyReport['diapers'];
}

export interface ActivitySectionProps extends SectionProps {
  activity: MonthlyReport['activity'];
}

export interface MilestonesSectionProps extends SectionProps {
  milestones: MonthlyReport['milestones'];
}

export interface HealthSectionProps extends SectionProps {
  health: MonthlyReport['health'];
}

export interface CaretakerSectionProps extends SectionProps {
  caretakers: MonthlyReport['caretakers'];
}
