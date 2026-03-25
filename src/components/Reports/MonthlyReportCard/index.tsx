'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useBaby } from '@/app/context/baby';
import { useLocalization } from '@/src/context/localization';
import { Button } from '@/src/components/ui/button';
import { reportCardStyles as s } from './monthly-report-card.styles';
import type { MonthlyReportCardProps, MonthlyReport } from './monthly-report-card.types';
import MonthSelector from './MonthSelector';
import GrowthSummarySection from './GrowthSummarySection';
import FeedingSection from './FeedingSection';
import SleepSection from './SleepSection';
import DiapersSection from './DiapersSection';
import ActivitySection from './ActivitySection';
import MilestonesSection from './MilestonesSection';
import HealthSection from './HealthSection';
import CaretakerSection from './CaretakerSection';
import ReportFooter from './ReportFooter';
import { getElapsedDays } from './monthly-report-card.helpers';

import './monthly-report-card.css';

const MonthlyReportCard: React.FC<MonthlyReportCardProps> = ({ className }) => {
  const { t } = useLocalization();
  const { selectedBaby } = useBaby();
  const reportRef = useRef<HTMLDivElement>(null);

  // Month state — default to current month
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Data state
  const [reportData, setReportData] = useState<MonthlyReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [isPdfMode, setIsPdfMode] = useState(false);

  // Cache past months — cleared on mount so settings changes (e.g. unit preferences) take effect
  const cacheRef = useRef<Map<string, MonthlyReport>>(new Map());
  useEffect(() => {
    cacheRef.current.clear();
  }, []);

  const yearMonth = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;

  // Fetch report data
  const fetchReport = useCallback(async () => {
    if (!selectedBaby) return;

    const now = new Date();
    const isCurrentMonth = selectedMonth.getFullYear() === now.getFullYear() && selectedMonth.getMonth() === now.getMonth();

    // Use cache for past months
    if (!isCurrentMonth && cacheRef.current.has(yearMonth)) {
      setReportData(cacheRef.current.get(yearMonth)!);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`/api/babies/${selectedBaby.id}/report/${yearMonth}`, {
        cache: 'no-store',
        headers: {
          'Authorization': authToken ? `Bearer ${authToken}` : '',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to fetch report');
        setReportData(null);
        return;
      }

      const data = await response.json();
      if (data.success && data.data) {
        setReportData(data.data);
        // Cache past months
        if (!isCurrentMonth) {
          cacheRef.current.set(yearMonth, data.data);
        }
      } else {
        setError(data.error || 'Failed to fetch report');
        setReportData(null);
      }
    } catch {
      setError('Error fetching report');
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBaby, yearMonth, selectedMonth]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // PDF export — switches to PDF mode, waits for chart animations to finish,
  // then captures the full report with 0.5" page margins.
  // Uses child element boundaries as page-break candidates so no element gets clipped.
  const handleExportPdf = async () => {
    if (!reportRef.current || !reportData) return;
    setExporting(true);
    setIsPdfMode(true);

    // Wait for React re-render + chart animations to complete (animations are disabled
    // in PDF mode, but give extra time for layout reflow with new elements).
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
      ]);

      const MARGIN_MM = 12.7; // 0.5 inches
      const PAGE_W = 215.9; // US Letter width mm
      const PAGE_H = 279.4; // US Letter height mm
      const CONTENT_W = PAGE_W - MARGIN_MM * 2;
      const CONTENT_H = PAGE_H - MARGIN_MM * 2;

      const container = reportRef.current;

      // Capture the entire report as one canvas (preserves all spacing between elements)
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      // Scale factor: how the canvas pixels map to mm on the PDF
      const scaleMm = CONTENT_W / canvas.width; // mm per canvas pixel

      // Build a list of "safe break" positions (in canvas pixels) from the top edges
      // of each direct child element. We'll only break between children, never mid-child.
      const containerTop = container.getBoundingClientRect().top;
      const canvasScale = canvas.width / container.offsetWidth; // canvas px per DOM px
      const breakPoints: number[] = [0]; // start of content

      const children = Array.from(container.children) as HTMLElement[];
      for (const child of children) {
        if (child.offsetHeight === 0) continue;
        const childTop = (child.getBoundingClientRect().top - containerTop) * canvasScale;
        const childBottom = childTop + child.offsetHeight * canvasScale;
        // The top of each child is a valid break point
        if (childTop > 0) breakPoints.push(Math.round(childTop));
        // Also add the bottom as a candidate (for trailing whitespace)
        breakPoints.push(Math.round(childBottom));
      }
      breakPoints.push(canvas.height); // end of content

      // De-duplicate and sort
      const uniqueBreaks = Array.from(new Set(breakPoints)).sort((a, b) => a - b);

      // Now paginate: greedily fill each page with as many child blocks as fit
      const pdf = new jsPDF('p', 'mm', 'letter');
      const contentHPx = CONTENT_H / scaleMm; // max canvas pixels per page
      let srcY = 0;
      let pageIndex = 0;

      while (srcY < canvas.height - 1) {
        if (pageIndex > 0) pdf.addPage();

        // Find the furthest break point that fits within one page from srcY
        let bestBreak = srcY; // fallback: no progress (shouldn't happen)
        for (const bp of uniqueBreaks) {
          if (bp <= srcY) continue;
          if ((bp - srcY) <= contentHPx) {
            bestBreak = bp;
          } else {
            break; // past the page limit
          }
        }

        // If no break point fit (single element taller than a page), force the page boundary
        if (bestBreak <= srcY) {
          bestBreak = Math.min(srcY + Math.round(contentHPx), canvas.height);
        }

        const slicePxH = bestBreak - srcY;
        const sliceMmH = slicePxH * scaleMm;

        // Create slice canvas
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = slicePxH;
        const ctx = sliceCanvas.getContext('2d')!;
        ctx.drawImage(canvas, 0, srcY, canvas.width, slicePxH, 0, 0, canvas.width, slicePxH);

        const sliceData = sliceCanvas.toDataURL('image/png');
        pdf.addImage(sliceData, 'PNG', MARGIN_MM, MARGIN_MM, CONTENT_W, sliceMmH);

        srcY = bestBreak;
        pageIndex++;
      }

      const fileName = `${reportData.baby.firstName}_report_${yearMonth}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setIsPdfMode(false);
      setExporting(false);
    }
  };

  if (!selectedBaby) return null;

  const birthDate = new Date(selectedBaby.birthDate);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn(s.loading)}>
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        <p className={cn(s.loadingText, 'report-card-loading-text')}>{t('Loading report...')}</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn(s.error)}>
        <p className={cn(s.errorText, 'report-card-error-text')}>{error}</p>
        <Button variant="outline" onClick={fetchReport}>{t('Retry')}</Button>
      </div>
    );
  }

  // Period info from report or defaults
  const period = reportData?.period || {
    daysInMonth: new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate(),
    daysTracked: 0,
    isCurrentMonth: selectedMonth.getFullYear() === new Date().getFullYear() && selectedMonth.getMonth() === new Date().getMonth(),
  };
  const elapsedDays = getElapsedDays(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1);

  return (
    <div className={cn(s.container, className, 'report-card-container')} ref={reportRef}>
      {/* Header */}
      <div className={cn(s.header)}>
        <div className={cn(s.headerInfo)}>
          <p className={cn(s.headerName, 'report-card-header-name')}>
            {t("{name}'s Monthly Report").replace('{name}', selectedBaby.firstName)}
          </p>
          {reportData && (
            <p className={cn(s.headerAge, 'report-card-header-age')}>
              {t('Born:')} {new Date(reportData.baby.birthDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              {' · '}
              {reportData.baby.ageAtEndOfMonth.months < 1
                ? `${Math.max(1, Math.round((reportData.baby.ageAtEndOfMonth.months * 4.33) + (reportData.baby.ageAtEndOfMonth.days / 7)))} ${t('weeks old')}`
                : `${reportData.baby.ageAtEndOfMonth.months} ${t('months old')}`
              }
            </p>
          )}
        </div>
        {!isPdfMode && (
          <button
            className={cn(s.pdfButton, 'report-card-pdf-button')}
            onClick={handleExportPdf}
            disabled={exporting || !reportData}
            type="button"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{exporting ? t('Exporting PDF...') : t('PDF export')}</span>
          </button>
        )}
      </div>

      {/* Month selector */}
      <MonthSelector
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        birthDate={birthDate}
        daysTracked={period.daysTracked}
        daysInMonth={period.daysInMonth}
        isCurrentMonth={period.isCurrentMonth}
        elapsedDays={elapsedDays}
        hideArrows={isPdfMode}
      />

      {/* Report content */}
      {!reportData || period.daysTracked === 0 ? (
        <div className={cn(s.emptyState)}>
          <p className={cn(s.emptyText, 'report-card-empty-text')}>
            {t('No data logged for')} {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      ) : (
        <>
          {/* Growth */}
          <GrowthSummarySection growth={reportData.growth} babyName={selectedBaby.firstName} isPdfExport={isPdfMode} />

          {/* Feeding */}
          <FeedingSection feeding={reportData.feeding} />

          {/* Sleep */}
          <SleepSection sleep={reportData.sleep} isPdfExport={isPdfMode} />

          {/* Diapers */}
          <DiapersSection diapers={reportData.diapers} />

          {/* Activity & Play */}
          <ActivitySection activity={reportData.activity} />

          {/* Milestones */}
          <MilestonesSection milestones={reportData.milestones} />

          {/* Health & Medicine */}
          <HealthSection health={reportData.health} />

          {/* Caretaker Activity */}
          <CaretakerSection caretakers={reportData.caretakers} />

          {/* Footer */}
          {isPdfMode && <ReportFooter />}
        </>
      )}
    </div>
  );
};

export default MonthlyReportCard;
