'use client';

import React, { useState } from 'react';
import { PillBottle } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Card, CardContent } from '@/src/components/ui/card';
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/src/components/ui/accordion';
import { styles } from './reports.styles';
import { MedicineHealthStat, MedicineLogActivity, DateRange } from './reports.types';
import HealthChartModal from './HealthChartModal';
import { useLocalization } from '@/src/context/localization';

interface MedicineStatsSectionProps {
  medicineStats: MedicineHealthStat[];
  totalDoses: number;
  avgDosesPerDay: number;
  overallConsistency: number;
  medicineActivities: MedicineLogActivity[];
  dateRange: DateRange;
}

/**
 * MedicineStatsSection Component
 *
 * Displays medicine statistics with stat cards and per-medicine breakdown.
 */
const MedicineStatsSection: React.FC<MedicineStatsSectionProps> = ({
  medicineStats,
  totalDoses,
  avgDosesPerDay,
  overallConsistency,
  medicineActivities,
  dateRange,
}) => {
  const { t } = useLocalization();
  const [chartModalOpen, setChartModalOpen] = useState(false);

  const uniqueCount = medicineStats.length;

  return (
    <>
      <AccordionItem value="medicines">
        <AccordionTrigger className={cn(styles.accordionTrigger, "reports-accordion-trigger")}>
          <PillBottle className={cn(styles.accordionTriggerIcon, "reports-accordion-trigger-icon reports-icon-medicine")} />
          <span>{t('Medicine Statistics')}</span>
        </AccordionTrigger>
        <AccordionContent className={styles.accordionContent}>
          {totalDoses === 0 ? (
            <div className={cn(styles.emptyContainer, "reports-empty-container")}>
              <p className={cn(styles.emptyText, "reports-empty-text")}>
                {t('No medicines recorded in this date range.')}
              </p>
            </div>
          ) : (
            <>
              <div className={styles.statsGrid}>
                <Card
                  className={cn(styles.statCard, "reports-stat-card cursor-pointer")}
                  onClick={() => setChartModalOpen(true)}
                >
                  <CardContent className="p-4">
                    <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                      {totalDoses}
                    </div>
                    <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>{t('Total Doses Given')}</div>
                  </CardContent>
                </Card>

                <Card className={cn(styles.statCard, "reports-stat-card")}>
                  <CardContent className="p-4">
                    <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                      {uniqueCount}
                    </div>
                    <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>{t('Unique Medicines')}</div>
                  </CardContent>
                </Card>

                <Card
                  className={cn(styles.statCard, "reports-stat-card cursor-pointer")}
                  onClick={() => setChartModalOpen(true)}
                >
                  <CardContent className="p-4">
                    <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                      {avgDosesPerDay.toFixed(1)}
                    </div>
                    <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>{t('Avg Doses/Day')}</div>
                  </CardContent>
                </Card>

                <Card
                  className={cn(styles.statCard, "reports-stat-card cursor-pointer")}
                  onClick={() => setChartModalOpen(true)}
                >
                  <CardContent className="p-4">
                    <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                      {Math.round(overallConsistency)}%
                    </div>
                    <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>{t('Overall Consistency')}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Per-medicine breakdown */}
              <div className="mt-4 space-y-2">
                {medicineStats.map((med) => (
                  <div
                    key={med.medicineId}
                    className="rounded-md border border-gray-200 bg-white p-3 reports-medicine-item"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-gray-800 reports-medicine-name">{med.name}</span>
                      <span className="text-sm text-gray-500 reports-medicine-details">
                        {med.count} {t('Doses')} &middot; {med.daysWithDoses}/{med.totalDaysInRange} {t('Days')}
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-500 reports-medicine-details">{t('Consistency')}</span>
                        <span className="text-gray-600 font-medium reports-medicine-details">
                          {Math.round(med.consistencyScore)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full reports-health-consistency-bar">
                        <div
                          className="h-2 rounded-full bg-teal-500 reports-health-consistency-fill"
                          style={{ width: `${Math.min(100, med.consistencyScore)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </AccordionContent>
      </AccordionItem>

      <HealthChartModal
        open={chartModalOpen}
        onOpenChange={setChartModalOpen}
        medicineActivities={medicineActivities}
        dateRange={dateRange}
      />
    </>
  );
};

export default MedicineStatsSection;
