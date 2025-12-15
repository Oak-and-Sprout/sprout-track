'use client';

import React from 'react';
import { cn } from '@/src/lib/utils';
import { GrowthTrendsTabProps } from './reports.types';
import GrowthChart from './GrowthChart';

/**
 * GrowthTrendsTab Component
 *
 * Displays growth charts with CDC percentile curves for tracking
 * baby's weight, length, and head circumference over time.
 * Ignores date range - always shows all measurements.
 */
const GrowthTrendsTab: React.FC<GrowthTrendsTabProps> = () => {
  return (
    <div className={cn("py-2", "growth-trends-tab-container")}>
      <GrowthChart />
    </div>
  );
};

export default GrowthTrendsTab;
