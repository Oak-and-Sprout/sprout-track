import { ReactNode } from 'react';

/**
 * Types for the Reports component
 */

// Activity types from the timeline API
export interface SleepActivity {
  id: string;
  babyId: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  type: 'NAP' | 'NIGHT_SLEEP';
  location: string | null;
  quality: string | null;
  caretakerId: string | null;
  caretakerName?: string;
}

export interface FeedActivity {
  id: string;
  babyId: string;
  time: string;
  type: 'BOTTLE' | 'BREAST' | 'SOLIDS';
  amount: number | null;
  unitAbbr: string | null;
  side: 'LEFT' | 'RIGHT' | null;
  food: string | null;
  feedDuration: number | null;
  notes: string | null;
  bottleType: string | null;
  caretakerId: string | null;
  caretakerName?: string;
}

export interface DiaperActivity {
  id: string;
  babyId: string;
  time: string;
  type: 'WET' | 'DIRTY' | 'BOTH';
  condition: string | null;
  color: string | null;
  blowout: boolean;
  caretakerId: string | null;
  caretakerName?: string;
}

export interface NoteActivity {
  id: string;
  babyId: string;
  time: string;
  content: string;
  category: string | null;
  caretakerId: string | null;
  caretakerName?: string;
}

export interface BathActivity {
  id: string;
  babyId: string;
  time: string;
  soapUsed: boolean;
  shampooUsed: boolean;
  notes: string | null;
  caretakerId: string | null;
  caretakerName?: string;
}

export interface PumpActivity {
  id: string;
  babyId: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  leftAmount: number | null;
  rightAmount: number | null;
  totalAmount: number | null;
  unitAbbr: string | null;
  notes: string | null;
  caretakerId: string | null;
  caretakerName?: string;
}

export interface MilestoneActivity {
  id: string;
  babyId: string;
  date: string;
  title: string;
  description: string | null;
  category: string;
  ageInDays: number | null;
  photo: string | null;
  caretakerId: string | null;
  caretakerName?: string;
}

export interface MeasurementActivity {
  id: string;
  babyId: string;
  date: string;
  type: 'HEIGHT' | 'WEIGHT' | 'HEAD_CIRCUMFERENCE' | 'TEMPERATURE';
  value: number;
  unit: string;
  notes: string | null;
  caretakerId: string | null;
  caretakerName?: string;
}

export interface MedicineLogActivity {
  id: string;
  babyId: string;
  time: string;
  medicineId: string;
  doseAmount: number;
  unitAbbr: string | null;
  notes: string | null;
  caretakerId: string | null;
  caretakerName?: string;
  medicine?: {
    id: string;
    name: string;
    typicalDoseSize: number | null;
    unitAbbr: string | null;
    doseMinTime: string | null;
    notes: string | null;
    active: boolean;
  };
}

// Union type for all activities
export type ActivityType =
  | SleepActivity
  | FeedActivity
  | DiaperActivity
  | NoteActivity
  | BathActivity
  | PumpActivity
  | MilestoneActivity
  | MeasurementActivity
  | MedicineLogActivity;

// Tab types
export type ReportTab = 'stats' | 'milestones' | 'growth' | 'activity' | 'heatmaps';

// Date range type
export interface DateRange {
  from: Date | null;
  to: Date | null;
}

// Main Reports component props
export interface ReportsProps {
  className?: string;
}

// Stats Tab props
export interface StatsTabProps {
  activities: ActivityType[];
  dateRange: DateRange;
  isLoading: boolean;
}

// Placeholder tab props
export interface GrowthTrendsTabProps {
  dateRange: DateRange;
  isLoading: boolean;
}

export interface ActivityTabProps {
  activities: ActivityType[];
  dateRange: DateRange;
  isLoading: boolean;
}

export interface HeatmapsTabProps {
  activities: ActivityType[];
  dateRange: DateRange;
  isLoading: boolean;
}

// Milestones Tab props (fetches its own data)
export interface MilestonesTabProps {
  className?: string;
}

// Stat card data
export interface StatCardData {
  label: string;
  value: string | number;
  subLabel?: string;
  icon?: ReactNode;
}

// Location stats for sleep
export interface LocationStat {
  location: string;
  count: number;
  totalMinutes: number;
}

// Medicine stats
export interface MedicineStat {
  name: string;
  count: number;
  totalAmount: number;
  unit: string;
}

// Bottle average by type
export interface BottleAvgByType {
  type: string;
  avgAmount: number;
  unit: string;
  count: number;
}

// Solids average by food
export interface SolidsAvgByFood {
  food: string;
  avgAmount: number;
  unit: string;
  count: number;
}

// Feeding stats by type
export interface FeedingStats {
  totalFeeds: number;
  bottleFeeds: {
    count: number;
    amounts: Record<string, number>; // unit -> total amount
    avgByType: BottleAvgByType[];
  };
  breastFeeds: {
    count: number;
    leftMinutes: number;
    rightMinutes: number;
    leftCount: number;
    rightCount: number;
    avgLeftMinutes: number;
    avgRightMinutes: number;
  };
  solidsFeeds: {
    count: number;
    amounts: Record<string, number>; // unit -> total amount
    avgByFood: SolidsAvgByFood[];
  };
}

// Sleep stats
export interface SleepStats {
  totalSleepMinutes: number;
  avgNapMinutes: number;
  avgNightSleepMinutes: number;
  avgNightWakings: number;
  napLocations: LocationStat[];
  nightLocations: LocationStat[];
}

// Diaper stats
export interface DiaperStats {
  totalChanges: number;
  wetCount: number;
  poopCount: number;
  avgWetPerDay: number;
  avgPoopPerDay: number;
  daysInRange: number;
}

// Pumping stats
export interface PumpStats {
  pumpsPerDay: number;
  avgDurationMinutes: number;
  avgLeftAmount: number;
  avgRightAmount: number;
  unit: string;
}

// Bath stats
export interface BathStats {
  totalBaths: number;
  bathsPerWeek: number;
  soapShampooBathsPerWeek: number;
}

// Other activities stats
export interface OtherStats {
  noteCount: number;
  milestoneCount: number;
  measurementCount: number;
  medicines: MedicineStat[];
}

// Combined stats for the Stats Tab
export interface CombinedStats {
  sleep: SleepStats;
  feeding: FeedingStats;
  diaper: DiaperStats;
  other: OtherStats;
  pump: PumpStats;
  bath: BathStats;
}
