'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Trophy, Loader2, Calendar } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Card, CardContent } from '@/src/components/ui/card';
import { useBaby } from '@/app/context/baby';
import { styles } from './reports.styles';
import { MilestonesTabProps, MilestoneActivity } from './reports.types';

interface MilestonesByAge {
  ageInMonths: number;
  label: string;
  milestones: MilestoneActivity[];
}

/**
 * MilestonesTab Component
 *
 * Displays all milestones grouped by baby's age in months.
 * Ignores the date range and shows all milestones for the selected baby.
 */
const MilestonesTab: React.FC<MilestonesTabProps> = () => {
  const { selectedBaby } = useBaby();
  const [milestones, setMilestones] = useState<MilestoneActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all milestones for the selected baby (ignoring date range)
  useEffect(() => {
    if (!selectedBaby) {
      setMilestones([]);
      return;
    }

    const fetchMilestones = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const authToken = localStorage.getItem('authToken');

        const response = await fetch(`/api/milestone-log?babyId=${selectedBaby.id}`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authToken ? `Bearer ${authToken}` : '',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setMilestones(data.data || []);
          } else {
            setError(data.message || 'Failed to fetch milestones');
          }
        } else {
          setError('Failed to fetch milestones');
        }
      } catch (err) {
        console.error('Error fetching milestones:', err);
        setError('Error fetching milestones');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMilestones();
  }, [selectedBaby]);

  // Calculate age in months at the time of milestone
  const calculateAgeInMonths = (milestoneDate: string): number => {
    if (!selectedBaby?.birthDate) return 0;

    const birthDate = new Date(selectedBaby.birthDate);
    const milestone = new Date(milestoneDate);

    const months = (milestone.getFullYear() - birthDate.getFullYear()) * 12 +
      (milestone.getMonth() - birthDate.getMonth());

    // If the day of the month hasn't passed yet, subtract a month
    if (milestone.getDate() < birthDate.getDate()) {
      return Math.max(0, months - 1);
    }

    return Math.max(0, months);
  };

  // Format age label
  const formatAgeLabel = (months: number): string => {
    if (months === 0) return 'Newborn (0 months)';
    if (months === 1) return '1 month';
    if (months < 12) return `${months} months`;

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    if (remainingMonths === 0) {
      return years === 1 ? '1 year' : `${years} years`;
    }

    const yearPart = years === 1 ? '1 year' : `${years} years`;
    const monthPart = remainingMonths === 1 ? '1 month' : `${remainingMonths} months`;

    return `${yearPart}, ${monthPart}`;
  };

  // Group milestones by age in months
  const groupedMilestones = useMemo((): MilestonesByAge[] => {
    if (!milestones.length) return [];

    const groups: Record<number, MilestoneActivity[]> = {};

    milestones.forEach((milestone) => {
      const ageInMonths = calculateAgeInMonths(milestone.date);

      if (!groups[ageInMonths]) {
        groups[ageInMonths] = [];
      }
      groups[ageInMonths].push(milestone);
    });

    // Sort groups by age (descending - most recent first)
    return Object.entries(groups)
      .map(([ageStr, mils]) => ({
        ageInMonths: parseInt(ageStr, 10),
        label: formatAgeLabel(parseInt(ageStr, 10)),
        milestones: mils.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      }))
      .sort((a, b) => b.ageInMonths - a.ageInMonths);
  }, [milestones, selectedBaby]);

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={cn(styles.loadingContainer, "reports-loading-container")}>
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        <p className={cn(styles.loadingText, "reports-loading-text")}>Loading milestones...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn(styles.errorContainer, "reports-error-container")}>
        <p className={cn(styles.errorText, "reports-error-text")}>{error}</p>
      </div>
    );
  }

  // Empty state
  if (!milestones.length) {
    return (
      <div className={cn(styles.emptyContainer, "reports-empty-container")}>
        <Trophy className="h-12 w-12 text-gray-300 mb-4" />
        <p className={cn(styles.emptyText, "reports-empty-text")}>
          No milestones recorded yet.
        </p>
        <p className={cn(styles.emptyText, "reports-empty-text text-sm mt-2")}>
          Record milestones to track your baby&apos;s development.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupedMilestones.map((group) => (
        <div key={group.ageInMonths} className="space-y-3">
          {/* Age header */}
          <div className={cn("flex items-center gap-2 pb-2 border-b border-gray-200", "reports-age-header")}>
            <Trophy className="h-5 w-5 text-amber-500" />
            <h3 className={cn("text-lg font-semibold text-gray-800", "reports-age-title")}>
              {group.label}
            </h3>
            <span className={cn("text-sm text-gray-500 ml-auto", "reports-milestone-count")}>
              {group.milestones.length} milestone{group.milestones.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Milestones for this age */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.milestones.map((milestone) => (
              <Card key={milestone.id} className={cn(styles.statCard, "reports-milestone-card")}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("p-2 rounded-lg bg-amber-100", "reports-milestone-icon-bg")}>
                      <Trophy className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={cn("font-medium text-gray-800 truncate", "reports-milestone-title")}>
                        {milestone.title}
                      </h4>
                      {milestone.description && (
                        <p className={cn("text-sm text-gray-600 mt-1 line-clamp-2", "reports-milestone-description")}>
                          {milestone.description}
                        </p>
                      )}
                      <div className={cn("flex items-center gap-1 mt-2 text-xs text-gray-500", "reports-milestone-date")}>
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(milestone.date)}</span>
                        {milestone.category && (
                          <>
                            <span className="mx-1">|</span>
                            <span className={cn("px-1.5 py-0.5 bg-gray-100 rounded text-gray-600", "reports-milestone-category")}>
                              {milestone.category}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MilestonesTab;
