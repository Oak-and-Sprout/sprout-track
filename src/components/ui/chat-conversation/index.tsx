'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/src/lib/utils';
import { ChevronLeft, Send, MessageSquare } from 'lucide-react';
import { useTheme } from '@/src/context/theme';
import { useLocalization } from '@/src/context/localization';
import { chatConversationStyles as styles } from './chat-conversation.styles';
import type { ChatConversationProps, ChatReplyBarProps, ChatMessage } from './chat-conversation.types';
import type { FeedbackResponse } from '@/app/api/types';
import './chat-conversation.css';

function flattenMessages(thread: FeedbackResponse, isAdmin: boolean): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const isAdminMsg = thread.submitterName === 'Admin';
  messages.push({
    id: thread.id,
    from: isAdminMsg ? 'admin' : 'user',
    name: thread.submitterName || 'User',
    date: thread.submittedAt,
    text: thread.message,
    viewed: thread.viewed,
  });
  if (thread.replies) {
    for (const reply of thread.replies) {
      const isReplyAdmin = reply.submitterName === 'Admin';
      messages.push({
        id: reply.id,
        from: isReplyAdmin ? 'admin' : 'user',
        name: reply.submitterName || 'User',
        date: reply.submittedAt,
        text: reply.message,
        viewed: reply.viewed,
      });
    }
  }
  return messages;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isSameDay(d1: string, d2: string): boolean {
  const a = new Date(d1);
  const b = new Date(d2);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function ChatConversation({
  thread,
  isAdmin,
  onReply,
  onBack,
  showBackButton = false,
  onMarkRead,
  formatDateTime,
  hideHeader = false,
  hideReplyBar = false,
  className,
}: ChatConversationProps) {
  const { theme } = useTheme();
  const { t } = useLocalization();
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const markedReadRef = useRef<string | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [thread?.id, thread?.replies?.length]);

  // Reset reply text when thread changes
  useEffect(() => {
    setReplyText('');
    setSending(false);
  }, [thread?.id]);

  // Auto-mark unread messages as read
  useEffect(() => {
    if (!thread || !onMarkRead) return;
    if (markedReadRef.current === thread.id) return;
    markedReadRef.current = thread.id;

    const messages = flattenMessages(thread, isAdmin);
    const unreadFromOther = messages.filter(msg => {
      if (!msg.viewed) {
        if (isAdmin) return msg.from === 'user';
        return msg.from === 'admin';
      }
      return false;
    });

    unreadFromOther.forEach(msg => {
      onMarkRead(msg.id);
    });
  }, [thread, isAdmin, onMarkRead]);

  // Reset marked-read tracking when thread changes
  useEffect(() => {
    markedReadRef.current = null;
  }, [thread?.id]);

  const handleSend = useCallback(async () => {
    if (!replyText.trim() || !thread || sending) return;
    setSending(true);
    try {
      await onReply(thread.id, replyText.trim(), thread.subject, thread.familyId);
      setReplyText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Error sending reply:', error);
    } finally {
      setSending(false);
    }
  }, [replyText, thread, sending, onReply]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleTextareaInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  // Empty state
  if (!thread) {
    return (
      <div className={cn(styles.container, 'chat-conversation-container', className)}>
        <div className={cn(styles.emptyState, 'chat-conversation-empty')}>
          <MessageSquare className="h-8 w-8 chat-conversation-empty-icon" strokeWidth={1.5} />
          <span>{t('Select a conversation')}</span>
        </div>
      </div>
    );
  }

  const messages = flattenMessages(thread, isAdmin);
  const totalMessages = messages.length;

  return (
    <div className={cn(styles.container, 'chat-conversation-container', className)}>
      {/* Header */}
      {!hideHeader && (
        <div className={cn(styles.header, 'chat-conversation-header')}>
          {showBackButton && onBack && (
            <button onClick={onBack} className={styles.backButton} aria-label={t('Back')}>
              <ChevronLeft className="h-[18px] w-[18px]" />
            </button>
          )}
          <div className={styles.headerContent}>
            <div className={cn(styles.headerSubject, 'chat-conversation-subject')}>
              {thread.subject}
            </div>
            <div className={cn(styles.headerMeta, 'chat-conversation-meta')}>
              <span>{totalMessages} {t('message')}{totalMessages > 1 ? 's' : ''}</span>
              {isAdmin && thread.submitterName && thread.submitterName !== 'Admin' && (
                <>
                  <span className={cn(styles.headerMetaDivider, 'chat-conversation-meta-divider')}>·</span>
                  <span className={cn(styles.headerMetaName, 'chat-conversation-meta-name')}>
                    {thread.submitterName}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className={cn(styles.messagesArea, 'chat-conversation-messages')}>
        {messages.map((msg, idx) => {
          const isMine = isAdmin ? msg.from === 'admin' : msg.from === 'user';
          const showDateBreak = idx === 0 || !isSameDay(messages[idx - 1].date, msg.date);
          const sameSenderAsPrev = idx > 0 && messages[idx - 1].from === msg.from && !showDateBreak;

          // Avatar and name styling
          let avatarClass: string;
          let avatarDarkClass: string;
          let nameClass: string;
          let nameDarkClass: string;
          let displayName: string;
          let initials: string;

          if (isMine) {
            displayName = isAdmin ? t('You (Admin)') : (msg.name || t('You'));
            initials = isAdmin ? 'A' : getInitials(msg.name || 'You');
            avatarClass = styles.avatarMine;
            avatarDarkClass = 'chat-conversation-avatar-mine';
            nameClass = styles.senderNameMine;
            nameDarkClass = 'chat-conversation-sender-mine';
          } else if (msg.from === 'user') {
            displayName = msg.name || t('User');
            initials = getInitials(displayName);
            avatarClass = styles.avatarUser;
            avatarDarkClass = 'chat-conversation-avatar-user';
            nameClass = styles.senderNameTheirs;
            nameDarkClass = 'chat-conversation-sender-theirs';
          } else {
            displayName = t('Sprout Track Team');
            initials = 'ST';
            avatarClass = styles.avatarAdmin;
            avatarDarkClass = 'chat-conversation-avatar-admin';
            nameClass = styles.senderNameTheirs;
            nameDarkClass = 'chat-conversation-sender-theirs';
          }

          return (
            <div key={msg.id}>
              {showDateBreak && (
                <div className={cn(styles.dateBreak, 'chat-conversation-date-break')}>
                  {formatDateLabel(msg.date)}
                </div>
              )}
              <div className={cn(
                styles.messageWrapper,
                isMine ? styles.messageWrapperMine : styles.messageWrapperTheirs,
              )}>
                {/* Sender label */}
                {!sameSenderAsPrev && (
                  <div className={cn(
                    styles.senderRow,
                    isMine ? styles.senderRowMine : styles.senderRowTheirs,
                  )}>
                    <div className={cn(styles.avatar, avatarClass, avatarDarkClass)}>
                      {initials}
                    </div>
                    <div className={cn(
                      'flex items-center gap-1.5',
                      isMine ? 'flex-row-reverse' : 'flex-row',
                    )}>
                      <span className={cn(nameClass, nameDarkClass)}>
                        {displayName}
                      </span>
                      {isAdmin && msg.from === 'user' && thread.familySlug && (
                        <span className={cn(styles.familyTag, 'chat-conversation-family-tag')}>
                          {thread.familySlug}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {/* Bubble */}
                <div className={cn(
                  isMine
                    ? cn(styles.bubbleMine, 'chat-conversation-bubble-mine')
                    : cn(styles.bubbleTheirs, 'chat-conversation-bubble-theirs'),
                )}>
                  {msg.text}
                </div>
                {/* Timestamp */}
                <span className={cn(
                  styles.timestamp,
                  'chat-conversation-timestamp',
                  isMine ? styles.timestampMine : styles.timestampTheirs,
                )}>
                  {formatTime(msg.date)}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply Input */}
      {!hideReplyBar && (
        <div className={cn(styles.replyBar, 'chat-conversation-reply-bar')}>
          <textarea
            ref={textareaRef}
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleTextareaInput}
            placeholder={t('Type a reply...')}
            rows={1}
            disabled={sending}
            className={cn(styles.replyTextarea, 'chat-conversation-reply-textarea')}
          />
          <button
            onClick={handleSend}
            disabled={!replyText.trim() || sending}
            className={cn(
              styles.sendButton,
              replyText.trim() && !sending
                ? styles.sendButtonActive
                : cn(styles.sendButtonInactive, 'chat-conversation-send-inactive'),
            )}
            aria-label={t('Send')}
          >
            <Send className="h-[15px] w-[15px]" color={replyText.trim() && !sending ? '#fff' : '#a3a39b'} />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Standalone reply bar for use outside ChatConversation (e.g. in a FormPageFooter).
 */
export function ChatReplyBar({
  threadId,
  subject,
  familyId,
  onReply,
  className,
}: ChatReplyBarProps) {
  const { theme } = useTheme();
  const { t } = useLocalization();
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(async () => {
    if (!replyText.trim() || sending) return;
    setSending(true);
    try {
      await onReply(threadId, replyText.trim(), subject, familyId);
      setReplyText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Error sending reply:', error);
    } finally {
      setSending(false);
    }
  }, [replyText, threadId, subject, familyId, sending, onReply]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleTextareaInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  return (
    <div className={cn('flex items-end gap-2 w-full', className)}>
      <textarea
        ref={textareaRef}
        value={replyText}
        onChange={e => setReplyText(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleTextareaInput}
        placeholder={t('Type a reply...')}
        rows={1}
        disabled={sending}
        className={cn(styles.replyTextarea, 'chat-conversation-reply-textarea')}
      />
      <button
        onClick={handleSend}
        disabled={!replyText.trim() || sending}
        className={cn(
          styles.sendButton,
          replyText.trim() && !sending
            ? styles.sendButtonActive
            : cn(styles.sendButtonInactive, 'chat-conversation-send-inactive'),
        )}
        aria-label={t('Send')}
      >
        <Send className="h-[15px] w-[15px]" color={replyText.trim() && !sending ? '#fff' : '#a3a39b'} />
      </button>
    </div>
  );
}

export default ChatConversation;
