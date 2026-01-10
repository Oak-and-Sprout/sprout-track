'use client';

import React from 'react';
import { Thermometer } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/src/components/ui/accordion';
import { styles } from './reports.styles';
import { growthChartStyles } from './growth-chart.styles';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { MeasurementActivity } from './reports.types';
import { useLocalization } from '@/src/context/localization';

interface TemperatureStatsSectionProps {
  temperatureData: Array<{ ageMonths: number; value: number; unit: string }>;
  babyCurrentAgeMonths: number;
}

// Temperature chart tooltip
const TemperatureTooltip = ({ active, payload, label }: any) => {  

  if (active && payload && payload.length) {
    const point = payload[0]?.payload as { value: number; unit: string };
    if (!point) return null;

    return (
      <div className={cn(growthChartStyles.tooltip, 'growth-chart-tooltip')}>
        <p className={cn(growthChartStyles.tooltipLabel, 'growth-chart-tooltip-label')}>
          {t('Age:')} {typeof label === 'number' ? label.toFixed(1) : label} months
        </p>
        <p className={cn(growthChartStyles.tooltipMeasurement, 'growth-chart-tooltip-measurement')}>
          {t('Temp:')} {point.value.toFixed(1)} {point.unit}
        </p>
      </div>
    );
  }
  return null;
};

/**
 * TemperatureStatsSection Component
 *
 * Displays temperature measurements chart.
 */
const TemperatureStatsSection: React.FC<TemperatureStatsSectionProps> = ({
  temperatureData,
  babyCurrentAgeMonths,
}) => {

  const { t } = useLocalization();
  return (
    <AccordionItem value="temperature">
      <AccordionTrigger className={cn(styles.accordionTrigger, "reports-accordion-trigger")}>
        <Thermometer className={cn(styles.accordionTriggerIcon, "reports-accordion-trigger-icon reports-icon-measurement")} />
        <span>{t('Temperature Measurements')}</span>
      </AccordionTrigger>
      <AccordionContent className={styles.accordionContent}>
        {temperatureData.length === 0 ? (
          <div className={cn(styles.emptyContainer, "reports-empty-container")}>
            <p className={cn(styles.emptyText, "reports-empty-text")}>
              {t('No temperature measurements in the selected date range.')}
            </p>
          </div>
        ) : (
          (() => {
            const rawUnit = temperatureData[0]?.unit || '';
            const upperUnit = rawUnit.toString().toUpperCase();
            const isCelsius = upperUnit.includes('C');

            // Hard-set domains for realistic ranges
            const domain: [number, number] = isCelsius
              ? [32, 42]   // ~90–108°F in °C
              : [90, 108]; // default / Fahrenheit

            return (
              <div className={cn(growthChartStyles.chartWrapper, "growth-chart-wrapper")}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={temperatureData}
                    margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="growth-chart-grid" />
                    <XAxis
                      dataKey="ageMonths"
                      type="number"
                      domain={[0, babyCurrentAgeMonths]}
                      label={{ value: 'Age (months)', position: 'insideBottom', offset: -5 }}
                      tickFormatter={(value) => value.toString()}
                      className="growth-chart-axis"
                    />
                    <YAxis
                      type="number"
                      domain={domain}
                      allowDataOverflow={true}
                      label={{ value: rawUnit || '', angle: -90, position: 'insideLeft' }}
                      className="growth-chart-axis"
                    />
                    <RechartsTooltip content={<TemperatureTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#f97316"
                      strokeWidth={2}
                      dot={{ r: 4, fill: "#f97316" }}
                      activeDot={{ r: 6, fill: "#ea580c" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })()
        )}
      </AccordionContent>
    </AccordionItem>
  );
};

export default TemperatureStatsSection;

