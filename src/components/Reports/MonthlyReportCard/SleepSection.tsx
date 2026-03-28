'use client';

import React from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { cn } from '@/src/lib/utils';
import { useLocalization } from '@/src/context/localization';
import { reportCardStyles as s, chartColors } from './monthly-report-card.styles';
import type { SleepSectionProps } from './monthly-report-card.types';

const SleepSection: React.FC<SleepSectionProps> = ({ sleep, isPdfExport }) => {
  const { t } = useLocalization();

  // Quality doughnut data
  const qualityData = [
    { name: t('Excellent'), value: sleep.qualityDistribution.excellent, color: chartColors.excellent },
    { name: t('Good'), value: sleep.qualityDistribution.good, color: chartColors.good },
    { name: t('Fair'), value: sleep.qualityDistribution.fair, color: chartColors.fair },
    { name: t('Poor'), value: sleep.qualityDistribution.poor, color: chartColors.poor },
  ].filter(d => d.value > 0);

  // Location bar data
  const locationData = sleep.locationDistribution.map(loc => ({
    name: loc.location,
    [t('Night')]: loc.nightCount,
    [t('Naps')]: loc.napCount,
  }));

  return (
    <>
      <p className={cn(s.sectionHeading, 'report-card-section-heading')}>{t('Sleep')}</p>

      <div className={cn(s.metricGrid4)}>
        <div className={cn(s.metricCard, 'report-card-metric')}>
          <p className={cn(s.metricLabel, 'report-card-metric-label')}>{t('Avg total/day')}</p>
          <p className={cn(s.metricValue, 'report-card-metric-value')}>{sleep.avgTotalPerDay} hr</p>
        </div>
        <div className={cn(s.metricCard, 'report-card-metric')}>
          <p className={cn(s.metricLabel, 'report-card-metric-label')}>{t('Night sleep')}</p>
          <p className={cn(s.metricValue, 'report-card-metric-value')}>{sleep.avgNightSleep} hr</p>
        </div>
        <div className={cn(s.metricCard, 'report-card-metric')}>
          <p className={cn(s.metricLabel, 'report-card-metric-label')}>{t('Avg naps')}</p>
          <p className={cn(s.metricValue, 'report-card-metric-value')}>{sleep.avgNapsPerDay}/{t('day')}</p>
        </div>
        <div className={cn(s.metricCard, 'report-card-metric')}>
          <p className={cn(s.metricLabel, 'report-card-metric-label')}>{t('Longest stretch')}</p>
          <p className={cn(s.metricValue, 'report-card-metric-value')}>{sleep.longestStretch} hr</p>
        </div>
      </div>

      {/* Charts row */}
      <div className={cn(s.chartsRow)}>
        {/* Sleep quality doughnut */}
        {qualityData.length > 0 && (
          <div className={cn(s.card, 'report-card-card report-card-chart')}>
            <p className={cn(s.cardTitle, 'report-card-card-title')}>{t('Sleep quality')}</p>
            <div style={{ width: '100%', height: 150 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={qualityData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" stroke="none" isAnimationActive={!isPdfExport}>
                    {qualityData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className={cn(s.chartLegend, 'report-card-chart-legend')}>
              {qualityData.map((d, i) => (
                <span key={i} className={s.chartLegendItem}>
                  <span className={s.breakdownDot} style={{ background: d.color }} />
                  {d.name} {d.value}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sleep location bar chart */}
        {locationData.length > 0 && (
          <div className={cn(s.card, 'report-card-card report-card-chart')}>
            <p className={cn(s.cardTitle, 'report-card-card-title')}>{t('Sleep location')}</p>
            <div style={{ width: '100%', height: 150 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={locationData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey={t('Night')} fill={chartColors.nightSleep} radius={[3, 3, 0, 0]} isAnimationActive={!isPdfExport} />
                  <Bar dataKey={t('Naps')} fill={chartColors.napSleep} radius={[3, 3, 0, 0]} isAnimationActive={!isPdfExport} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className={cn(s.chartLegend, 'report-card-chart-legend')}>
              <span className={s.chartLegendItem}>
                <span className={s.breakdownDot} style={{ background: chartColors.nightSleep }} />
                {t('Night sleep')}
              </span>
              <span className={s.chartLegendItem}>
                <span className={s.breakdownDot} style={{ background: chartColors.napSleep }} />
                {t('Naps')}
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SleepSection;
