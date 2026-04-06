'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FormPage,
  FormPageFooter,
} from '@/src/components/ui/form-page';
import { Button } from '@/src/components/ui/button';
import { ChevronLeft, Plus, Send } from 'lucide-react';
import { useTheme } from '@/src/context/theme';
import { useLocalization } from '@/src/context/localization';
import { useFeedbackChat } from '@/src/hooks/useFeedbackChat';
import { ChatThreadList } from '@/src/components/ui/chat-thread-list';
import { ChatConversation, ChatReplyBar } from '@/src/components/ui/chat-conversation';
import { ChatNewFeedback } from '@/src/components/ui/chat-new-feedback';
import type { ChatNewFeedbackRef } from '@/src/components/ui/chat-new-feedback/chat-new-feedback.types';

interface FeedbackPageProps {
  isOpen: boolean;
  onClose: () => void;
}

type ViewState = 'list' | 'conversation' | 'new';

export default function FeedbackPage({
  isOpen,
  onClose,
}: FeedbackPageProps) {
  const { t } = useLocalization();
  const { theme } = useTheme();
  const [viewState, setViewState] = useState<ViewState>('list');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [canSendNew, setCanSendNew] = useState(false);
  const newFeedbackRef = useRef<ChatNewFeedbackRef>(null);

  const {
    threads,
    loading,
    fetchThreads,
    sendReply,
    sendNewFeedback,
    deleteAttachment,
    markAsRead,
    formatDateTime,
    countUnreadMessages,
    loadSubmitterInfo,
    startPolling,
    stopPolling,
  } = useFeedbackChat(false);

  useEffect(() => {
    if (isOpen) {
      fetchThreads();
      loadSubmitterInfo();
      startPolling();
    } else {
      stopPolling();
      setViewState('list');
      setSelectedThreadId(null);
    }
  }, [isOpen, fetchThreads, loadSubmitterInfo, startPolling, stopPolling]);

  const handleSelectThread = useCallback((threadId: string) => {
    setSelectedThreadId(threadId);
    setViewState('conversation');
  }, []);

  const handleNewToggle = useCallback(() => {
    if (viewState === 'new') {
      setViewState('list');
    } else {
      setSelectedThreadId(null);
      setViewState('new');
    }
  }, [viewState]);

  const handleBack = useCallback(() => {
    setViewState('list');
    setSelectedThreadId(null);
  }, []);

  const handleNewSubmit = useCallback(async (subject: string, message: string, files?: File[]) => {
    await sendNewFeedback(subject, message, files);
    setViewState('list');
  }, [sendNewFeedback]);

  const selectedThread = threads.find(t => t.id === selectedThreadId) || null;

  const isConversation = viewState === 'conversation' && selectedThread;
  const isNewFeedback = viewState === 'new';
  const title = isConversation
    ? selectedThread.subject
    : isNewFeedback
      ? t('New feedback')
      : t('Feedback');
  const description = isConversation
    ? `${1 + (selectedThread.replies?.length || 0)} ${t('message')}${(selectedThread.replies?.length || 0) > 0 ? 's' : ''}`
    : isNewFeedback
      ? t('Send a message to the Sprout Track team')
      : t('View your messages and submit new feedback');

  const backButton = (isConversation || isNewFeedback) ? (
    <button
      onClick={handleBack}
      className="text-emerald-500 flex items-center mr-2 bg-transparent border-none cursor-pointer p-0"
      aria-label={t('Back')}
    >
      <ChevronLeft className="h-5 w-5" />
    </button>
  ) : undefined;

  return (
    <FormPage
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      leadingAction={backButton}
      fullContent
    >
      {viewState === 'list' && (
        <ChatThreadList
          threads={threads}
          selectedThreadId={selectedThreadId}
          onSelectThread={handleSelectThread}
          hideNewButton
          hideHeader
          isAdmin={false}
          formatDateTime={formatDateTime}
          countUnread={countUnreadMessages}
          className="flex-1 min-h-0"
        />
      )}

      {viewState === 'conversation' && (
        <ChatConversation
          thread={selectedThread}
          isAdmin={false}
          onReply={sendReply}
          onDeleteAttachment={deleteAttachment}
          onBack={handleBack}
          onMarkRead={markAsRead}
          formatDateTime={formatDateTime}
          hideHeader
          hideReplyBar
          className="flex-1 min-h-0"
        />
      )}

      {isNewFeedback && (
        <ChatNewFeedback
          ref={newFeedbackRef}
          onSubmit={handleNewSubmit}
          onCancel={handleBack}
          hideHeader
          hideFooter
          onCanSendChange={setCanSendNew}
          className="flex-1 min-h-0"
        />
      )}

      {isConversation ? (
        <FormPageFooter>
          <ChatReplyBar
            threadId={selectedThread.id}
            subject={selectedThread.subject}
            familyId={selectedThread.familyId}
            onReply={sendReply}
          />
        </FormPageFooter>
      ) : isNewFeedback ? (
        <FormPageFooter>
          <div className="flex justify-between w-full">
            <Button
              onClick={() => newFeedbackRef.current?.submit()}
              disabled={!canSendNew}
              variant="success"
            >
              <Send className="h-4 w-4 mr-1.5" />
              {t('Send feedback')}
            </Button>
            <Button onClick={handleBack} variant="outline">
              {t('Cancel')}
            </Button>
          </div>
        </FormPageFooter>
      ) : (
        <FormPageFooter>
          <div className="flex justify-between w-full">
            <Button onClick={handleNewToggle} variant="outline">
              <Plus className="h-4 w-4 mr-1.5" />
              {t('New Feedback')}
            </Button>
            <Button onClick={onClose} variant="outline">
              {t('Close')}
            </Button>
          </div>
        </FormPageFooter>
      )}
    </FormPage>
  );
}
