'use client';

import React, { useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useLocalization } from '@/src/context/localization';
import { reportCardStyles as s } from './monthly-report-card.styles';
import type { MonthSelectorProps } from './monthly-report-card.types';

const MonthSelector: React.FC<MonthSelectorProps> = ({
  selectedMonth,
  onMonthChange,
  birthDate,
  daysTracked,
  daysInMonth,
  isCurrentMonth,
  elapsedDays,
  hideArrows,
}) => {
  const { t } = useLocalization();
  const [animating, setAnimating] = useState(false);
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const monthLabel = selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const subLabel = isCurrentMonth
    ? `${daysTracked} ${t('of')} ${elapsedDays} ${t('days tracked')}`
    : `${daysTracked} ${t('days tracked')}`;

  // Check bounds
  const atBirthMonth = selectedMonth.getFullYear() === birthDate.getFullYear() && selectedMonth.getMonth() === birthDate.getMonth();
  const now = new Date();
  const atCurrentMonth = selectedMonth.getFullYear() === now.getFullYear() && selectedMonth.getMonth() === now.getMonth();

  const navigate = useCallback((dir: -1 | 1) => {
    if (animating) return;
    setAnimating(true);
    setSlideDir(dir === -1 ? 'left' : 'right');

    setTimeout(() => {
      const newDate = new Date(selectedMonth);
      newDate.setMonth(newDate.getMonth() + dir);
      onMonthChange(newDate);
      setSlideDir(null);
      setAnimating(false);
    }, 300);
  }, [selectedMonth, onMonthChange, animating]);

  const slideStyle: React.CSSProperties = slideDir
    ? {
        transform: `translateX(${slideDir === 'left' ? '-100%' : '100%'})`,
        opacity: 0,
        transition: 'transform 0.3s cubic-bezier(.4,0,.2,1), opacity 0.3s cubic-bezier(.4,0,.2,1)',
      }
    : {
        transform: 'translateX(0)',
        opacity: 1,
        transition: 'transform 0.3s cubic-bezier(.4,0,.2,1), opacity 0.3s cubic-bezier(.4,0,.2,1)',
      };

  return (
    <div className={cn(s.monthSelector)}>
      {!hideArrows && (
        <button
          className={cn(s.monthButton, 'report-card-month-button')}
          onClick={() => navigate(-1)}
          disabled={atBirthMonth}
          aria-label={t('Previous month')}
          type="button"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      <div className={cn(s.monthStrip)}>
        <div ref={cardRef} className={cn(s.monthCard)} style={slideStyle}>
          <span className={cn(s.monthLabel, 'report-card-month-label')}>{monthLabel}</span>
          <span className={cn(s.monthSub, 'report-card-month-sub')}>{subLabel}</span>
        </div>
      </div>

      {!hideArrows && (
        <button
          className={cn(s.monthButton, 'report-card-month-button')}
          onClick={() => navigate(1)}
          disabled={atCurrentMonth}
          aria-label={t('Next month')}
          type="button"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default MonthSelector;
