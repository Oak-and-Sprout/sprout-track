'use client';

import React, { useState } from 'react';
import { Icon } from 'lucide-react';
import { diaper } from '@lucide/lab';
import { cn } from '@/src/lib/utils';
import { Card, CardContent } from '@/src/components/ui/card';
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/src/components/ui/accordion';
import { styles } from './reports.styles';
import { DiaperStats, ActivityType, DateRange } from './reports.types';
import DiaperChartModal, { DiaperChartMetric } from './DiaperChartModal';
import { useLocalization } from '@/src/context/localization';

interface DiaperStatsSectionProps {
  stats: DiaperStats;
  activities: ActivityType[];
  dateRange: DateRange;
}

/**
 * DiaperStatsSection Component
 *
 * Displays diaper statistics including wet and poopy diaper counts.
 */
const DiaperStatsSection: React.FC<DiaperStatsSectionProps> = ({ stats, activities, dateRange }) => {
  const { t } = useLocalization();
  const [chartModalOpen, setChartModalOpen] = useState(false);
  const [chartMetric, setChartMetric] = useState<DiaperChartMetric | null>(null);

  return (
    <>
      <AccordionItem value="diaper">
        <AccordionTrigger className={cn(styles.accordionTrigger, "reports-accordion-trigger")}>
          <Icon iconNode={diaper} className={cn(styles.accordionTriggerIcon, "reports-accordion-trigger-icon reports-icon-diaper-wet")} />
          <span>{t('Diaper Statistics')}</span>
        </AccordionTrigger>
        <AccordionContent className={styles.accordionContent}>
          <div className={styles.statsGrid}>
            <Card
              className={cn(styles.statCard, "reports-stat-card cursor-pointer")}
              onClick={() => {
                setChartMetric('wet');
                setChartModalOpen(true);
              }}
            >
              <CardContent className="p-4">
                <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                  {stats.wetCount}
                </div>
                <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>{t('Wet Diapers')}</div>
                <div className={cn(styles.statCardSubLabel, "reports-stat-card-sublabel")}>
                  {stats.avgWetPerDay}/day avg
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn(styles.statCard, "reports-stat-card cursor-pointer")}
              onClick={() => {
                setChartMetric('poopy');
                setChartModalOpen(true);
              }}
            >
              <CardContent className="p-4">
                <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                  {stats.poopCount}
                </div>
                <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>{t('Poopy Diapers')}</div>
                <div className={cn(styles.statCardSubLabel, "reports-stat-card-sublabel")}>
                  {stats.avgPoopPerDay}/day avg
                </div>
              </CardContent>
            </Card>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Diaper chart modal */}
      <DiaperChartModal
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
      />
    </>
  );
};

export default DiaperStatsSection;

