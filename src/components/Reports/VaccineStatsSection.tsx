'use client';

import React, { useState } from 'react';
import { Syringe, ChevronDown } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Card, CardContent } from '@/src/components/ui/card';
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/src/components/ui/accordion';
import { styles } from './reports.styles';
import { VaccineRecord } from './reports.types';
import { useLocalization } from '@/src/context/localization';
import { useTimezone } from '@/app/context/timezone';

interface VaccineStatsSectionProps {
  vaccineRecords: VaccineRecord[];
  isLoading: boolean;
}

/**
 * VaccineStatsSection Component
 *
 * Displays vaccine history with summary stats and expandable record list.
 */
const VaccineStatsSection: React.FC<VaccineStatsSectionProps> = ({
  vaccineRecords,
  isLoading,
}) => {
  const { t } = useLocalization();
  const { formatDate } = useTimezone();
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  const totalVaccines = vaccineRecords.length;
  const uniqueVaccines = new Set(vaccineRecords.map((r) => r.vaccineName)).size;
  const lastVaccineDate = vaccineRecords.length > 0
    ? formatDate(vaccineRecords[0].time)
    : t('N/A');

  const toggleExpanded = (recordId: string) => {
    setExpandedRecordId((prev) => (prev === recordId ? null : recordId));
  };

  return (
    <AccordionItem value="vaccines">
      <AccordionTrigger className={cn(styles.accordionTrigger, "reports-accordion-trigger")}>
        <Syringe className={cn(styles.accordionTriggerIcon, "reports-accordion-trigger-icon reports-icon-measurement")} />
        <span>{t('Vaccine History')}</span>
      </AccordionTrigger>
      <AccordionContent className={styles.accordionContent}>
        {isLoading ? (
          <div className={cn(styles.emptyContainer, "reports-empty-container")}>
            <p className={cn(styles.emptyText, "reports-empty-text")}>
              {t('Loading...')}
            </p>
          </div>
        ) : totalVaccines === 0 ? (
          <div className={cn(styles.emptyContainer, "reports-empty-container")}>
            <p className={cn(styles.emptyText, "reports-empty-text")}>
              {t('No vaccines recorded.')}
            </p>
          </div>
        ) : (
          <>
            <div className={styles.statsGrid}>
              <Card className={cn(styles.statCard, "reports-stat-card")}>
                <CardContent className="p-4">
                  <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                    {totalVaccines}
                  </div>
                  <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>{t('Total Vaccines')}</div>
                </CardContent>
              </Card>

              <Card className={cn(styles.statCard, "reports-stat-card")}>
                <CardContent className="p-4">
                  <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                    {uniqueVaccines}
                  </div>
                  <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>{t('Unique Vaccines')}</div>
                </CardContent>
              </Card>

              <Card className={cn(styles.statCard, "reports-stat-card")}>
                <CardContent className="p-4">
                  <div className={cn(styles.statCardValue, "reports-stat-card-value text-base")}>
                    {lastVaccineDate}
                  </div>
                  <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>{t('Last Vaccine Date')}</div>
                </CardContent>
              </Card>
            </div>

            {/* Vaccine records list */}
            <div className="mt-4 space-y-2">
              {vaccineRecords.map((record) => {
                const isExpanded = expandedRecordId === record.id;
                const contactNames = record.contacts?.map((c) => c.contact.name).join(', ');

                return (
                  <div
                    key={record.id}
                    className="rounded-md border border-gray-200 bg-white overflow-hidden reports-health-vaccine-item"
                  >
                    {/* Summary row */}
                    <div
                      className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 reports-health-vaccine-header"
                      onClick={() => toggleExpanded(record.id)}
                    >
                      <div className="flex items-center flex-1 min-w-0">
                        <div className="flex-shrink-0 rounded-full bg-teal-100 p-1.5 reports-health-vaccine-icon-bg">
                          <Syringe className="h-3.5 w-3.5 text-teal-600" />
                        </div>
                        <div className="ml-2 min-w-0 flex-1">
                          <div className="font-medium text-sm truncate reports-health-vaccine-name">
                            {record.vaccineName}
                          </div>
                          <div className="text-xs text-gray-500 reports-health-vaccine-date">
                            {formatDate(record.time)}
                            {record.doseNumber && ` - ${t('Dose')} ${record.doseNumber}`}
                          </div>
                        </div>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-gray-500 transition-transform duration-200",
                          isExpanded && "rotate-180"
                        )}
                      />
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-gray-100 reports-health-vaccine-detail">
                        {record.doseNumber && (
                          <div className="text-sm text-gray-600 reports-health-vaccine-detail-row">
                            <span className="font-medium">{t('Dose Number')}:</span> {record.doseNumber}
                          </div>
                        )}
                        {contactNames && (
                          <div className="text-sm text-gray-600 mt-1 reports-health-vaccine-detail-row">
                            <span className="font-medium">{t('Provider')}:</span> {contactNames}
                          </div>
                        )}
                        {record.notes && (
                          <div className="text-sm text-gray-600 mt-1 reports-health-vaccine-detail-row">
                            <span className="font-medium">{t('Notes')}:</span> {record.notes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </AccordionContent>
    </AccordionItem>
  );
};

export default VaccineStatsSection;
