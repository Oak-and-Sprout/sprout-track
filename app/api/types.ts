import { Baby, SleepLog, FeedLog, DiaperLog, MoodLog, Note, Caretaker, Settings as PrismaSettings, Gender, SleepType, SleepQuality, FeedType, BreastSide, DiaperType, Mood, PumpLog, PlayLog, Milestone, MilestoneCategory, Measurement, MeasurementType, Medicine, MedicineLog, EmailConfig as PrismaEmailConfig, EmailProviderType, BreastMilkAdjustment, ActiveBreastFeed, ActiveActivity, VaccineLog, VaccineDocument } from '@prisma/client';

// Family types
export interface Family {
  id: string;
  slug: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export type FamilyResponse = Omit<Family, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

// Extended family response for management with counts
export type FamilyManagementResponse = FamilyResponse & {
  caretakerCount: number;
  babyCount: number;
};

export interface FamilyCreate {
  name: string;
  slug: string;
  isActive?: boolean;
}

export interface FamilyUpdate extends Partial<FamilyCreate> {
  id: string;
}

// Settings types
export interface Settings extends PrismaSettings {
  // No need to redefine properties that are already in PrismaSettings
}

// Activity settings types
export interface ActivitySettings {
  order: string[];
  visible: string[];
  caretakerId?: string | null; // Optional caretaker ID for per-caretaker settings
}

// Sleep location settings types
export interface SleepLocationSettings {
  hiddenLocations: string[];
}

export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// Baby types
export type BabyResponse = Omit<Baby, 'birthDate' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  birthDate: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  feedWarningTime: string;
  diaperWarningTime: string;
};

export interface BabyCreate {
  firstName: string;
  lastName: string;
  birthDate: string;
  gender?: Gender;
  inactive?: boolean;
  feedWarningTime?: string;
  diaperWarningTime?: string;
}

export interface BabyUpdate extends Partial<BabyCreate> {
  id: string;
}

// Sleep log types
export type SleepLogResponse = Omit<SleepLog, 'startTime' | 'endTime' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  startTime: string;
  endTime: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export interface SleepLogCreate {
  babyId: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  type: SleepType;
  location?: string;
  quality?: SleepQuality;
}

// Feed log types
export type FeedLogResponse = Omit<FeedLog, 'time' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  time: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  notes?: string | null;
  bottleType?: string | null;
};

export interface FeedLogCreate {
  babyId: string;
  time: string;
  type: FeedType;
  amount?: number;
  unitAbbr?: string;
  side?: BreastSide;
  food?: string;
  startTime?: string;
  endTime?: string;
  feedDuration?: number; // Duration in seconds for feeding time
  notes?: string;
  bottleType?: string;
  breastMilkAmount?: number;
}

// Active breastfeed session types
export type ActiveBreastFeedResponse = Omit<ActiveBreastFeed, 'currentSideStartTime' | 'sessionStartTime' | 'createdAt' | 'updatedAt'> & {
  currentSideStartTime: string | null;
  sessionStartTime: string;
  createdAt: string;
  updatedAt: string;
};

// Active activity session types
export type ActiveActivityResponse = Omit<ActiveActivity, 'currentStartTime' | 'sessionStartTime' | 'createdAt' | 'updatedAt'> & {
  currentStartTime: string | null;
  sessionStartTime: string;
  createdAt: string;
  updatedAt: string;
};

// Diaper log types
export type DiaperLogResponse = Omit<DiaperLog, 'time' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  time: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export interface DiaperLogCreate {
  babyId: string;
  time: string;
  type: DiaperType;
  condition?: string;
  color?: string;
  blowout?: boolean;
  creamApplied?: boolean;
}

// Mood log types
export type MoodLogResponse = Omit<MoodLog, 'time' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  time: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export interface MoodLogCreate {
  babyId: string;
  time: string;
  mood: Mood;
  intensity?: number;
  duration?: number;
}

// Note types
export type NoteResponse = Omit<Note, 'time' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  time: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export interface NoteCreate {
  babyId: string;
  time: string;
  content: string;
  category?: string;
}

// Caretaker types
export type CaretakerResponse = Omit<Caretaker, 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export interface CaretakerCreate {
  loginId: string;
  name: string;
  type?: string;
  inactive?: boolean;
  securityPin: string;
}

export interface CaretakerUpdate extends Partial<CaretakerCreate> {
  id: string;
}

// EmailConfig types
export type EmailConfigResponse = Omit<PrismaEmailConfig, 'updatedAt' | 'password'> & {
  updatedAt: string;
  password?: string;
};

export interface EmailConfigUpdate extends Partial<Omit<PrismaEmailConfig, 'id' | 'updatedAt'>> {
  // All fields are optional for update
}

// Bath log types
export interface BathLog {
  id: string;
  time: Date;
  soapUsed: boolean;
  shampooUsed: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  babyId: string;
  caretakerId: string | null;
}

export type BathLogResponse = Omit<BathLog, 'time' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  time: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export interface BathLogCreate {
  babyId: string;
  time: string;
  soapUsed?: boolean;
  shampooUsed?: boolean;
  notes?: string;
  caretakerId?: string | null;
}

// Play log types
export type PlayLogResponse = Omit<PlayLog, 'startTime' | 'endTime' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  startTime: string;
  endTime: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export interface PlayLogCreate {
  babyId: string;
  startTime: string;
  duration?: number;
  type: string;
  notes?: string;
  activities?: string;
}

// Pump log types
export type PumpLogResponse = Omit<PumpLog, 'startTime' | 'endTime' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  startTime: string;
  endTime: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export interface PumpLogCreate {
  babyId: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  leftAmount?: number;
  rightAmount?: number;
  totalAmount?: number;
  unitAbbr?: string;
  pumpAction?: string; // "STORED" | "FED" | "DISCARDED"
  notes?: string;
}

// Breast milk adjustment types
export type BreastMilkAdjustmentResponse = Omit<BreastMilkAdjustment, 'time' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  time: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export interface BreastMilkAdjustmentCreate {
  babyId: string;
  time: string;
  amount: number; // Positive = add, negative = remove
  unitAbbr?: string;
  reason?: string; // "Initial Stock", "Expired", "Spilled", "Donated", "Other"
  notes?: string;
}

// Breast milk balance response
export interface BreastMilkBalanceResponse {
  balance: number;
  unit: string;
}

// Milestone types
export type MilestoneResponse = Omit<Milestone, 'date' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  date: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export interface MilestoneCreate {
  babyId: string;
  date: string;
  title: string;
  description?: string;
  category: MilestoneCategory;
  ageInDays?: number;
  photo?: string;
}

// Measurement types
export type MeasurementResponse = Omit<Measurement, 'date' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  date: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export interface MeasurementCreate {
  babyId: string;
  date: string;
  type: MeasurementType;
  value: number;
  unit: string;
  notes?: string;
}

// Medicine types
export type MedicineResponse = Omit<Medicine, 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export interface MedicineCreate {
  name: string;
  typicalDoseSize?: number;
  unitAbbr?: string;
  doseMinTime?: string;
  notes?: string;
  active?: boolean;
  isSupplement?: boolean;
  contactIds?: string[]; // IDs of contacts to associate with this medicine
}

export interface MedicineUpdate extends Partial<MedicineCreate> {
  id: string;
}

// Medicine log types
export type MedicineLogResponse = Omit<MedicineLog, 'time' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  time: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export interface MedicineLogCreate {
  babyId: string;
  medicineId: string;
  time: string;
  doseAmount: number;
  unitAbbr?: string | null;
  notes?: string;
}

// Vaccine log types
export type VaccineLogResponse = Omit<VaccineLog, 'time' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  time: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  documents?: VaccineDocumentResponse[];
  contacts?: { contact: { id: string; name: string; role: string } }[];
};

export type VaccineDocumentResponse = {
  id: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
};

export interface VaccineLogCreate {
  babyId: string;
  time: string;
  vaccineName: string;
  doseNumber?: number;
  notes?: string;
  contactIds?: string[];
}

// Beta Subscriber types
export interface BetaSubscriberResponse {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isOptedIn: boolean;
  optedOutAt: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface BetaSubscriberUpdate {
  isOptedIn?: boolean;
}

// Feedback types
export interface FeedbackResponse {
  id: string;
  subject: string;
  message: string;
  submittedAt: string;
  viewed: boolean;
  submitterName: string | null;
  submitterEmail: string | null;
  familyId: string | null;
  familySlug: string | null;
  parentId: string | null;
  replies?: FeedbackResponse[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface FeedbackCreate {
  subject: string;
  message: string;
  familyId?: string | null;
  parentId?: string | null;
  submitterName?: string;
  submitterEmail?: string | null;
}

export interface FeedbackUpdate {
  viewed?: boolean;
}

// Monthly Report Card types
export interface MonthlyReport {
  baby: {
    id: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    gender: 'MALE' | 'FEMALE' | null;
    ageAtEndOfMonth: { months: number; days: number };
  };
  period: {
    year: number;
    month: number;
    daysInMonth: number;
    daysTracked: number;
    isCurrentMonth: boolean;
  };
  growth: {
    weight: GrowthMetric | null;
    length: GrowthMetric | null;
    headCircumference: GrowthMetric | null;
    velocity: { value: number; unit: string } | null;
    chartData: {
      weight: GrowthChartData;
      length: GrowthChartData;
      headCircumference: GrowthChartData;
    };
  };
  feeding: {
    avgBottlesPerDay: number;
    avgBottleSize: { value: number; unit: string };
    avgDailyIntake: { value: number; unit: string };
    dailyIntakeDelta: { value: number; direction: 'up' | 'down' | 'stable' } | null;
    avgSolidsPerDay: number;
    breastfeeding: {
      avgSessionsPerDay: number;
      avgLeftDuration: number;
      avgRightDuration: number;
    } | null;
    breakdown: {
      bottle: number;
      breast: number;
      solids: number;
    };
  };
  sleep: {
    avgTotalPerDay: number;
    avgNightSleep: number;
    avgNapsPerDay: number;
    longestStretch: number;
    qualityDistribution: {
      excellent: number;
      good: number;
      fair: number;
      poor: number;
    };
    locationDistribution: {
      location: string;
      nightCount: number;
      napCount: number;
    }[];
  };
  diapers: {
    avgChangesPerDay: number;
    avgDirtyPerDay: number;
    blowoutCount: number;
    creamApplicationRate: number;
    colorFlags: {
      date: string;
      color: string;
    }[];
  };
  activity: {
    avgTummyTimePerDay: number;
    tummyTimeDelta: { value: number; direction: 'up' | 'down' | 'stable' } | null;
    avgOutdoorTimePerDay: number;
    bathCount: number;
    avgBathInterval: number;
  };
  milestones: {
    id: string;
    date: string;
    title: string;
    description: string | null;
    category: 'MOTOR' | 'COGNITIVE' | 'SOCIAL' | 'LANGUAGE' | 'CUSTOM';
  }[];
  health: {
    supplements: {
      name: string;
      daysAdministered: number;
      totalDays: number;
      compliancePercent: number;
    }[];
    medicines: {
      name: string;
      totalAdministrations: number;
    }[];
    vaccines: {
      name: string;
      doseNumber: number | null;
      date: string;
    }[];
  };
  caretakers: {
    name: string;
    totalLogs: number;
    percentage: number;
  }[];
}

export interface GrowthChartData {
  points: GrowthChartPoint[];
}

export interface GrowthChartPoint {
  ageMonths: number;
  p3: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p97: number;
  measurement?: number;
  measurementDate?: string;
  percentile?: number;
}

export interface GrowthMetric {
  value: number;
  unit: string;
  percentile: number;
  trend: 'up' | 'down' | 'stable';
}
