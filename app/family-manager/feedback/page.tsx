'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocalization } from '@/src/context/localization';
import { useDeployment } from '@/app/context/deployment';
import { useAdminCounts } from '@/src/components/familymanager/admin-count-context';
import { useIsMobile } from '@/src/hooks/useIsMobile';
import { useFeedbackChat } from '@/src/hooks/useFeedbackChat';
import { ChatThreadList } from '@/src/components/ui/chat-thread-list';
import { ChatConversation } from '@/src/components/ui/chat-conversation';

export default function FeedbackPage() {
  const { t } = useLocalization();
  const { isSaasMode } = useDeployment();
  const router = useRouter();
  const { updateCount } = useAdminCounts();
  const isMobile = useIsMobile();

  const {
    threads,
    loading,
    fetchThreads,
    sendReply,
    deleteAttachment,
    markAsRead,
    formatDateTime,
    countUnreadMessages,
    loadSubmitterInfo,
    startPolling,
    stopPolling,
  } = useFeedbackChat(true);

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isSaasMode) {
      router.replace('/family-manager/families');
    }
  }, [isSaasMode, router]);

  useEffect(() => {
    if (!isSaasMode) return;
    fetchThreads();
    loadSubmitterInfo();
    startPolling();
    return () => stopPolling();
  }, [isSaasMode, fetchThreads, loadSubmitterInfo, startPolling, stopPolling]);

  // Update admin counts when threads change
  useEffect(() => {
    if (threads.length > 0) {
      const unreadCount = threads.filter(item => !item.viewed).length;
      updateCount('feedback', unreadCount);
    }
  }, [threads, updateCount]);

  // Sort threads: unread first, then by date
  const sortedThreads = useMemo(() => {
    return [...threads].sort((a, b) => {
      const aUnread = countUnreadMessages(a);
      const bUnread = countUnreadMessages(b);
      if (aUnread !== bUnread) return bUnread - aUnread;
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    });
  }, [threads, countUnreadMessages]);

  // Filter by search
  const filteredThreads = useMemo(() => {
    if (!searchTerm) return sortedThreads;
    const search = searchTerm.toLowerCase();
    return sortedThreads.filter(item =>
      item.subject.toLowerCase().includes(search) ||
      item.message.toLowerCase().includes(search) ||
      item.submitterName?.toLowerCase().includes(search) ||
      item.submitterEmail?.toLowerCase().includes(search)
    );
  }, [sortedThreads, searchTerm]);

  const selectedThread = threads.find(t => t.id === selectedThreadId) || null;

  const handleSelectThread = useCallback((threadId: string) => {
    setSelectedThreadId(threadId);
    setMobileShowDetail(true);
  }, []);

  const handleMobileBack = useCallback(() => {
    setMobileShowDetail(false);
  }, []);

  if (!isSaasMode) return null;

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const conversationPanel = (
    <ChatConversation
      thread={selectedThread}
      isAdmin={true}
      onReply={sendReply}
      onDeleteAttachment={deleteAttachment}
      onBack={isMobile ? handleMobileBack : undefined}
      showBackButton={isMobile}
      onMarkRead={markAsRead}
      formatDateTime={formatDateTime}
      className="flex-1"
    />
  );

  return (
    <div className="flex flex-row h-full overflow-hidden">
      {/* Desktop: side-by-side layout */}
      {!isMobile && (
        <>
          <div className="w-72 flex-shrink-0 border-r border-slate-200 chat-admin-thread-list min-h-0">
            <ChatThreadList
              threads={filteredThreads}
              selectedThreadId={selectedThreadId}
              onSelectThread={handleSelectThread}
              hideNewButton={true}
              isAdmin={true}
              formatDateTime={formatDateTime}
              countUnread={countUnreadMessages}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
            />
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            {conversationPanel}
          </div>
        </>
      )}

      {/* Mobile: stacked layout */}
      {isMobile && !mobileShowDetail && (
        <ChatThreadList
          threads={filteredThreads}
          selectedThreadId={selectedThreadId}
          onSelectThread={handleSelectThread}
          hideNewButton={true}
          isAdmin={true}
          formatDateTime={formatDateTime}
          countUnread={countUnreadMessages}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          className="flex-1"
        />
      )}

      {isMobile && mobileShowDetail && conversationPanel}
    </div>
  );
}
