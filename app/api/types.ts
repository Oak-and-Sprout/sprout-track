import { Baby, SleepLog, FeedLog, DiaperLog, MoodLog, Note, Caretaker, Settings as PrismaSettings, Gender, SleepType, SleepQuality, FeedType, BreastSide, DiaperType, Mood, PumpLog, Milestone, MilestoneCategory, Measurement, MeasurementType, Medicine, MedicineLog, EmailConfig as PrismaEmailConfig, EmailProviderType } from '@prisma/client';

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
}

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
  notes?: string;
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
