'use client';

import React, { useState } from 'react';
import { Icon } from 'lucide-react';
import { bottleBaby } from '@lucide/lab';
import { cn } from '@/src/lib/utils';
import { Card, CardContent } from '@/src/components/ui/card';
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/src/components/ui/accordion';
import { styles } from './reports.styles';
import { FeedingStats, ActivityType, DateRange } from './reports.types';
import FeedingChartModal, { FeedingChartMetric } from './FeedingChartModal';
import { useLocalization } from '@/src/context/localization';

interface FeedingStatsSectionProps {
  stats: FeedingStats;
  activities: ActivityType[];
  dateRange: DateRange;
}

// Helper function to format minutes into hours and minutes
const formatMinutes = (minutes: number): string => {  const { t } = useLocalization();

  if (minutes === 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

/**
 * FeedingStatsSection Component
 *
 * Displays feeding statistics including bottle, breast, and solids feeds.
 */
const FeedingStatsSection: React.FC<FeedingStatsSectionProps> = ({ stats, activities, dateRange }) => {
  const [chartModalOpen, setChartModalOpen] = useState(false);
  const [chartMetric, setChartMetric] = useState<FeedingChartMetric | null>(null);

  return (
    <>
      <AccordionItem value="feeding">
        <AccordionTrigger className={cn(styles.accordionTrigger, "reports-accordion-trigger")}>
          <Icon iconNode={bottleBaby} className={cn(styles.accordionTriggerIcon, "reports-accordion-trigger-icon reports-icon-feed")} />
          <span>{t('Feeding Statistics')}</span>
        </AccordionTrigger>
        <AccordionContent className={styles.accordionContent}>
          <div className={styles.statsGrid}>
            <Card
              className={cn(styles.statCard, "reports-stat-card cursor-pointer")}
              onClick={() => {
                setChartMetric('bottle');
                setChartModalOpen(true);
              }}
            >
              <CardContent className="p-4">
                <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                  {stats.bottleFeeds.count}
                </div>
                <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>{t('Bottle Feeds')}</div>
                {stats.bottleFeeds.avgByType.length > 0 && (
                  <div className={cn(styles.statCardSubLabel, "reports-stat-card-sublabel")}>
                    {stats.bottleFeeds.avgByType.map((bt, idx) => (
                      <span key={bt.type}>
                        {bt.type}: {bt.avgAmount.toFixed(1)} {bt.unit} avg
                        {idx < stats.bottleFeeds.avgByType.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card
              className={cn(styles.statCard, "reports-stat-card cursor-pointer")}
              onClick={() => {
                setChartMetric('breast');
                setChartModalOpen(true);
              }}
            >
              <CardContent className="p-4">
                <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                  {stats.breastFeeds.count}
                </div>
                <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>{t('Breast Feeds')}</div>
                {(stats.breastFeeds.leftCount > 0 || stats.breastFeeds.rightCount > 0) && (
                  <div className={cn(styles.statCardSubLabel, "reports-stat-card-sublabel")}>
                    {t('L:')} {formatMinutes(stats.breastFeeds.avgLeftMinutes)} {t('avg, R:')} {formatMinutes(stats.breastFeeds.avgRightMinutes)} avg
                  </div>
                )}
              </CardContent>
            </Card>

            <Card
              className={cn(styles.statCard, "reports-stat-card cursor-pointer")}
              onClick={() => {
                setChartMetric('solids');
                setChartModalOpen(true);
              }}
            >
              <CardContent className="p-4">
                <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                  {stats.solidsFeeds.count}
                </div>
                <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>{t('Solids')}</div>
                {stats.solidsFeeds.avgByFood.length > 0 && (
                  <div className={cn(styles.statCardSubLabel, "reports-stat-card-sublabel")}>
                    {stats.solidsFeeds.avgByFood.slice(0, 3).map((sf, idx) => (
                      <span key={sf.food}>
                        {sf.food}: {sf.avgAmount.toFixed(1)} {sf.unit} avg
                        {idx < Math.min(stats.solidsFeeds.avgByFood.length, 3) - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Feeding chart modal */}
      <FeedingChartModal
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

export default FeedingStatsSection;

