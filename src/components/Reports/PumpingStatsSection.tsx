'use client';

import React, { useState, useEffect } from 'react';
import { LampWallDown } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Card, CardContent } from '@/src/components/ui/card';
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/src/components/ui/accordion';
import { styles } from './reports.styles';
import { PumpStats, ActivityType, DateRange } from './reports.types';
import PumpingChartModal, { PumpingChartMetric } from './PumpingChartModal';
import { useLocalization } from '@/src/context/localization';
import { useBaby } from '@/app/context/baby';

interface PumpingStatsSectionProps {
  stats: PumpStats;
  activities: ActivityType[];
  dateRange: DateRange;
}

// Helper function to format minutes into hours and minutes
const formatMinutes = (minutes: number): string => {
  if (minutes === 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

/**
 * PumpingStatsSection Component
 *
 * Displays pumping statistics including pumps per day, duration, and amounts.
 */
const PumpingStatsSection: React.FC<PumpingStatsSectionProps> = ({ stats, activities, dateRange }) => {
  const { t } = useLocalization();
  const { selectedBaby } = useBaby();
  const [chartModalOpen, setChartModalOpen] = useState(false);
  const [chartMetric, setChartMetric] = useState<PumpingChartMetric | null>(null);
  const [currentBalance, setCurrentBalance] = useState<{ balance: number; unit: string } | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!selectedBaby) {
        setCurrentBalance(null);
        return;
      }
      try {
        const authToken = localStorage.getItem('authToken');
        const response = await fetch(
          `/api/breast-milk-balance?babyId=${selectedBaby.id}&unit=${stats.unit}`,
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
            setCurrentBalance(data.data);
          }
        }
      } catch {
        // Silently fail - balance card just won't show
      }
    };
    fetchBalance();
  }, [selectedBaby, stats.unit]);

  return (
    <>
      <AccordionItem value="pumping">
        <AccordionTrigger className={cn(styles.accordionTrigger, "reports-accordion-trigger")}>
          <LampWallDown className={cn(styles.accordionTriggerIcon, "reports-accordion-trigger-icon reports-icon-pump")} />
          <span>{t('Pumping Statistics')}</span>
        </AccordionTrigger>
        <AccordionContent className={styles.accordionContent}>
          <div className={styles.statsGrid}>
            <Card
              className={cn(styles.statCard, "reports-stat-card cursor-pointer")}
              onClick={() => {
                setChartMetric('count');
                setChartModalOpen(true);
              }}
            >
              <CardContent className="p-4">
                <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                  {stats.pumpsPerDay.toFixed(1)}
                </div>
                <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>{t('Pumps per Day')}</div>
              </CardContent>
            </Card>

            <Card
              className={cn(styles.statCard, "reports-stat-card cursor-pointer")}
              onClick={() => {
                setChartMetric('duration');
                setChartModalOpen(true);
              }}
            >
              <CardContent className="p-4">
                <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                  {formatMinutes(stats.avgDurationMinutes)}
                </div>
                <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>{t('Avg Pump Duration')}</div>
              </CardContent>
            </Card>

            <Card
              className={cn(styles.statCard, "reports-stat-card cursor-pointer")}
              onClick={() => {
                setChartMetric('amount');
                setChartModalOpen(true);
              }}
            >
              <CardContent className="p-4">
                <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                  {t('Left:')} {stats.avgLeftAmount.toFixed(1)} {stats.unit}
                </div>
                <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                  {t('Right:')} {stats.avgRightAmount.toFixed(1)} {stats.unit}
                </div>
                <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>{t('Avg Amount per Side')}</div>
              </CardContent>
            </Card>

            {currentBalance && (
              <Card
                className={cn(styles.statCard, "reports-stat-card cursor-pointer")}
                onClick={() => {
                  setChartMetric('inventory');
                  setChartModalOpen(true);
                }}
              >
                <CardContent className="p-4">
                  <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                    {currentBalance.balance.toFixed(1)} {currentBalance.unit.toLowerCase()}
                  </div>
                  <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>{t('Current Balance')}</div>
                </CardContent>
              </Card>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Pumping chart modal */}
      <PumpingChartModal
        open={chartModalOpen}
        onOpenChange={(open) => {
          setChartModalOpen(open);
          if (!open) {
            setChartMetric(null);
          }
        }}
        metric={chartMetric}
        activities={activities}
        dateRange={dateRange}
        currentBalance={currentBalance}
      />
    </>
  );
};

export default PumpingStatsSection;

