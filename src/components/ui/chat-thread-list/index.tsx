'use client';

import React from 'react';
import { cn } from '@/src/lib/utils';
import { Plus, X, MessageSquare } from 'lucide-react';
import { useTheme } from '@/src/context/theme';
import { useLocalization } from '@/src/context/localization';
import { useTimezone } from '@/app/context/timezone';
import { formatDateShort } from '@/src/utils/dateFormat';
import { chatThreadListStyles as styles } from './chat-thread-list.styles';
import type { ChatThreadListProps } from './chat-thread-list.types';
import './chat-thread-list.css';

export function ChatThreadList({
  threads,
  selectedThreadId,
  onSelectThread,
  onNewThread,
  showNewActive,
  hideNewButton,
  hideHeader,
  isAdmin,
  formatDateTime,
  countUnread,
  searchTerm,
  onSearchChange,
  className,
}: ChatThreadListProps) {
  const { theme } = useTheme();
  const { t } = useLocalization();
  const { dateFormat } = useTimezone();

  const getLastSenderLabel = (thread: typeof threads[0]): string => {
    const replies = thread.replies || [];
    const lastMessage = replies.length > 0
      ? replies[replies.length - 1]
      : thread;
    const isAdminMessage = lastMessage.submitterName === 'Admin';

    if (isAdmin) {
      return isAdminMessage ? t('You replied') : (thread.submitterName || t('User'));
    }
    return isAdminMessage ? t('Admin replied') : t('You');
  };

  const getMessageCount = (thread: typeof threads[0]): number => {
    return 1 + (thread.replies?.length || 0);
  };

  const getLastActivity = (thread: typeof threads[0]): string => {
    const replies = thread.replies || [];
    const lastDate = replies.length > 0
      ? replies[replies.length - 1].submittedAt
      : thread.submittedAt;
    const date = new Date(lastDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return t('Just now');
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    return formatDateShort(date, dateFormat);
  };

  return (
    <div className={cn(styles.container, 'chat-thread-list-container', className)}>
      {/* Header */}
      {!hideHeader && (
        <div className={cn(styles.header, 'chat-thread-list-header')}>
          <span className={cn(styles.headerTitle, 'chat-thread-list-header-title')}>
            {t('Messages')}
          </span>
          {!hideNewButton && onNewThread && (
            <button
              onClick={onNewThread}
              title={t('New feedback')}
              className={cn(
                styles.toggleButton,
                showNewActive
                  ? cn(styles.toggleButtonActive, 'chat-thread-list-toggle-active')
                  : cn(styles.toggleButtonInactive, 'chat-thread-list-toggle-inactive'),
              )}
            >
              {showNewActive
                ? <X className="h-3.5 w-3.5 text-gray-600" />
                : <Plus className="h-3.5 w-3.5 text-emerald-500" />
              }
            </button>
          )}
        </div>
      )}

      {/* Search (admin only) */}
      {onSearchChange && (
        <div className={cn('chat-thread-list-search', styles.searchContainer)}>
          <input
            type="text"
            value={searchTerm || ''}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={t('Search messages...')}
            className={cn(styles.searchInput, 'chat-thread-list-search-input')}
          />
        </div>
      )}

      {/* Thread List */}
      <div className={styles.list}>
        {threads.length === 0 ? (
          <div className={cn(styles.emptyState, 'chat-thread-list-empty')}>
            <MessageSquare className="h-8 w-8" />
            <span>{t('No messages yet')}</span>
          </div>
        ) : (
          threads.map(thread => {
            const active = thread.id === selectedThreadId && !showNewActive;
            const unreadCount = countUnread(thread);
            const hasUnread = unreadCount > 0;
            const msgCount = getMessageCount(thread);

            return (
              <div
                key={thread.id}
                onClick={() => onSelectThread(thread.id)}
                className={cn(
                  styles.threadItem,
                  'chat-thread-list-item',
                  active
                    ? cn(styles.threadItemActive, 'chat-thread-list-item-active')
                    : styles.threadItemInactive,
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span
                    className={cn(
                      styles.threadSubject,
                      'chat-thread-list-subject',
                      hasUnread ? styles.threadSubjectUnread : styles.threadSubjectRead,
                    )}
                  >
                    {thread.subject}
                  </span>
                  {hasUnread && <div className={styles.unreadDot} />}
                </div>
                <div className={cn(styles.threadMeta, 'chat-thread-list-meta')}>
                  <span className={styles.threadMetaLeft}>
                    {getLastSenderLabel(thread)}
                    {isAdmin && thread.familySlug
                      ? ` · ${thread.familySlug}`
                      : ''
                    }
                    {' · '}{msgCount} {t('msg')}{msgCount > 1 ? 's' : ''}
                  </span>
                  <span className={cn(styles.threadMetaRight, 'chat-thread-list-meta-right')}>
                    {getLastActivity(thread)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ChatThreadList;
