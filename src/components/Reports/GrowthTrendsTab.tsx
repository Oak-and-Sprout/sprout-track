'use client';

import React from 'react';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { styles } from './reports.styles';
import { GrowthTrendsTabProps } from './reports.types';

/**
 * GrowthTrendsTab Component
 *
 * Placeholder tab for displaying growth trends and measurements over time.
 * Will be implemented in a future update.
 */
const GrowthTrendsTab: React.FC<GrowthTrendsTabProps> = ({
  dateRange,
  isLoading
}) => {
  return (
    <div className={cn(styles.placeholderContainer, "reports-placeholder-container")}>
      <TrendingUp className={cn(styles.placeholderIcon, "reports-placeholder-icon")} />
      <h3 className={cn(styles.placeholderTitle, "reports-placeholder-title")}>
        Growth Trends
      </h3>
      <p className={cn(styles.placeholderText, "reports-placeholder-text")}>
        Track your baby&apos;s growth over time with height, weight, and head circumference charts.
        This feature is coming soon!
      </p>
    </div>
  );
};

export default GrowthTrendsTab;
