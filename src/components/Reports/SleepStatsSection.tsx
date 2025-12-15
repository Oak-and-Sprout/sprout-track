'use client';

import React, { useState } from 'react';
import { Moon, MapPin } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Card, CardContent } from '@/src/components/ui/card';
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/src/components/ui/accordion';
import { styles } from './reports.styles';
import { SleepStats, DateRange, ActivityType } from './reports.types';
import SleepChartModal, { SleepChartMetric, SleepChartDataPoint } from './SleepChartModal';
import SleepLocationsChartModal from './SleepLocationsChartModal';
import SleepLocationChartModal from './SleepLocationChartModal';

interface SleepStatsSectionProps {
  stats: SleepStats;
  sleepChartSeries: {
    avgNapDuration: SleepChartDataPoint[];
    dailyNapTotal: SleepChartDataPoint[];
    nightSleep: SleepChartDataPoint[];
    nightWakings: SleepChartDataPoint[];
  };
  dateRange: DateRange;
  activities: ActivityType[];
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
 * SleepStatsSection Component
 *
 * Displays sleep statistics with interactive cards that open chart modals.
 */
const SleepStatsSection: React.FC<SleepStatsSectionProps> = ({
  stats,
  sleepChartSeries,
  dateRange,
  activities,
}) => {
  const [sleepChartModalOpen, setSleepChartModalOpen] = useState(false);
  const [sleepChartMetric, setSleepChartMetric] = useState<SleepChartMetric | null>(null);
  const [sleepLocationsModalOpen, setSleepLocationsModalOpen] = useState(false);
  const [sleepLocationsType, setSleepLocationsType] = useState<'nap' | 'night'>('nap');
  const [locationChartModalOpen, setLocationChartModalOpen] = useState(false);
  const [locationChartType, setLocationChartType] = useState<'nap' | 'night'>('nap');

  const currentSleepSeries =
    sleepChartMetric && sleepChartSeries[sleepChartMetric]
      ? sleepChartSeries[sleepChartMetric]
      : [];

  return (
    <>
      <AccordionItem value="sleep">
        <AccordionTrigger className={cn(styles.accordionTrigger, "reports-accordion-trigger")}>
          <Moon className={cn(styles.accordionTriggerIcon, "reports-accordion-trigger-icon reports-icon-sleep")} />
          <span>Sleep Statistics</span>
        </AccordionTrigger>
        <AccordionContent className={styles.accordionContent}>
          <div className={styles.statsGrid}>
            <Card
              className={cn(styles.statCard, "reports-stat-card cursor-pointer")}
              onClick={() => {
                setSleepChartMetric('avgNapDuration');
                setSleepChartModalOpen(true);
              }}
            >
              <CardContent className="p-4">
                <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                  {formatMinutes(stats.avgNapMinutes)}
                </div>
                <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>Avg Nap Duration</div>
              </CardContent>
            </Card>

            <Card
              className={cn(styles.statCard, "reports-stat-card cursor-pointer")}
              onClick={() => {
                setSleepChartMetric('dailyNapTotal');
                setSleepChartModalOpen(true);
              }}
            >
              <CardContent className="p-4">
                <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                  {formatMinutes(stats.avgDailyNapMinutes)}
                </div>
                <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>Avg Daily Nap Time</div>
              </CardContent>
            </Card>

            <Card
              className={cn(styles.statCard, "reports-stat-card cursor-pointer")}
              onClick={() => {
                setSleepChartMetric('nightSleep');
                setSleepChartModalOpen(true);
              }}
            >
              <CardContent className="p-4">
                <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                  {formatMinutes(stats.avgNightSleepMinutes)}
                </div>
                <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>Avg Night Sleep</div>
              </CardContent>
            </Card>

            <Card
              className={cn(styles.statCard, "reports-stat-card cursor-pointer")}
              onClick={() => {
                setSleepChartMetric('nightWakings');
                setSleepChartModalOpen(true);
              }}
            >
              <CardContent className="p-4">
                <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                  {stats.avgNightWakings}
                </div>
                <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>Avg Night Wakings</div>
              </CardContent>
            </Card>
          </div>

          {/* Nap Locations */}
          {stats.napLocations.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                className={cn(styles.sectionTitle, "reports-section-title text-left w-full cursor-pointer hover:opacity-80")}
                onClick={() => {
                  setSleepLocationsType('nap');
                  setSleepLocationsModalOpen(true);
                }}
              >
                <MapPin className={styles.sectionTitleIcon} />
                Popular Nap Locations
              </button>
              <div className={styles.locationList}>
                {stats.napLocations.slice(0, 5).map((loc) => (
                  <button
                    key={loc.location}
                    type="button"
                    className={cn(styles.locationItem, "reports-location-item cursor-pointer hover:opacity-80 transition-opacity w-full text-left")}
                    onClick={() => {
                      setLocationChartType('nap');
                      setLocationChartModalOpen(true);
                    }}
                  >
                    <span className={cn(styles.locationName, "reports-location-name")}>{loc.location}</span>
                    <span className={cn(styles.locationCount, "reports-location-count")}>
                      {loc.count}x ({formatMinutes(loc.totalMinutes)})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Night Sleep Locations */}
          {stats.nightLocations.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                className={cn(styles.sectionTitle, "reports-section-title text-left w-full cursor-pointer hover:opacity-80")}
                onClick={() => {
                  setSleepLocationsType('night');
                  setSleepLocationsModalOpen(true);
                }}
              >
                <MapPin className={styles.sectionTitleIcon} />
                Popular Night Sleep Locations
              </button>
              <div className={styles.locationList}>
                {stats.nightLocations.slice(0, 5).map((loc) => (
                  <button
                    key={loc.location}
                    type="button"
                    className={cn(styles.locationItem, "reports-location-item cursor-pointer hover:opacity-80 transition-opacity w-full text-left")}
                    onClick={() => {
                      setLocationChartType('night');
                      setLocationChartModalOpen(true);
                    }}
                  >
                    <span className={cn(styles.locationName, "reports-location-name")}>{loc.location}</span>
                    <span className={cn(styles.locationCount, "reports-location-count")}>
                      {loc.count}x ({formatMinutes(loc.totalMinutes)})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>

      {/* Sleep line chart modal */}
      <SleepChartModal
        open={sleepChartModalOpen}
        onOpenChange={(open) => {
          setSleepChartModalOpen(open);
          if (!open) {
            setSleepChartMetric(null);
          }
        }}
        metric={sleepChartMetric}
        data={currentSleepSeries}
        dateRange={dateRange}
      />

      {/* Sleep locations bar chart modal */}
      <SleepLocationsChartModal
        open={sleepLocationsModalOpen}
        onOpenChange={setSleepLocationsModalOpen}
        type={sleepLocationsType}
        locations={sleepLocationsType === 'nap' ? stats.napLocations : stats.nightLocations}
      />

      {/* Location-specific daily count stacked bar chart modal */}
      <SleepLocationChartModal
        open={locationChartModalOpen}
        onOpenChange={setLocationChartModalOpen}
        type={locationChartType}
        locations={locationChartType === 'nap' ? stats.napLocations : stats.nightLocations}
        activities={activities}
        dateRange={dateRange}
      />
    </>
  );
};

export default SleepStatsSection;

