import React from 'react';
import { Button } from '@/src/components/ui/button';
import { Baby as BabyIcon } from 'lucide-react';
import { FullLogActivityListProps } from './full-log-timeline.types';
import { cn } from '@/src/lib/utils';
import styles from './full-log-timeline.styles';
import { getActivityIcon, getActivityStyle, getActivityDescription } from '@/src/components/Timeline/utils';
import { useLocalization } from '@/src/context/localization';

/**
 * FullLogActivityList Component
 * 
 * Displays a list of activities with pagination controls
 */
const FullLogActivityList: React.FC<FullLogActivityListProps> = ({
  activities,
  settings,
  isLoading,
  itemsPerPage,
  currentPage,
  totalPages,
  onActivitySelect,
  onPageChange,
  onItemsPerPageChange,
}) => {
  const { t } = useLocalization();
  
  return (
    <>
      {/* Scrollable Content */}
      <div className={cn(styles.content, "full-log-timeline-content")}>
        <div className={cn(styles.activityList, "full-log-timeline-activity-list")}>
          {activities.length > 0 ? (
            activities.map((activity) => {
              const style = getActivityStyle(activity);
              const description = getActivityDescription(activity, settings, t);
              return (
                <div
                  key={activity.id}
                  className={cn(styles.activityItem, "full-log-timeline-activity-item")}
                  onClick={() => onActivitySelect(activity)}
                >
                  <div className={cn(styles.activityContent, "full-log-timeline-activity-content")}>
                    <div className={cn(styles.activityIcon, style.bg, "full-log-timeline-activity-icon")}>
                      {getActivityIcon(activity)}
                    </div>
                    <div className={cn(styles.activityDetails, "full-log-timeline-activity-details")}>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={cn(styles.activityType, "full-log-timeline-activity-type")}>
                          {description.type}
                        </span>
                        <span className={cn(styles.activityInfo, "full-log-timeline-activity-info")}>
                          {description.details}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : !isLoading && (
            <div className={cn(styles.emptyState, "full-log-timeline-empty-state")}>
              <div className={cn(styles.emptyStateContent, "full-log-timeline-empty-state-content")}>
                <div className={cn(styles.emptyStateIcon, "full-log-timeline-empty-state-icon")}>
                  <BabyIcon className={cn(styles.emptyStateIconInner, "full-log-timeline-empty-state-icon-inner")} />
                </div>
                <h3 className={cn(styles.emptyStateTitle, "full-log-timeline-empty-state-title")}>
                  {t('No activities recorded')}
                </h3>
                <p className={cn(styles.emptyStateDescription, "full-log-timeline-empty-state-description")}>
                  {t('Activities will appear here once you start tracking')}
                </p>
              </div>
            </div>
          )}
          
          {/* Loading State */}
          {isLoading && activities.length === 0 && (
            <div className={cn(styles.emptyState, "full-log-timeline-loading-container")}>
              <div className={cn(styles.emptyStateContent, "full-log-timeline-loading-content")}>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                  <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
                <h3 className={cn(styles.emptyStateTitle, "full-log-timeline-loading-text")}>
                  {t('Loading activities...')}
                </h3>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pagination Controls */}
      {activities.length > 0 && (
        <div className={cn(styles.paginationContainer, "full-log-timeline-pagination-container")}>
          <select
            className={cn(styles.paginationSelect, "full-log-timeline-pagination-select")}
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          >
            <option value="5">{t('5 per page')}</option>
            <option value="10">{t('10 per page')}</option>
            <option value="20">{t('20 per page')}</option>
            <option value="50">{t('50 per page')}</option>
          </select>
          
          {totalPages > 1 && (
            <div className={cn(styles.paginationControls, "full-log-timeline-pagination-controls")}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                {'<'}
              </Button>
              <span className={cn(styles.paginationText, "full-log-timeline-pagination-text")}>
                {t('Page')} {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                {'>'}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default FullLogActivityList;
