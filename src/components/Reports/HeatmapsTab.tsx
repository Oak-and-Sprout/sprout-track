'use client';

import React from 'react';
import { Grid3X3 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { styles } from './reports.styles';
import { HeatmapsTabProps } from './reports.types';

/**
 * HeatmapsTab Component
 *
 * Placeholder tab for displaying activity heatmaps.
 * Will be implemented in a future update.
 */
const HeatmapsTab: React.FC<HeatmapsTabProps> = ({
  activities,
  dateRange,
  isLoading
}) => {
  return (
    <div className={cn(styles.placeholderContainer, "reports-placeholder-container")}>
      <Grid3X3 className={cn(styles.placeholderIcon, "reports-placeholder-icon")} />
      <h3 className={cn(styles.placeholderTitle, "reports-placeholder-title")}>
        Activity Heatmaps
      </h3>
      <p className={cn(styles.placeholderText, "reports-placeholder-text")}>
        Visualize activity patterns across days and times with interactive heatmaps.
        This feature is coming soon!
      </p>
    </div>
  );
};

export default HeatmapsTab;
