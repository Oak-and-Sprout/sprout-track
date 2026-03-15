'use client';

import React, { useState } from 'react';
import { Baby } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Card, CardContent } from '@/src/components/ui/card';
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/src/components/ui/accordion';
import { styles } from './reports.styles';
import { PlayStats, ActivityType, DateRange } from './reports.types';
import PlayChartModal, { PlayChartMetric } from './PlayChartModal';
import { useLocalization } from '@/src/context/localization';

interface PlayStatsSectionProps {
  stats: PlayStats;
  activities: ActivityType[];
  dateRange: DateRange;
}

/**
 * PlayStatsSection Component
 *
 * Displays play/activity statistics with stat cards and per-type breakdown.
 */
const PlayStatsSection: React.FC<PlayStatsSectionProps> = ({ stats, activities, dateRange }) => {
  const { t } = useLocalization();
  const [chartModalOpen, setChartModalOpen] = useState(false);
  const [chartMetric, setChartMetric] = useState<PlayChartMetric | null>(null);

  const formatMinutes = (minutes: number): string => {
    if (minutes === 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  return (
    <>
      <AccordionItem value="activities">
        <AccordionTrigger className={cn(styles.accordionTrigger, "reports-accordion-trigger")}>
          <Baby className={cn(styles.accordionTriggerIcon, "reports-accordion-trigger-icon reports-icon-activity")} />
          <span>{t('Activity Statistics')}</span>
        </AccordionTrigger>
        <AccordionContent className={styles.accordionContent}>
          {stats.totalSessions === 0 ? (
            <div className={cn(styles.emptyContainer, "reports-empty-container")}>
              <p className={cn(styles.emptyText, "reports-empty-text")}>
                {t('No activities recorded in this date range.')}
              </p>
            </div>
          ) : (
            <>
              <div className={styles.statsGrid}>
                <Card
                  className={cn(styles.statCard, "reports-stat-card cursor-pointer")}
                  onClick={() => {
                    setChartMetric('totalByDay');
                    setChartModalOpen(true);
                  }}
                >
                  <CardContent className="p-4">
                    <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                      {stats.totalSessions}
                    </div>
                    <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>{t('Total Sessions')}</div>
                  </CardContent>
                </Card>

                <Card
                  className={cn(styles.statCard, "reports-stat-card cursor-pointer")}
                  onClick={() => {
                    setChartMetric('dailyDuration');
                    setChartModalOpen(true);
                  }}
                >
                  <CardContent className="p-4">
                    <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                      {formatMinutes(stats.totalMinutes)}
                    </div>
                    <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>{t('Total Time')}</div>
                  </CardContent>
                </Card>

                <Card
                  className={cn(styles.statCard, "reports-stat-card cursor-pointer")}
                  onClick={() => {
                    setChartMetric('avgDurationByType');
                    setChartModalOpen(true);
                  }}
                >
                  <CardContent className="p-4">
                    <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                      {formatMinutes(stats.avgSessionMinutes)}
                    </div>
                    <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>{t('Avg Session')}</div>
                  </CardContent>
                </Card>

                <Card
                  className={cn(styles.statCard, "reports-stat-card cursor-pointer")}
                  onClick={() => {
                    setChartMetric('totalByDay');
                    setChartModalOpen(true);
                  }}
                >
                  <CardContent className="p-4">
                    <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                      {stats.sessionsPerDay.toFixed(1)}
                    </div>
                    <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>{t('Sessions/Day')}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Per-type breakdown */}
              <div className="mt-4 space-y-2">
                {stats.byType.map((typeStat) => (
                  <div
                    key={typeStat.type}
                    className="rounded-md border border-gray-200 bg-white p-3 reports-play-type-item"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-gray-800 reports-play-type-name">{typeStat.displayName}</span>
                      <span className="text-sm text-gray-500 reports-play-type-details">
                        {typeStat.count} {t('Sessions')} &middot; {formatMinutes(typeStat.totalMinutes)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 reports-play-type-details">
                      {t('Avg Session')}: {formatMinutes(typeStat.avgMinutes)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </AccordionContent>
      </AccordionItem>

      <PlayChartModal
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

export default PlayStatsSection;
