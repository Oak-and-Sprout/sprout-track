'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { VaccineHistoryTabProps } from './vaccine-form.types';
import { VaccineLogResponse } from '@/app/api/types';
import { Button } from '@/src/components/ui/button';
import {
  Loader2,
  AlertCircle,
  Syringe,
  ChevronDown,
  Paperclip,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTimezone } from '@/app/context/timezone';
import { useLocalization } from '@/src/context/localization';

/**
 * VaccineHistoryTab Component
 *
 * Displays a chronological list of vaccine records for a baby.
 * Supports date range filtering, expandable record details,
 * document download links, and export to Excel.
 */
const VaccineHistoryTab: React.FC<VaccineHistoryTabProps> = ({
  babyId,
  refreshTrigger,
}) => {
  const { t } = useLocalization();
  const { formatDate } = useTimezone();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vaccineRecords, setVaccineRecords] = useState<VaccineLogResponse[]>([]);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch vaccine records
  const fetchVaccineRecords = useCallback(async () => {
    if (!babyId) return;

    try {
      setIsLoading(true);
      setError(null);
      const authToken = localStorage.getItem('authToken');

      const url = `/api/vaccine-log?babyId=${babyId}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      if (!response.ok) {
        throw new Error(t('Failed to fetch vaccine records'));
      }

      const data = await response.json();
      const records = data.data || data;
      if (Array.isArray(records)) {
        // Sort newest first
        records.sort((a: VaccineLogResponse, b: VaccineLogResponse) =>
          new Date(b.time).getTime() - new Date(a.time).getTime()
        );
        setVaccineRecords(records);
      } else {
        setVaccineRecords([]);
      }
    } catch (error) {
      console.error('Error fetching vaccine records:', error);
      setError(t('Failed to load vaccine records'));
    } finally {
      setIsLoading(false);
    }
  }, [babyId, t]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchVaccineRecords();
  }, [fetchVaccineRecords]);

  // Listen to refreshTrigger
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchVaccineRecords();
    }
  }, [refreshTrigger, fetchVaccineRecords]);

  // Toggle expanded record
  const toggleExpanded = (recordId: string) => {
    setExpandedRecordId(prev => prev === recordId ? null : recordId);
  };

  // Download a document
  const handleDownloadDocument = async (documentId: string, originalName: string) => {
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`/api/vaccine-log/file/${documentId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      if (!response.ok) {
        throw new Error(t('Failed to download document'));
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading document:', error);
    }
  };

  // Export to Excel
  const handleExport = async () => {
    if (!babyId) return;

    setIsExporting(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const url = `/api/vaccine-log/export?babyId=${babyId}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      if (!response.ok) {
        throw new Error(t('Failed to export vaccine records'));
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `vaccine-records-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting vaccine records:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="vaccine-form-tab-content">
      {/* Export Button */}
      <div className="mb-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full vaccine-form-export-button"
          onClick={handleExport}
          disabled={isExporting || vaccineRecords.length === 0}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <FileSpreadsheet className="h-4 w-4 mr-2" />
          )}
          {t('Export to Excel')}
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-8 vaccine-form-loading-container">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          <p className="mt-2 text-gray-600">{t('Loading vaccine records...')}</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex flex-col items-center justify-center py-8 vaccine-form-error-container">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="mt-2 text-red-500">{error}</p>
          <Button
            variant="outline"
            onClick={fetchVaccineRecords}
            className="mt-2"
          >
            {t('Retry')}
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && vaccineRecords.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 vaccine-form-empty-state">
          <Syringe className="h-12 w-12 mx-auto mb-2 text-gray-400" />
          <p className="text-gray-500">{t('No vaccines recorded')}</p>
        </div>
      )}

      {/* Vaccine records list */}
      {!isLoading && !error && vaccineRecords.length > 0 && (
        <div className="space-y-2">
          {vaccineRecords.map((record) => {
            const isExpanded = expandedRecordId === record.id;
            const hasDocuments = record.documents && record.documents.length > 0;
            const contactNames = record.contacts?.map(c => c.contact.name).join(', ');

            return (
              <div
                key={record.id}
                className="vaccine-history-item rounded-md border border-gray-200 bg-white overflow-hidden"
              >
                {/* Summary row */}
                <div
                  className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 vaccine-history-item-header"
                  onClick={() => toggleExpanded(record.id)}
                >
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="flex-shrink-0 vaccine-form-icon-container rounded-full bg-teal-100 p-1.5">
                      <Syringe className="h-3.5 w-3.5 text-teal-600" />
                    </div>
                    <div className="ml-2 min-w-0 flex-1">
                      <div className="font-medium text-sm truncate vaccine-history-item-name">
                        {record.vaccineName}
                      </div>
                      <div className="text-xs text-gray-500 vaccine-history-item-date">
                        {formatDate(record.time)}
                        {record.doseNumber && ` - ${t('Dose')} ${record.doseNumber}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {hasDocuments && (
                      <Paperclip className="h-3.5 w-3.5 text-gray-400" />
                    )}
                    <ChevronDown className={cn(
                      "h-4 w-4 text-gray-500 transition-transform duration-200",
                      isExpanded && "rotate-180"
                    )} />
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-gray-100 vaccine-history-item-details">
                    {record.doseNumber && (
                      <div className="text-sm text-gray-600 vaccine-history-detail-row">
                        <span className="font-medium">{t('Dose Number')}:</span> {record.doseNumber}
                      </div>
                    )}
                    {contactNames && (
                      <div className="text-sm text-gray-600 mt-1 vaccine-history-detail-row">
                        <span className="font-medium">{t('Provider')}:</span> {contactNames}
                      </div>
                    )}
                    {record.notes && (
                      <div className="text-sm text-gray-600 mt-1 vaccine-history-detail-row">
                        <span className="font-medium">{t('Notes')}:</span> {record.notes}
                      </div>
                    )}

                    {/* Documents */}
                    {hasDocuments && (
                      <div className="mt-2">
                        <div className="text-xs font-medium text-gray-500 mb-1">
                          {t('Documents')}
                        </div>
                        <div className="space-y-1">
                          {record.documents!.map((doc) => (
                            <div
                              key={doc.id}
                              className="vaccine-form-document-item flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs"
                            >
                              <span className="truncate vaccine-form-document-name">
                                {doc.originalName}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadDocument(doc.id, doc.originalName);
                                }}
                                title={t('Download')}
                              >
                                <Download className="h-3.5 w-3.5 text-teal-600" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VaccineHistoryTab;
