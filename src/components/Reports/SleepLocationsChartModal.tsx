'use client';

import React from 'react';
import { cn } from '@/src/lib/utils';
import { Modal, ModalContent } from '@/src/components/ui/modal';
import { growthChartStyles } from './growth-chart.styles';
import { styles } from './reports.styles';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { LocationStat } from './reports.types';
import { useLocalization } from '@/src/context/localization';

interface SleepLocationsChartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'nap' | 'night';
  locations: LocationStat[];
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
 * SleepLocationsChartModal Component
 *
 * Displays a bar chart modal showing total sleep time by location.
 * Supports both nap and night sleep locations.
 */
const SleepLocationsChartModal: React.FC<SleepLocationsChartModalProps> = ({
  open,
  onOpenChange,
  type,
  locations,
}) => {
  const title = type === 'nap' ? 'Nap Locations' : 'Night Sleep Locations';
  const description =
    type === 'nap'
      ? 'Total nap time by location for the selected date range.'
      : 'Total night sleep time by location for the selected date range.';

  const chartData = locations.map((loc) => ({
    name: loc.location,
    minutes: loc.totalMinutes,
  }));

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
    >
      <ModalContent>
        {locations.length === 0 ? (
          <div className={cn(styles.emptyContainer, "reports-empty-container")}>
            <p className={cn(styles.emptyText, "reports-empty-text")}>
              {t('No sleep location data available for the selected date range.')}
            </p>
          </div>
        ) : (
          <div className={cn(growthChartStyles.chartWrapper, "growth-chart-wrapper")}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 24, left: 8, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="growth-chart-grid" />
                <XAxis
                  dataKey="name"
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                  height={60}
                  className="growth-chart-axis"
                />
                <YAxis
                  type="number"
                  domain={['auto', 'auto']}
                  tickFormatter={(value) => formatMinutes(value as number)}
                  className="growth-chart-axis"
                />
                <RechartsTooltip
                  formatter={(value: any) => [formatMinutes(value as number), 'Total Sleep']}
                  labelFormatter={(label: any) => `Location: ${label}`}
                />
                <Bar dataKey="minutes" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
};

export default SleepLocationsChartModal;

