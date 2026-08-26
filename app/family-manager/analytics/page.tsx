'use client';

import React, { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '@/src/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { Loader2, ArrowLeft, Download, BarChart3 } from 'lucide-react';
import { ChartDataTable } from '@/src/components/ui/chart-data-table';
import { useToast } from '@/src/components/ui/toast';
import { useLocalization } from '@/src/context/localization';
import { authFetch } from '@/src/components/familymanager/utils';
import './analytics.css';

// Local mirror of the Task 6 API response shape (AnalyticsStatsData). Kept
// local rather than importing from the server route so this client component
// doesn't pull in server-only code (same convention as the short-link detail page).
interface DayPoint {
  date: string;
  views: number;
  uniques: number;
}

interface BreakdownEntry {
  value: string;
  count: number;
}

interface FunnelStage {
  label: string;
  visitors: number;
}

interface RecentPageviewRow {
  timestamp: string;
  path: string;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  region: string | null;
  referrerDomain: string | null;
  queryString: string | null;
}

interface AnalyticsStatsData {
  series: DayPoint[];
  totals: { views: number; uniques: number };
  breakdowns: {
    path: BreakdownEntry[];
    referrerDomain: BreakdownEntry[];
    country: BreakdownEntry[];
    deviceType: BreakdownEntry[];
    browser: BreakdownEntry[];
    os: BreakdownEntry[];
  };
  funnel: FunnelStage[];
  recent: { rows: RecentPageviewRow[]; total: number; page: number; pageSize: number };
  path: string | null;
}

const ALL_VALUE = 'all';

function formatAxisDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

interface StatTileProps {
  label: string;
  value: string | number;
  sublabel?: string;
}

function StatTile({ label, value, sublabel }: StatTileProps) {
  return (
    <div className="analytics-panel bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500 analytics-panel-muted-text uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-semibold text-gray-900 analytics-panel-text mt-1">{value}</p>
      {sublabel && (
        <p className="text-xs text-gray-400 analytics-panel-muted-text mt-1 truncate">{sublabel}</p>
      )}
    </div>
  );
}

interface BreakdownCardProps {
  title: string;
  entries: BreakdownEntry[];
  emptyLabel: string;
  onSelect?: (value: string) => void;
  selectLabel?: string;
}

function BreakdownCard({ title, entries, emptyLabel, onSelect, selectLabel }: BreakdownCardProps) {
  const top = entries.slice(0, 8);
  const max = top.length > 0 ? top[0].count : 1;
  return (
    <div className="analytics-panel bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-800 analytics-panel-text mb-3">{title}</h3>
      {top.length === 0 ? (
        <p className="text-sm text-gray-400 analytics-panel-muted-text">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {top.map((entry) => {
            const row = (
              <>
                <div className="flex items-center justify-between text-sm text-gray-700 analytics-panel-text mb-1 gap-2">
                  <span className="truncate" title={entry.value}>{entry.value}</span>
                  <span className="tabular-nums text-gray-500 analytics-panel-muted-text flex-shrink-0">
                    {entry.count}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 analytics-track overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-500"
                    style={{ width: `${Math.max(4, Math.round((entry.count / max) * 100))}%` }}
                  />
                </div>
              </>
            );
            return (
              <li key={entry.value}>
                {onSelect ? (
                  <button
                    type="button"
                    onClick={() => onSelect(entry.value)}
                    aria-label={selectLabel ? `${selectLabel}: ${entry.value}` : entry.value}
                    className="w-full text-left analytics-clickable-row rounded px-1 -mx-1 py-0.5"
                  >
                    {row}
                  </button>
                ) : (
                  row
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AnalyticsDashboardContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useLocalization();
  const { showToast } = useToast();

  const days = searchParams.get('days') || '30';
  const pathFilter = searchParams.get('path');

  const [stats, setStats] = useState<AnalyticsStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const updateParams = useCallback(
    (next: { days?: string; path?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.days !== undefined) params.set('days', next.days);
      if (next.path !== undefined) {
        if (next.path === null) params.delete('path');
        else params.set('path', next.path);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const buildFilterParams = useCallback((): URLSearchParams => {
    const params = new URLSearchParams();
    params.set('days', days);
    if (pathFilter) params.set('path', pathFilter);
    return params;
  }, [days, pathFilter]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch(`/api/analytics/stats?${buildFilterParams().toString()}`);
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      } else {
        showToast({
          variant: 'error',
          title: t('Error'),
          message: data.error || t('Failed to load analytics stats'),
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error fetching analytics stats:', error);
      showToast({
        variant: 'error',
        title: t('Error'),
        message: t('Failed to load analytics stats'),
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  }, [buildFilterParams, showToast, t]);

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchStats]);

  const handleDaysChange = (value: string) => {
    updateParams({ days: value });
  };

  const handleSelectPage = (value: string) => {
    updateParams({ path: value });
  };

  const handleClearPage = () => {
    updateParams({ path: null });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await authFetch(`/api/analytics/export?${buildFilterParams().toString()}`);
      if (!response.ok) {
        throw new Error('Export request failed');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'site-pageviews.csv';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting pageviews:', error);
      showToast({
        variant: 'error',
        title: t('Error'),
        message: t('Failed to export pageviews'),
        duration: 5000,
      });
    } finally {
      setExporting(false);
    }
  };

  const chartData = useMemo(
    () => (stats?.series ?? []).map((point) => ({ ...point, label: formatAxisDate(point.date) })),
    [stats]
  );
  const xInterval = chartData.length > 20 ? Math.ceil(chartData.length / 12) : 0;

  const topReferrer = stats?.breakdowns.referrerDomain[0];
  const topCountry = stats?.breakdowns.country[0];
  const maxFunnelVisitors = useMemo(
    () => (stats ? Math.max(1, ...stats.funnel.map((stage) => stage.visitors)) : 1),
    [stats]
  );

  if (loading && !stats) {
    return (
      <div role="status" className="h-full w-full flex items-center justify-center">
        <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin" />
        <span className="sr-only">{t('Loading...')}</span>
      </div>
    );
  }

  if (!stats) return null;

  const hasData = stats.totals.views > 0;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="analytics-panel bg-white rounded-lg border border-gray-200 p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-teal-600 analytics-accent-text" aria-hidden="true" />
              <h1 className="text-xl font-semibold text-gray-900 analytics-panel-text">
                {t('Site Analytics')}
              </h1>
            </div>
            {pathFilter ? (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-500 analytics-panel-muted-text">
                  {t('Filtered by page')}:
                </span>
                <span className="font-mono text-sm text-teal-700 analytics-accent-text">{pathFilter}</span>
                <Button variant="outline" size="sm" onClick={handleClearPage}>
                  <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" />
                  {t('Back to All Pages')}
                </Button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-500 analytics-panel-muted-text">
                {t('Aggregated pageview analytics across all public pages.')}
              </p>
            )}
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
            className="flex-shrink-0"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4 mr-1" aria-hidden="true" />
            )}
            {t('Export CSV')}
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="analytics-panel bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 analytics-panel-muted-text mb-1">
            {t('Date Range')}
          </label>
          <Select value={days} onValueChange={handleDaysChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{t('Last 7 Days')}</SelectItem>
              <SelectItem value="30">{t('Last 30 Days')}</SelectItem>
              <SelectItem value="90">{t('Last 90 Days')}</SelectItem>
              <SelectItem value={ALL_VALUE}>{t('All Time')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={t('Total Views')} value={stats.totals.views.toLocaleString()} />
        <StatTile
          label={`${t('Unique Visitors')} (${t('Estimate')})`}
          value={stats.totals.uniques.toLocaleString()}
        />
        {topReferrer ? (
          <StatTile
            label={t('Top Referrer')}
            value={topReferrer.value}
            sublabel={`${topReferrer.count} ${t('Views')}`}
          />
        ) : (
          <StatTile label={t('Top Referrer')} value={t('No data yet')} />
        )}
        {topCountry ? (
          <StatTile
            label={t('Top Country')}
            value={topCountry.value}
            sublabel={`${topCountry.count} ${t('Views')}`}
          />
        ) : (
          <StatTile label={t('Top Country')} value={t('No data yet')} />
        )}
      </div>

      {/* Visits over time chart */}
      <div className="analytics-panel analytics-chart-wrapper bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-800 analytics-panel-text mb-3">
          {t('Visits Over Time')}
        </h2>
        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-gray-500 analytics-panel-muted-text">
              {t('No pageviews recorded for the selected filters.')}
            </p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tickMargin={8} interval={xInterval} />
                <YAxis allowDecimals={false} tickMargin={8} />
                <RechartsTooltip />
                <RechartsLegend />
                <Line
                  type="monotone"
                  dataKey="views"
                  name={t('Views')}
                  stroke="var(--analytics-color-views)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="uniques"
                  name={t('Unique Visitors')}
                  stroke="var(--analytics-color-uniques)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <ChartDataTable
              caption={t('Visits Over Time')}
              columns={[
                { key: 'date', label: t('Date') },
                { key: 'views', label: t('Views') },
                { key: 'uniques', label: t('Unique Visitors') },
              ]}
              rows={chartData.map((point) => ({
                date: point.label,
                views: point.views,
                uniques: point.uniques,
              }))}
            />
          </>
        )}
      </div>

      {/* Funnel */}
      <div className="analytics-panel bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-800 analytics-panel-text mb-3">
          {t('Conversion Funnel')}
        </h2>
        {stats.funnel.length === 0 ? (
          <p className="text-sm text-gray-400 analytics-panel-muted-text">{t('No data yet')}</p>
        ) : (
          <ul className="space-y-2">
            {stats.funnel.map((stage) => (
              <li key={stage.label}>
                <div className="flex items-center justify-between text-sm text-gray-700 analytics-panel-text mb-1 gap-2">
                  <span className="truncate">{t(stage.label)}</span>
                  <span className="tabular-nums text-gray-500 analytics-panel-muted-text flex-shrink-0">
                    {stage.visitors.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 analytics-track overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-500"
                    style={{ width: `${Math.max(4, Math.round((stage.visitors / maxFunnelVisitors) * 100))}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Breakdown cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <BreakdownCard
          title={t('Top Pages')}
          entries={stats.breakdowns.path}
          emptyLabel={t('No data yet')}
          onSelect={handleSelectPage}
          selectLabel={t('Filter by page')}
        />
        <BreakdownCard title={t('Referrers')} entries={stats.breakdowns.referrerDomain} emptyLabel={t('No data yet')} />
        <BreakdownCard title={t('Countries')} entries={stats.breakdowns.country} emptyLabel={t('No data yet')} />
        <BreakdownCard title={t('Devices')} entries={stats.breakdowns.deviceType} emptyLabel={t('No data yet')} />
        <BreakdownCard title={t('Browsers')} entries={stats.breakdowns.browser} emptyLabel={t('No data yet')} />
        <BreakdownCard title={t('Operating Systems')} entries={stats.breakdowns.os} emptyLabel={t('No data yet')} />
      </div>
    </div>
  );
}

function AnalyticsLoadingFallback() {
  const { t } = useLocalization();
  return (
    <div role="status" className="h-full w-full flex items-center justify-center">
      <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin" />
      <span className="sr-only">{t('Loading...')}</span>
    </div>
  );
}

export default function AnalyticsDashboardPage() {
  return (
    <Suspense fallback={<AnalyticsLoadingFallback />}>
      <AnalyticsDashboardContent />
    </Suspense>
  );
}
