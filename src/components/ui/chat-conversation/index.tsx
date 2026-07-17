'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/src/lib/utils';
import { ChevronLeft, Send, MessageSquare, X, ImagePlus } from 'lucide-react';
import { useTheme } from '@/src/context/theme';
import { useLocalization } from '@/src/context/localization';
import { useTimezone } from '@/app/context/timezone';
import { formatTimeDisplay, formatDateShort, type TimeFormatSetting, type DateFormatSetting } from '@/src/utils/dateFormat';
import { chatConversationDefault, chatConversationSb } from './chat-conversation.sb';
import type { ChatConversationProps, ChatReplyBarProps, ChatMessage } from './chat-conversation.types';
import type { FeedbackResponse } from '@/app/api/types';
import './chat-conversation.css';

/** Fetches an image with the auth token and renders it as a blob URL. */
function AuthImage({ src, alt, className, onClick }: { src: string; alt: string; className?: string; onClick?: () => void }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoke: string | null = null;
    const token = localStorage.getItem('authToken');
    fetch(src, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load image');
        return res.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        revoke = url;
        setBlobUrl(url);
      })
      .catch(() => setBlobUrl(null));
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [src]);

  if (!blobUrl) return <div className={cn(className, 'bg-gray-200 animate-pulse')} style={{ minHeight: 60 }} />;

  return <img src={blobUrl} alt={alt} className={className} loading="lazy" onClick={onClick} />;
}

function flattenMessages(thread: FeedbackResponse): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const isAdminMsg = thread.submitterName === 'Admin';
  messages.push({
    id: thread.id,
    from: isAdminMsg ? 'admin' : 'user',
    name: thread.submitterName || 'User',
    date: thread.submittedAt,
    text: thread.message,
    viewed: thread.viewed,
    accountId: thread.accountId,
    caretakerId: thread.caretakerId,
    attachments: thread.attachments,
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
        accountId: reply.accountId,
        caretakerId: reply.caretakerId,
        attachments: reply.attachments,
      });
    }
  }
  return messages;
}

function isMessageMine(
  msg: ChatMessage,
  isAdmin: boolean,
  viewerAccountId?: string | null,
  viewerCaretakerId?: string | null,
): boolean {
  if (viewerAccountId && msg.accountId) return msg.accountId === viewerAccountId;
  if (viewerCaretakerId && msg.caretakerId) return msg.caretakerId === viewerCaretakerId;
  return isAdmin ? msg.from === 'admin' : msg.from === 'user';
}

function sameSender(a: ChatMessage, b: ChatMessage): boolean {
  if (a.accountId && b.accountId) return a.accountId === b.accountId;
  if (a.caretakerId && b.caretakerId) return a.caretakerId === b.caretakerId;
  return a.from === b.from;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatTime(dateStr: string, timeFormat: TimeFormatSetting): string {
  const date = new Date(dateStr);
  return formatTimeDisplay(date, timeFormat);
}

function formatDateLabel(dateStr: string, dateFormat: DateFormatSetting): string {
  const date = new Date(dateStr);
  return formatDateShort(date, dateFormat);
}

function isSameDay(d1: string, d2: string): boolean {
  const a = new Date(d1);
  const b = new Date(d2);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function ChatConversation({
  thread,
  isAdmin,
  viewerAccountId,
  viewerCaretakerId,
  onReply,
  onDeleteAttachment,
  onBack,
  showBackButton = false,
  onMarkRead,
  formatDateTime,
  hideHeader = false,
  hideReplyBar = false,
  appearance = 'default',
  className,
}: ChatConversationProps) {
  const { theme } = useTheme();
  const { t } = useLocalization();
  const { dateFormat, timeFormat } = useTimezone();
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const markedReadRef = useRef<string | null>(null);
  const c = appearance === 'storybook' ? chatConversationSb : chatConversationDefault;

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
    setPendingFiles([]);
  }, [thread?.id]);

  // Auto-mark unread messages as read
  useEffect(() => {
    if (!thread || !onMarkRead) return;
    if (markedReadRef.current === thread.id) return;
    markedReadRef.current = thread.id;

    const messages = flattenMessages(thread);
    const unreadFromOther = messages.filter(msg => {
      if (!msg.viewed) {
        return !isMessageMine(msg, isAdmin, viewerAccountId, viewerCaretakerId);
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

  const canSend = (replyText.trim() || pendingFiles.length > 0) && !sending;

  const handleSend = useCallback(async () => {
    if (!canSend || !thread) return;
    setSending(true);
    try {
      await onReply(thread.id, replyText.trim(), thread.subject, thread.familyId, pendingFiles.length > 0 ? pendingFiles : undefined);
      setReplyText('');
      setPendingFiles([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Error sending reply:', error);
    } finally {
      setSending(false);
    }
  }, [canSend, replyText, thread, pendingFiles, onReply]);

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

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setPendingFiles(prev => [...prev, ...files]);
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
  }, []);

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDeleteAttachment = useCallback(async (attachmentId: string) => {
    if (!onDeleteAttachment) return;
    await onDeleteAttachment(attachmentId);
    setConfirmDeleteId(null);
  }, [onDeleteAttachment]);

  // Empty state
  if (!thread) {
    return (
      <div className={cn(c.container, className)}>
        <div className={c.emptyState}>
          <MessageSquare className={c.emptyIcon} strokeWidth={1.5} aria-hidden="true" />
          <span>{t('Select a conversation')}</span>
        </div>
      </div>
    );
  }

  const messages = flattenMessages(thread);
  const totalMessages = messages.length;

  return (
    <div className={cn(c.container, className)}>
      {/* Header */}
      {!hideHeader && (
        <div className={c.header}>
          {showBackButton && onBack && (
            <button onClick={onBack} className={c.backButton} aria-label={t('Back')}>
              <ChevronLeft className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          )}
          <div className={c.headerContent}>
            <div className={c.headerSubject}>
              {thread.subject}
            </div>
            <div className={c.headerMeta}>
              <span>{totalMessages} {t('message')}{totalMessages > 1 ? 's' : ''}</span>
              {isAdmin && thread.submitterName && thread.submitterName !== 'Admin' && (
                <>
                  <span className={c.headerMetaDivider}>·</span>
                  <span className={c.headerMetaName}>
                    {thread.submitterName}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className={c.messagesArea}>
        {messages.map((msg, idx) => {
          const isMine = isMessageMine(msg, isAdmin, viewerAccountId, viewerCaretakerId);
          const showDateBreak = idx === 0 || !isSameDay(messages[idx - 1].date, msg.date);
          const sameSenderAsPrev = idx > 0 && sameSender(messages[idx - 1], msg) && !showDateBreak;

          // Avatar and name styling
          let avatarClass: string;
          let nameClass: string;
          let displayName: string;
          let initials: string;

          if (isMine) {
            displayName = isAdmin ? t('You (Admin)') : (msg.name || t('You'));
            initials = isAdmin ? 'A' : getInitials(msg.name || 'You');
            avatarClass = c.avatarMine;
            nameClass = c.senderNameMine;
          } else if (msg.from === 'user') {
            displayName = msg.name || t('User');
            initials = getInitials(displayName);
            avatarClass = c.avatarUser;
            nameClass = c.senderNameTheirs;
          } else {
            displayName = t('Sprout Track Team');
            initials = 'ST';
            avatarClass = c.avatarAdmin;
            nameClass = c.senderNameTheirs;
          }

          return (
            <div key={msg.id}>
              {showDateBreak && (
                <div className={c.dateBreak}>
                  {formatDateLabel(msg.date, dateFormat)}
                </div>
              )}
              <div className={cn(
                c.messageWrapper,
                isMine ? c.messageWrapperMine : c.messageWrapperTheirs,
              )}>
                {/* Sender label */}
                {!sameSenderAsPrev && (
                  <div className={cn(
                    c.senderRow,
                    isMine ? c.senderRowMine : c.senderRowTheirs,
                  )}>
                    <div className={cn(c.avatar, avatarClass)}>
                      {initials}
                    </div>
                    <div className={cn(
                      'flex items-center gap-1.5',
                      isMine ? 'flex-row-reverse' : 'flex-row',
                    )}>
                      <span className={nameClass}>
                        {displayName}
                      </span>
                      {isAdmin && msg.from === 'user' && thread.familySlug && (
                        <span className={c.familyTag}>
                          {thread.familySlug}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {/* Bubble */}
                <div className={isMine ? c.bubbleMine : c.bubbleTheirs}>
                  {msg.text && <div>{msg.text}</div>}
                  {/* Inline images */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className={c.attachmentGrid}>
                      {msg.attachments.map(att => (
                        <div key={att.id} className={c.attachmentWrapper}>
                          <AuthImage
                            src={`/api/feedback/file/${att.id}`}
                            alt={att.originalName}
                            className={c.attachmentImage}
                            onClick={() => {
                              const token = localStorage.getItem('authToken');
                              fetch(`/api/feedback/file/${att.id}`, {
                                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                              })
                                .then(r => r.blob())
                                .then(blob => {
                                  const url = URL.createObjectURL(blob);
                                  window.open(url, '_blank');
                                });
                            }}
                          />
                          {onDeleteAttachment && confirmDeleteId === att.id ? (
                            <div
                              className={c.confirmOverlay}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className={c.confirmLabel}>{t('Delete?')}</span>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => handleDeleteAttachment(att.id)}
                                  className={c.confirmYes}
                                >
                                  {t('Yes')}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className={c.confirmNo}
                                >
                                  {t('No')}
                                </button>
                              </div>
                            </div>
                          ) : onDeleteAttachment && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(att.id);
                              }}
                              className={c.attachmentDeleteButton}
                              aria-label={t('Remove image')}
                            >
                              <X className="h-3 w-3 text-white" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Timestamp */}
                <span className={cn(
                  c.timestamp,
                  isMine ? c.timestampMine : c.timestampTheirs,
                )}>
                  {formatTime(msg.date, timeFormat)}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Pending file previews */}
      {!hideReplyBar && pendingFiles.length > 0 && (
        <div className={c.replyPreviewStrip}>
          {pendingFiles.map((file, idx) => (
            <div key={idx} className={c.replyPreviewItem}>
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className={c.replyPreviewImage}
              />
              <button
                onClick={() => removePendingFile(idx)}
                className={c.replyPreviewDelete}
                aria-label={t('Remove image')}
              >
                <X className="h-2.5 w-2.5 text-white" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Reply Input */}
      {!hideReplyBar && (
        <div className={c.replyBar}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/jpg,image/png,image/heic,image/heif,image/webp,image/gif"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className={c.replyAttachButton}
            aria-label={t('Attach images')}
          >
            <ImagePlus className={c.attachIcon} aria-hidden="true" />
          </button>
          <textarea
            ref={textareaRef}
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleTextareaInput}
            placeholder={t('Type a reply...')}
            rows={1}
            disabled={sending}
            className={c.replyTextarea}
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={cn(c.sendButton, canSend ? c.sendButtonActive : c.sendButtonInactive)}
            aria-label={t('Send')}
          >
            <Send className="h-[15px] w-[15px]" color={canSend ? c.sendIconColorOn : c.sendIconColorOff} aria-hidden="true" />
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
  appearance = 'default',
  className,
}: ChatReplyBarProps) {
  const { theme } = useTheme();
  const { t } = useLocalization();
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const c = appearance === 'storybook' ? chatConversationSb : chatConversationDefault;

  const canSend = (replyText.trim() || pendingFiles.length > 0) && !sending;

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await onReply(threadId, replyText.trim(), subject, familyId, pendingFiles.length > 0 ? pendingFiles : undefined);
      setReplyText('');
      setPendingFiles([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Error sending reply:', error);
    } finally {
      setSending(false);
    }
  }, [canSend, replyText, threadId, subject, familyId, pendingFiles, onReply]);

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

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setPendingFiles(prev => [...prev, ...files]);
    }
    e.target.value = '';
  }, []);

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className={cn('flex flex-col w-full', className)}>
      {/* Pending file previews */}
      {pendingFiles.length > 0 && (
        <div className={c.replyPreviewStripInline}>
          {pendingFiles.map((file, idx) => (
            <div key={idx} className={c.replyPreviewItem}>
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className={c.replyPreviewImage}
              />
              <button
                onClick={() => removePendingFile(idx)}
                className={c.replyPreviewDelete}
                aria-label={t('Remove image')}
              >
                <X className="h-2.5 w-2.5 text-white" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 w-full">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/jpg,image/png,image/heic,image/heif,image/webp,image/gif"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className={c.replyAttachButton}
          aria-label={t('Attach images')}
        >
          <ImagePlus className={c.attachIcon} aria-hidden="true" />
        </button>
        <textarea
          ref={textareaRef}
          value={replyText}
          onChange={e => setReplyText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleTextareaInput}
          placeholder={t('Type a reply...')}
          rows={1}
          disabled={sending}
          className={c.replyTextarea}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={cn(c.sendButton, canSend ? c.sendButtonActive : c.sendButtonInactive)}
          aria-label={t('Send')}
        >
          <Send className="h-[15px] w-[15px]" color={canSend ? c.sendIconColorOn : c.sendIconColorOff} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default ChatConversation;
