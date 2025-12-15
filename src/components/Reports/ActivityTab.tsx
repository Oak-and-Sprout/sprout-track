'use client';

import React from 'react';
import { Activity } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { styles } from './reports.styles';
import { ActivityTabProps } from './reports.types';

/**
 * ActivityTab Component
 *
 * Placeholder tab for displaying detailed activity breakdowns.
 * Will be implemented in a future update.
 */
const ActivityTab: React.FC<ActivityTabProps> = ({
  activities,
  dateRange,
  isLoading
}) => {
  return (
    <div className={cn(styles.placeholderContainer, "reports-placeholder-container")}>
      <Activity className={cn(styles.placeholderIcon, "reports-placeholder-icon")} />
      <h3 className={cn(styles.placeholderTitle, "reports-placeholder-title")}>
        Activity Breakdown
      </h3>
      <p className={cn(styles.placeholderText, "reports-placeholder-text")}>
        View detailed breakdowns of all activities by type, time of day, and caretaker.
        This feature is coming soon!
      </p>
    </div>
  );
};

export default ActivityTab;
