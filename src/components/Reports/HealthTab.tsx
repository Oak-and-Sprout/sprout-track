'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Accordion } from '@/src/components/ui/accordion';
import { styles } from './reports.styles';
import { useBaby } from '@/app/context/baby';
import {
  HealthTabProps,
  MedicineLogActivity,
  MedicineHealthStat,
  MeasurementActivity,
  VaccineRecord,
} from './reports.types';
import TemperatureStatsSection from './TemperatureStatsSection';
import MedicineStatsSection from './MedicineStatsSection';
import SupplementStatsSection from './SupplementStatsSection';
import VaccineStatsSection from './VaccineStatsSection';
import { useLocalization } from '@/src/context/localization';

// Helper to calculate age in months from birth date
const calculateAgeInMonths = (birthDate: string, measurementDate: string): number => {
  const birth = new Date(birthDate);
  const measurement = new Date(measurementDate);

  const years = measurement.getFullYear() - birth.getFullYear();
  const months = measurement.getMonth() - birth.getMonth();
  const days = measurement.getDate() - birth.getDate();

  let totalMonths = years * 12 + months;
  if (days < 0) {
    totalMonths -= 1;
  }

  const daysInMonth = new Date(measurement.getFullYear(), measurement.getMonth() + 1, 0).getDate();
  const dayFraction = (days >= 0 ? days : daysInMonth + days) / daysInMonth;

  return Math.max(0, totalMonths + dayFraction);
};

// Helper to compute consistency score: days with at least one dose / total days in range
const computeConsistency = (
  logs: MedicineLogActivity[],
  totalDaysInRange: number
): { consistencyScore: number; daysWithDoses: number } => {
  if (logs.length === 0 || totalDaysInRange <= 0) {
    return { consistencyScore: 0, daysWithDoses: 0 };
  }

  const uniqueDays = new Set<string>();
  logs.forEach((log) => {
    const dayKey = new Date(log.time).toLocaleDateString('en-CA');
    uniqueDays.add(dayKey);
  });

  const daysWithDoses = uniqueDays.size;
  const consistencyScore = (daysWithDoses / totalDaysInRange) * 100;

  return { consistencyScore, daysWithDoses };
};

/**
 * HealthTab Component
 *
 * Displays health-related statistics including temperature, medicines,
 * supplements, and vaccine history.
 */
const HealthTab: React.FC<HealthTabProps> = ({
  activities,
  dateRange,
  isLoading,
}) => {
  const { t } = useLocalization();
  const { selectedBaby } = useBaby();
  const [temperatureMeasurements, setTemperatureMeasurements] = useState<MeasurementActivity[]>([]);
  const [vaccineRecords, setVaccineRecords] = useState<VaccineRecord[]>([]);
  const [vaccinesLoading, setVaccinesLoading] = useState(false);

  // Split activities into medicines and supplements
  const { medicineActivities, supplementActivities } = useMemo(() => {
    const meds: MedicineLogActivity[] = [];
    const sups: MedicineLogActivity[] = [];

    activities.forEach((activity) => {
      if ('doseAmount' in activity && 'medicineId' in activity) {
        const medActivity = activity as MedicineLogActivity;
        if (medActivity.medicine?.isSupplement) {
          sups.push(medActivity);
        } else {
          meds.push(medActivity);
        }
      }
    });

    return { medicineActivities: meds, supplementActivities: sups };
  }, [activities]);

  // Compute medicine stats
  const { medicineStats, medicineTotalDoses, medicineAvgPerDay, medicineOverallConsistency } = useMemo(() => {
    if (!medicineActivities.length || !dateRange.from || !dateRange.to) {
      return { medicineStats: [], medicineTotalDoses: 0, medicineAvgPerDay: 0, medicineOverallConsistency: 0 };
    }

    const daysInRange = Math.max(1, Math.ceil(
      (new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / (1000 * 60 * 60 * 24)
    ));

    // Group by medicine
    const byMedicine: Record<string, MedicineLogActivity[]> = {};
    medicineActivities.forEach((a) => {
      const id = a.medicineId;
      if (!byMedicine[id]) byMedicine[id] = [];
      byMedicine[id].push(a);
    });

    const stats: MedicineHealthStat[] = [];

    Object.entries(byMedicine).forEach(([medicineId, logs]) => {
      const first = logs[0];
      const name = first.medicine?.name || 'Unknown';
      const unit = first.unitAbbr || first.medicine?.unitAbbr || '';
      const totalAmount = logs.reduce((sum, l) => sum + l.doseAmount, 0);
      const doseMinTime = first.medicine?.doseMinTime || null;

      const { consistencyScore, daysWithDoses } = computeConsistency(logs, daysInRange);

      stats.push({
        name,
        medicineId,
        count: logs.length,
        totalAmount,
        unit,
        avgDoseAmount: totalAmount / logs.length,
        doseMinTime,
        consistencyScore,
        daysWithDoses,
        totalDaysInRange: daysInRange,
      });
    });

    stats.sort((a, b) => b.count - a.count);

    // Overall consistency: total unique days with any medicine dose / total days
    const allMedicineDays = new Set<string>();
    medicineActivities.forEach((a) => {
      allMedicineDays.add(new Date(a.time).toLocaleDateString('en-CA'));
    });
    const overallConsistency = (allMedicineDays.size / daysInRange) * 100;

    return {
      medicineStats: stats,
      medicineTotalDoses: medicineActivities.length,
      medicineAvgPerDay: medicineActivities.length / daysInRange,
      medicineOverallConsistency: overallConsistency,
    };
  }, [medicineActivities, dateRange]);

  // Compute supplement stats
  const { supplementStats, supplementTotalDoses, supplementAvgPerDay, supplementOverallConsistency } = useMemo(() => {
    if (!supplementActivities.length || !dateRange.from || !dateRange.to) {
      return { supplementStats: [], supplementTotalDoses: 0, supplementAvgPerDay: 0, supplementOverallConsistency: 0 };
    }

    const daysInRange = Math.max(1, Math.ceil(
      (new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / (1000 * 60 * 60 * 24)
    ));

    const bySupp: Record<string, MedicineLogActivity[]> = {};
    supplementActivities.forEach((a) => {
      const id = a.medicineId;
      if (!bySupp[id]) bySupp[id] = [];
      bySupp[id].push(a);
    });

    const stats: MedicineHealthStat[] = [];

    Object.entries(bySupp).forEach(([medicineId, logs]) => {
      const first = logs[0];
      const name = first.medicine?.name || 'Unknown';
      const unit = first.unitAbbr || first.medicine?.unitAbbr || '';
      const totalAmount = logs.reduce((sum, l) => sum + l.doseAmount, 0);
      const doseMinTime = first.medicine?.doseMinTime || null;

      const { consistencyScore, daysWithDoses } = computeConsistency(logs, daysInRange);

      stats.push({
        name,
        medicineId,
        count: logs.length,
        totalAmount,
        unit,
        avgDoseAmount: totalAmount / logs.length,
        doseMinTime,
        consistencyScore,
        daysWithDoses,
        totalDaysInRange: daysInRange,
      });
    });

    stats.sort((a, b) => b.count - a.count);

    // Overall consistency: total unique days with any supplement dose / total days
    const allSuppDays = new Set<string>();
    supplementActivities.forEach((a) => {
      allSuppDays.add(new Date(a.time).toLocaleDateString('en-CA'));
    });
    const overallConsistency = (allSuppDays.size / daysInRange) * 100;

    return {
      supplementStats: stats,
      supplementTotalDoses: supplementActivities.length,
      supplementAvgPerDay: supplementActivities.length / daysInRange,
      supplementOverallConsistency: overallConsistency,
    };
  }, [supplementActivities, dateRange]);

  // Baby current age in months for temperature chart
  const babyCurrentAgeMonths = useMemo((): number => {
    if (!selectedBaby?.birthDate) return 12;

    const now = new Date();
    const birth = new Date(selectedBaby.birthDate);

    const years = now.getFullYear() - birth.getFullYear();
    const months = now.getMonth() - birth.getMonth();
    const days = now.getDate() - birth.getDate();

    let totalMonths = years * 12 + months;
    if (days < 0) {
      totalMonths -= 1;
    }

    const ageWithBuffer = Math.ceil(totalMonths + 1);
    return Math.max(3, Math.min(36, ageWithBuffer));
  }, [selectedBaby]);

  // Fetch temperature measurements
  useEffect(() => {
    const fetchTemperatures = async () => {
      if (!selectedBaby) {
        setTemperatureMeasurements([]);
        return;
      }

      try {
        const authToken = localStorage.getItem('authToken');
        const response = await fetch(
          `/api/measurement-log?babyId=${selectedBaby.id}&type=TEMPERATURE`,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authToken ? `Bearer ${authToken}` : '',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setTemperatureMeasurements((data.data || []) as MeasurementActivity[]);
          } else {
            setTemperatureMeasurements([]);
          }
        } else {
          setTemperatureMeasurements([]);
        }
      } catch {
        setTemperatureMeasurements([]);
      }
    };

    fetchTemperatures();
  }, [selectedBaby]);

  // Fetch vaccine records (all-time, no date filter)
  useEffect(() => {
    const fetchVaccines = async () => {
      if (!selectedBaby) {
        setVaccineRecords([]);
        return;
      }

      setVaccinesLoading(true);
      try {
        const authToken = localStorage.getItem('authToken');
        const response = await fetch(
          `/api/vaccine-log?babyId=${selectedBaby.id}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authToken ? `Bearer ${authToken}` : '',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const records = data.data || data;
          if (Array.isArray(records)) {
            records.sort((a: VaccineRecord, b: VaccineRecord) =>
              new Date(b.time).getTime() - new Date(a.time).getTime()
            );
            setVaccineRecords(records);
          } else {
            setVaccineRecords([]);
          }
        } else {
          setVaccineRecords([]);
        }
      } catch {
        setVaccineRecords([]);
      } finally {
        setVaccinesLoading(false);
      }
    };

    fetchVaccines();
  }, [selectedBaby]);

  // Temperature data for chart
  const temperatureData = useMemo(() => {
    if (!selectedBaby?.birthDate) return [];

    const birthStr = selectedBaby.birthDate!.toString();

    return temperatureMeasurements
      .map((m) => {
        const ageMonths = calculateAgeInMonths(birthStr, m.date);
        return {
          ageMonths,
          value: m.value,
          unit: m.unit,
        };
      })
      .filter((point) => point.ageMonths >= 0 && point.ageMonths <= babyCurrentAgeMonths)
      .sort((a, b) => a.ageMonths - b.ageMonths);
  }, [temperatureMeasurements, selectedBaby, babyCurrentAgeMonths]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn(styles.loadingContainer, "reports-loading-container")}>
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        <p className={cn(styles.loadingText, "reports-loading-text")}>{t('Loading statistics...')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Accordion type="multiple" defaultValue={['temperature', 'medicines', 'supplements', 'vaccines']}>
        {/* Temperature Section */}
        <TemperatureStatsSection
          temperatureData={temperatureData}
          babyCurrentAgeMonths={babyCurrentAgeMonths}
        />

        {/* Medicine Section */}
        <MedicineStatsSection
          medicineStats={medicineStats}
          totalDoses={medicineTotalDoses}
          avgDosesPerDay={medicineAvgPerDay}
          overallConsistency={medicineOverallConsistency}
          medicineActivities={medicineActivities}
          dateRange={dateRange}
        />

        {/* Supplement Section */}
        <SupplementStatsSection
          supplementStats={supplementStats}
          totalDoses={supplementTotalDoses}
          avgDosesPerDay={supplementAvgPerDay}
          overallConsistency={supplementOverallConsistency}
          supplementActivities={supplementActivities}
          dateRange={dateRange}
        />

        {/* Vaccine Section */}
        <VaccineStatsSection
          vaccineRecords={vaccineRecords}
          isLoading={vaccinesLoading}
        />
      </Accordion>
    </div>
  );
};

export default HealthTab;
