'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TablePagination,
} from '@/src/components/ui/table';
import {
  Loader2,
  ArrowLeft,
  Copy,
  QrCode,
  Download,
  Link2,
} from 'lucide-react';
import { ShortLinkQrDialog } from '@/src/components/familymanager/short-link-qr-dialog';
import { useToast } from '@/src/components/ui/toast';
import { useLocalization } from '@/src/context/localization';
import { authFetch, formatDateTime } from '@/src/components/familymanager/utils';
import './short-link-detail.css';

// Local mirror of the Task 5 API response shape (ShortLinkStatsData). Kept
// local rather than importing from the server route so this client component
// doesn't pull in server-only code.
interface ShortLinkRow {
  id: string;
  slug: string;
  url: string;
  name: string;
  description: string | null;
  tag: string | null;
  enabled: boolean;
  clickCount: number;
  clicks7d: number;
  createdAt: string;
  updatedAt: string;
}

interface DayPoint {
  date: string;
  clicks: number;
  uniques: number;
}

interface BreakdownEntry {
  value: string;
  count: number;
}

interface RecentClickRow {
  timestamp: string;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  region: string | null;
  referrerDomain: string | null;
  queryString: string | null;
}

interface ShortLinkStatsData {
  link: ShortLinkRow;
  series: DayPoint[];
  totals: { clicks: number; uniques: number };
  breakdowns: {
    deviceType: BreakdownEntry[];
    browser: BreakdownEntry[];
    os: BreakdownEntry[];
    country: BreakdownEntry[];
    referrerDomain: BreakdownEntry[];
  };
  recent: { rows: RecentClickRow[]; total: number; page: number; pageSize: number };
}

const RECENT_PAGE_SIZE = 25;
const ALL_VALUE = 'all';

const DEVICE_TYPE_LABELS: Record<string, string> = {
  mobile: 'Mobile',
  tablet: 'Tablet',
  desktop: 'Desktop',
  bot: 'Bot',
  unknown: 'Unknown',
};
const DEVICE_TYPES = Object.keys(DEVICE_TYPE_LABELS);

function shortUrlFor(slug: string): string {
  return typeof window !== 'undefined' ? `${window.location.origin}/go/${slug}` : `/go/${slug}`;
}

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
    <div className="short-link-panel bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500 short-link-panel-muted-text uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-semibold text-gray-900 short-link-panel-text mt-1">{value}</p>
      {sublabel && (
        <p className="text-xs text-gray-400 short-link-panel-muted-text mt-1 truncate">{sublabel}</p>
      )}
    </div>
  );
}

interface BreakdownCardProps {
  title: string;
  entries: BreakdownEntry[];
  emptyLabel: string;
}

function BreakdownCard({ title, entries, emptyLabel }: BreakdownCardProps) {
  const top = entries.slice(0, 8);
  const max = top.length > 0 ? top[0].count : 1;
  return (
    <div className="short-link-panel bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-800 short-link-panel-text mb-3">{title}</h3>
      {top.length === 0 ? (
        <p className="text-sm text-gray-400 short-link-panel-muted-text">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {top.map((entry) => (
            <li key={entry.value}>
              <div className="flex items-center justify-between text-sm text-gray-700 short-link-panel-text mb-1 gap-2">
                <span className="truncate" title={entry.value}>{entry.value}</span>
                <span className="tabular-nums text-gray-500 short-link-panel-muted-text flex-shrink-0">
                  {entry.count}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 short-link-track overflow-hidden">
                <div
                  className="h-full rounded-full bg-teal-500"
                  style={{ width: `${Math.max(4, Math.round((entry.count / max) * 100))}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ShortLinkDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { t } = useLocalization();
  const { showToast } = useToast();

  const [stats, setStats] = useState<ShortLinkStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const [days, setDays] = useState('30');
  const [deviceType, setDeviceType] = useState(ALL_VALUE);
  const [country, setCountry] = useState(ALL_VALUE);
  const [referrer, setReferrer] = useState(ALL_VALUE);
  const [page, setPage] = useState(1);

  const buildFilterParams = useCallback((): URLSearchParams => {
    const searchParams = new URLSearchParams();
    searchParams.set('days', days);
    if (deviceType !== ALL_VALUE) searchParams.set('deviceType', deviceType);
    if (country !== ALL_VALUE) searchParams.set('country', country);
    if (referrer !== ALL_VALUE) searchParams.set('referrer', referrer);
    return searchParams;
  }, [days, deviceType, country, referrer]);

  const fetchStats = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const searchParams = buildFilterParams();
      searchParams.set('page', String(page));
      searchParams.set('pageSize', String(RECENT_PAGE_SIZE));
      const response = await authFetch(`/api/short-links/${id}/stats?${searchParams.toString()}`);
      if (response.status === 404) {
        setNotFound(true);
        setStats(null);
        return;
      }
      const data = await response.json();
      if (data.success) {
        setNotFound(false);
        setStats(data.data);
      } else {
        showToast({
          variant: 'error',
          title: t('Error'),
          message: data.error || t('Failed to load short link stats'),
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error fetching short link stats:', error);
      showToast({
        variant: 'error',
        title: t('Error'),
        message: t('Failed to load short link stats'),
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  }, [id, page, buildFilterParams, showToast, t]);

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchStats]);

  const handleDaysChange = (value: string) => {
    setDays(value);
    setPage(1);
  };
  const handleDeviceTypeChange = (value: string) => {
    setDeviceType(value);
    setPage(1);
  };
  const handleCountryChange = (value: string) => {
    setCountry(value);
    setPage(1);
  };
  const handleReferrerChange = (value: string) => {
    setReferrer(value);
    setPage(1);
  };

  const copyShortUrl = async () => {
    if (!stats) return;
    try {
      await navigator.clipboard.writeText(shortUrlFor(stats.link.slug));
      showToast({
        variant: 'success',
        title: t('Copied!'),
        message: t('Short URL copied to clipboard'),
        duration: 3000,
      });
    } catch (error) {
      console.error('Error copying short URL:', error);
      showToast({
        variant: 'error',
        title: t('Error'),
        message: t('Failed to copy short URL'),
        duration: 5000,
      });
    }
  };

  const handleExport = async () => {
    if (!stats || !id) return;
    setExporting(true);
    try {
      const searchParams = buildFilterParams();
      const response = await authFetch(`/api/short-links/${id}/export?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error('Export request failed');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${stats.link.slug}-clicks.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting short link clicks:', error);
      showToast({
        variant: 'error',
        title: t('Error'),
        message: t('Failed to export clicks'),
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
  const totalPages = stats ? Math.ceil(stats.recent.total / stats.recent.pageSize) : 0;

  if (loading && !stats && !notFound) {
    return (
      <div role="status" className="h-full w-full flex items-center justify-center">
        <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin" />
        <span className="sr-only">{t('Loading...')}</span>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-center p-6">
        <Link2 className="h-10 w-10 text-gray-300" aria-hidden="true" />
        <p className="text-gray-500">{t('Short link not found')}</p>
        <p className="text-sm text-gray-400 max-w-sm">
          {t("The short link you're looking for doesn't exist or has been removed.")}
        </p>
        <Button variant="outline" size="sm" onClick={() => router.push('/family-manager/short-links')}>
          <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" />
          {t('Back to Short Links')}
        </Button>
      </div>
    );
  }

  if (!stats) return null;

  const { link } = stats;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6">
      <div>
        <Button variant="outline" size="sm" onClick={() => router.push('/family-manager/short-links')}>
          <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" />
          {t('Back to Short Links')}
        </Button>
      </div>

      {/* Header card */}
      <div className="short-link-panel bg-white rounded-lg border border-gray-200 p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-gray-900 short-link-panel-text">{link.name}</h1>
              {link.enabled ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {t('Active')}
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {t('Paused')}
                </span>
              )}
              {link.tag && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 short-link-tag-badge">
                  {link.tag}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-teal-700 short-link-accent-text">/go/{link.slug}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={copyShortUrl}
                title={t('Copy short URL')}
                aria-label={t('Copy short URL')}
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQrOpen(true)}
                title={t('View QR code')}
                aria-label={t('View QR code')}
              >
                <QrCode className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <p
              className="mt-2 text-sm text-gray-500 short-link-panel-muted-text truncate max-w-xl"
              title={link.url}
            >
              {t('Destination')}:{' '}
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                {link.url}
              </a>
            </p>
            <p className="mt-1 text-xs text-gray-400 short-link-panel-muted-text">
              {t('Created')}: {formatDateTime(link.createdAt)}
            </p>
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
      <div className="short-link-panel bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 short-link-panel-muted-text mb-1">
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
        <div>
          <label className="block text-xs font-medium text-gray-500 short-link-panel-muted-text mb-1">
            {t('Device Type')}
          </label>
          <Select value={deviceType} onValueChange={handleDeviceTypeChange}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{t('All Devices')}</SelectItem>
              {DEVICE_TYPES.map((deviceKey) => (
                <SelectItem key={deviceKey} value={deviceKey}>
                  {t(DEVICE_TYPE_LABELS[deviceKey])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 short-link-panel-muted-text mb-1">
            {t('Country')}
          </label>
          <Select value={country} onValueChange={handleCountryChange}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{t('All Countries')}</SelectItem>
              {stats.breakdowns.country.map((entry) => (
                <SelectItem key={entry.value} value={entry.value}>
                  {entry.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 short-link-panel-muted-text mb-1">
            {t('Referrer')}
          </label>
          <Select value={referrer} onValueChange={handleReferrerChange}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{t('All Referrers')}</SelectItem>
              {stats.breakdowns.referrerDomain.map((entry) => (
                <SelectItem key={entry.value} value={entry.value}>
                  {entry.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={t('Total Clicks')} value={stats.totals.clicks.toLocaleString()} />
        <StatTile
          label={`${t('Unique Visitors')} (${t('Estimate')})`}
          value={stats.totals.uniques.toLocaleString()}
        />
        <StatTile label={t('Last 7 Days')} value={link.clicks7d.toLocaleString()} />
        {topReferrer ? (
          <StatTile
            label={t('Top Referrer')}
            value={topReferrer.value}
            sublabel={`${topReferrer.count} ${t('Clicks')}`}
          />
        ) : topCountry ? (
          <StatTile
            label={t('Top Country')}
            value={topCountry.value}
            sublabel={`${topCountry.count} ${t('Clicks')}`}
          />
        ) : (
          <StatTile label={t('Top Referrer')} value={t('No data yet')} />
        )}
      </div>

      {/* Clicks over time chart */}
      <div className="short-link-panel short-link-chart-wrapper bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-800 short-link-panel-text mb-3">
          {t('Clicks Over Time')}
        </h2>
        {stats.totals.clicks === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-gray-500 short-link-panel-muted-text">
              {t('No clicks recorded for the selected filters.')}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tickMargin={8} interval={xInterval} />
              <YAxis allowDecimals={false} tickMargin={8} />
              <RechartsTooltip />
              <RechartsLegend />
              <Line
                type="monotone"
                dataKey="clicks"
                name={t('Clicks')}
                stroke="var(--short-link-color-clicks)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="uniques"
                name={t('Unique Visitors')}
                stroke="var(--short-link-color-uniques)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Breakdown cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <BreakdownCard title={t('Device Type')} entries={stats.breakdowns.deviceType} emptyLabel={t('No data yet')} />
        <BreakdownCard title={t('Browser')} entries={stats.breakdowns.browser} emptyLabel={t('No data yet')} />
        <BreakdownCard title={t('OS')} entries={stats.breakdowns.os} emptyLabel={t('No data yet')} />
        <BreakdownCard title={t('Country')} entries={stats.breakdowns.country} emptyLabel={t('No data yet')} />
        <BreakdownCard title={t('Referrer')} entries={stats.breakdowns.referrerDomain} emptyLabel={t('No data yet')} />
      </div>

      {/* Recent clicks table */}
      <div className="short-link-panel bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-800 short-link-panel-text mb-3">{t('Recent Clicks')}</h2>
        {stats.recent.rows.length === 0 ? (
          <p className="text-sm text-gray-400 short-link-panel-muted-text py-6 text-center">
            {t('No clicks recorded yet.')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead variant="bold">{t('Timestamp')}</TableHead>
                  <TableHead variant="bold">{t('Device')}</TableHead>
                  <TableHead variant="bold">{t('Browser')}</TableHead>
                  <TableHead variant="bold">{t('OS')}</TableHead>
                  <TableHead variant="bold">{t('Country')}</TableHead>
                  <TableHead variant="bold">{t('Referrer')}</TableHead>
                  <TableHead variant="bold">{t('Query String')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recent.rows.map((row, idx) => (
                  <TableRow key={`${row.timestamp}-${idx}`}>
                    <TableCell className="text-sm whitespace-nowrap">{formatDateTime(row.timestamp)}</TableCell>
                    <TableCell className="text-sm">
                      {row.deviceType ? t(DEVICE_TYPE_LABELS[row.deviceType] ?? row.deviceType) : t('N/A')}
                    </TableCell>
                    <TableCell className="text-sm">{row.browser || t('N/A')}</TableCell>
                    <TableCell className="text-sm">{row.os || t('N/A')}</TableCell>
                    <TableCell className="text-sm">{row.country || t('N/A')}</TableCell>
                    <TableCell className="text-sm max-w-[160px] truncate" title={row.referrerDomain || ''}>
                      {row.referrerDomain || t('N/A')}
                    </TableCell>
                    <TableCell
                      className="text-sm max-w-[200px] truncate font-mono"
                      title={row.queryString || ''}
                    >
                      {row.queryString || t('N/A')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {stats.recent.total > stats.recent.pageSize && (
        <TablePagination
          currentPage={stats.recent.page}
          totalPages={totalPages}
          totalItems={stats.recent.total}
          pageSize={stats.recent.pageSize}
          onPageChange={setPage}
        />
      )}

      <ShortLinkQrDialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        shortUrl={shortUrlFor(link.slug)}
        slug={link.slug}
      />
    </div>
  );
}
