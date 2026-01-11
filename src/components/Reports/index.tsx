'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, TrendingUp, Activity, Grid3X3, CalendarIcon, Loader2, Baby as BabyIcon, Trophy } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useBaby } from '@/app/context/baby';
import { Button } from '@/src/components/ui/button';
import { Calendar } from '@/src/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/src/components/ui/popover';
import { styles, tabStyles } from './reports.styles';
import { ReportsProps, ReportTab, DateRange, ActivityType } from './reports.types';
import StatsTab from './StatsTab';
import MilestonesTab from './MilestonesTab';
import GrowthTrendsTab from './GrowthTrendsTab';
import ActivityTab from './ActivityTab';
import HeatmapsTab from './HeatmapsTab';
import { useLocalization } from '@/src/context/localization';

import './reports.css';

/**
 * Reports Component
 *
 * Main reports page with tabbed navigation for viewing baby activity statistics,
 * growth trends, activity breakdowns, and heatmaps.
 */
const Reports: React.FC<ReportsProps> = ({ className }) => {

  const { t } = useLocalization();
  const { selectedBaby } = useBaby();

  // Tab state
  const [activeTab, setActiveTab] = useState<ReportTab>('stats');

  // Date range state (default to last 7 days)
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { from: start, to: end };
  });

  // Calendar popover state
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Data state
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch activities when baby or date range changes
  useEffect(() => {
    if (!selectedBaby || !dateRange.from || !dateRange.to) {
      setActivities([]);
      return;
    }

    const fetchActivities = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const startDate = dateRange.from!.toISOString();
        const endDate = dateRange.to!.toISOString();

        // Add timestamp to prevent caching
        const timestamp = new Date().getTime();

        // extendSleepRange=true extends the sleep query back 12 hours for proper night sleep statistics
        const url = `/api/timeline?babyId=${selectedBaby.id}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&extendSleepRange=true&_t=${timestamp}`;

        // Get auth token from localStorage
        const authToken = localStorage.getItem('authToken');

        const response = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authToken ? `Bearer ${authToken}` : '',
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Expires': '0',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setActivities(data.data || []);
          } else {
            setActivities([]);
            setError(data.message || 'Failed to fetch activities');
          }
        } else {
          setActivities([]);
          setError('Failed to fetch activities');
        }
      } catch (err) {
        console.error('Error fetching activities:', err);
        setActivities([]);
        setError('Error fetching activities');
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivities();
  }, [selectedBaby, dateRange]);

  // Handle date range change from calendar
  const handleRangeChange = (from: Date | null, to: Date | null) => {  

    if (from) {
      from.setHours(0, 0, 0, 0);
    }
    if (to) {
      to.setHours(23, 59, 59, 999);
    }
    setDateRange({ from, to });

    // Close calendar when both dates are selected
    if (from && to) {
      setCalendarOpen(false);
    }
  };

  // Format date range for display
  const formatDateRange = (): string => {
    if (!dateRange.from) return t('Select date range');
    if (!dateRange.to) return dateRange.from.toLocaleDateString();
    return `${dateRange.from.toLocaleDateString()} - ${dateRange.to.toLocaleDateString()}`;
  };

  // Tab configuration
  const tabs = useMemo(
    () => [
      { id: 'stats' as ReportTab, label: t('Stats Tab'), icon: BarChart3 },
      { id: 'milestones' as ReportTab, label: t('Milestones Tab'), icon: Trophy },
      { id: 'growth' as ReportTab, label: t('Growth Trends Tab'), icon: TrendingUp },
      { id: 'activity' as ReportTab, label: t('Activity Tab'), icon: Activity },
      { id: 'heatmaps' as ReportTab, label: t('Heatmaps Tab'), icon: Grid3X3 },
    ],
    [t]
  );

  // Render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'stats':
        return <StatsTab activities={activities} dateRange={dateRange} isLoading={isLoading} />;
      case 'milestones':
        return <MilestonesTab />;
      case 'growth':
        return <GrowthTrendsTab dateRange={dateRange} isLoading={isLoading} />;
      case 'activity':
        return <ActivityTab activities={activities} dateRange={dateRange} isLoading={isLoading} />;
      case 'heatmaps':
        return <HeatmapsTab activities={activities} dateRange={dateRange} isLoading={isLoading} />;
      default:
        return null;
    }
  };

  // No baby selected state
  if (!selectedBaby) {
    return (
      <div className={cn(styles.container, className, "reports-container")}>
        <div className={cn(styles.noBabyContainer, "reports-no-baby-container")}>
          <BabyIcon className={cn(styles.noBabyIcon, "reports-no-baby-icon")} />
          <p className={cn(styles.noBabyText, "reports-no-baby-text")}>
            {t('Please select a baby to view reports')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(styles.container, className, "reports-container")}>
      {/* Header with date range picker */}
      <div className={cn(styles.header, "reports-header")}>
        <h1 className={cn(styles.headerTitle, "reports-header-title")}>
          {selectedBaby.firstName}{t('\'s Reports')}
        </h1>

        <div className={cn(styles.dateRangeContainer, "reports-date-range-container")}>
          <span className={cn(styles.dateRangeLabel, "reports-date-range-label")}>{t('Date Range:')}</span>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(styles.dateRangeButton, "reports-date-range-button")}
              >
                <CalendarIcon className={cn(styles.dateRangeIcon, "reports-date-range-icon")} />
                {formatDateRange()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className={styles.calendarPopover} align="end">
              <Calendar
                mode="range"
                rangeFrom={dateRange.from}
                rangeTo={dateRange.to}
                onRangeChange={handleRangeChange}
                maxDate={new Date()}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Tab navigation */}
      <div className={cn(styles.tabContainer, "reports-tab-container-wrapper")}>
        <div className={cn(tabStyles.tabContainer, "reports-tab-container")}>
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  tabStyles.tabButton,
                  "reports-tab-button",
                  isActive && tabStyles.tabButtonActive,
                  isActive && "reports-tab-button-active"
                )}
                type="button"
                role="tab"
                aria-selected={isActive}
              >
                <IconComponent className={tabStyles.tabIcon} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className={cn(styles.errorContainer, "reports-error-container")}>
          <p className={cn(styles.errorText, "reports-error-text")}>{error}</p>
          <Button
            variant="outline"
            onClick={() => {
              setError(null);
              // Trigger refetch by toggling date range
              setDateRange({ ...dateRange });
            }}
          >
            {t('Retry')}
          </Button>
        </div>
      )}

      {/* Tab content */}
      {!error && (
        <div className={cn(styles.tabContent, "reports-tab-content")}>
          {renderTabContent()}
        </div>
      )}
    </div>
  );
};

export default Reports;
